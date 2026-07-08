/**
 * Suivi de progression des jobs de montage (in-memory).
 * Le frontend ouvre un EventSource sur /api/editor/progress/:jobId et/ou
 * interroge GET /api/editor/result/:jobId (fallback robuste si le SSE est
 * coupé par un proxy). Le job concat met à jour via setProgress().
 *
 * Mono-instance only (Map en mémoire) — cohérent avec scaling=1.
 */

const jobs = new Map(); // jobId -> { percent, status, url, listeners:Set<res>, timeout, stall, doneAt }
// Tombstones : IDs de jobs déjà terminés puis purgés. Empêche qu'un callback
// worker rejoué (réseau lent, retry) tardif ressuscite un job fantôme
// (nouveau pending + re-émission d'un 2e 'done'/'error'). Borné en taille.
const finishedIds = new Set();
const MAX_TOMBSTONES = 2000;
function tombstone(jobId) {
  finishedIds.add(jobId);
  if (finishedIds.size > MAX_TOMBSTONES) {
    // purge la plus ancienne moitié (Set conserve l'ordre d'insertion).
    const it = finishedIds.values();
    for (let i = 0; i < MAX_TOMBSTONES / 2; i++) finishedIds.delete(it.next().value);
  }
}

// 3 h : durée max absolue d'un job actif (surchargeable JOB_TTL_MS). Les
// masters de prod font jusqu'à 30 min de JT → l'encodage seul peut dépasser
// 1 h sur VPS ; l'ancien TTL de 30 min tuait le job en plein rendu légitime.
const JOB_TTL_MS = Number(process.env.JOB_TTL_MS) || 3 * 60 * 60 * 1000;
// Watchdog anti-blocage : si aucune progression n'arrive pendant ce délai
// (worker OOM-killed, Chromium crash, callback réseau coupé…), on finalise
// le job en 'error' pour que l'utilisateur ne reste pas bloqué sur le
// spinner jusqu'au TTL. Réinitialisé à chaque setProgress. 10 min : un
// master long a des phases légitimes sans event (probe de gros fichiers,
// copie du master) — ffmpeg émet sinon un progress ~1/s.
const STALL_MS = Number(process.env.RENDER_STALL_MS) || 10 * 60 * 1000;
// Un job terminé est conservé un moment pour que le frontend puisse
// récupérer le résultat même si le SSE a été coupé pendant le rendu.
const FINISHED_RETENTION_MS = 15 * 60 * 1000;

// (Re)arme le watchdog de stagnation. Appelé à la création + à chaque
// progression. Si le délai expire sans nouvelle progression → erreur.
function armStall(job, jobId) {
  if (job.stall) clearTimeout(job.stall);
  job.stall = setTimeout(() => {
    if (!isFinished(job.status)) {
      finishJob(jobId, 'error');
    }
  }, STALL_MS);
}

function ensure(jobId) {
  if (!jobs.has(jobId)) {
    const timeout = setTimeout(() => {
      finishJob(jobId, 'error');
    }, JOB_TTL_MS);
    const job = { percent: 0, status: 'pending', url: null, listeners: new Set(), timeout, stall: null, doneAt: null };
    jobs.set(jobId, job);
    armStall(job, jobId);
  }
  return jobs.get(jobId);
}

function isFinished(status) {
  return status === 'done' || status === 'error';
}

export function setProgress(jobId, percent, status = 'processing') {
  if (!jobId) return;
  // Job déjà terminé puis purgé : on ignore tout callback tardif/rejoué pour
  // éviter de ressusciter un job fantôme.
  if (finishedIds.has(jobId)) return;
  const job = ensure(jobId);
  // Ne pas régresser un job déjà terminé (ex: setProgress tardif).
  if (isFinished(job.status)) return;
  job.percent = Math.max(0, Math.min(100, Math.round(percent)));
  job.status = status;
  armStall(job, jobId); // progression reçue → on relance le watchdog
  const payload = `data: ${JSON.stringify({ percent: job.percent, status: job.status })}\n\n`;
  for (const res of job.listeners) {
    try {
      res.write(payload);
      res.flush?.();
    } catch { /* client parti */ }
  }
}

export function finishJob(jobId, status = 'done', url = null) {
  if (!jobId) return;
  if (finishedIds.has(jobId)) return; // déjà terminé + purgé : ignore.
  const job = ensure(jobId);
  if (isFinished(job.status)) return; // déjà terminé, ne pas réémettre
  if (job.timeout) clearTimeout(job.timeout);
  if (job.stall) { clearTimeout(job.stall); job.stall = null; }
  job.percent = status === 'done' ? 100 : job.percent;
  job.status = status;
  job.url = url;
  job.doneAt = Date.now();
  const payload = `data: ${JSON.stringify({ percent: job.percent, status, url })}\n\n`;
  for (const res of job.listeners) {
    try {
      if (res._hb) { clearInterval(res._hb); res._hb = null; }
      res.write(payload);
      res.end();
    } catch { /* ignore */ }
  }
  job.listeners.clear();
  // Conserve l'état terminé un moment (récupérable via /result ou reconnexion
  // SSE), puis purge + pose un tombstone pour bloquer les callbacks rejoués.
  job.timeout = setTimeout(() => { jobs.delete(jobId); tombstone(jobId); }, FINISHED_RETENTION_MS);
}

/** État courant d'un job pour le fallback polling. null si inconnu/purgé. */
export function getJobState(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return { percent: job.percent, status: job.status, url: job.url };
}

export function addListener(jobId, res) {
  const job = ensure(jobId);

  // Job déjà terminé : pousse l'état final immédiatement et ferme. Permet à
  // un EventSource qui se reconnecte après une coupure de récupérer le
  // résultat (url) au lieu de repartir à 0.
  if (isFinished(job.status)) {
    try {
      res.write(`data: ${JSON.stringify({ percent: job.percent, status: job.status, url: job.url })}\n\n`);
      res.end();
    } catch { /* ignore */ }
    return;
  }

  job.listeners.add(res);
  // Pousse l'état courant immédiatement.
  res.write(`data: ${JSON.stringify({ percent: job.percent, status: job.status })}\n\n`);
  res.flush?.();
  // Heartbeat (commentaire SSE) toutes les 15 s : empêche les proxies
  // (Render) de fermer la connexion idle pendant un encodage long sans
  // mise à jour de %.
  res._hb = setInterval(() => {
    try { 
      res.write(': ping\n\n'); 
      res.flush?.();
    } catch { /* ignore */ }
  }, 15000);
}

export function removeListener(jobId, res) {
  if (res._hb) { clearInterval(res._hb); res._hb = null; }
  const job = jobs.get(jobId);
  if (job) job.listeners.delete(res);
}
