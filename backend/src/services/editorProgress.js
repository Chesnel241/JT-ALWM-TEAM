/**
 * Suivi de progression des jobs de montage (in-memory).
 * Le frontend ouvre un EventSource sur /api/editor/progress/:jobId et/ou
 * interroge GET /api/editor/result/:jobId (fallback robuste si le SSE est
 * coupé par un proxy). Le job concat met à jour via setProgress().
 *
 * Mono-instance only (Map en mémoire) — cohérent avec scaling=1.
 */

let progressIo = null;
export function setProgressIo(io) {
  progressIo = io;
}

const jobs = new Map(); // jobId -> { percent, status, url, listeners:Set<res>, timeout, stall, doneAt, weekId }
const jobWeekMap = new Map(); // jobId -> weekId
const weekActiveJobs = new Map(); // weekId -> { jobId, weekId, startedAt }
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

// 12 h : durée max absolue d'un job actif (surchargeable JOB_TTL_MS).
// Mesuré : le moteur rend 5 à 10 images par seconde, soit 1 h 30 à 3 h pour un
// JT de 30 minutes. L'ancien plafond de 3 h tuait donc un rendu sain à
// quelques minutes de la fin. Le vrai garde-fou reste le watchdog ci-dessous.
const JOB_TTL_MS = Number(process.env.JOB_TTL_MS) || 12 * 60 * 60 * 1000;
// Watchdog anti-blocage : si aucune progression n'arrive pendant ce délai
// (worker OOM-killed, Chromium crash, callback réseau coupé…), on finalise
// le job en 'error' pour que l'utilisateur ne reste pas bloqué sur le
// spinner jusqu'au TTL. Réinitialisé à chaque setProgress. 10 min : un
// master long a des phases légitimes sans event (probe de gros fichiers,
// copie du master) — ffmpeg émet sinon un progress ~1/s.
const STALL_MS = Number(process.env.RENDER_STALL_MS) || 10 * 60 * 1000;
// Un job terminé est conservé 24 h. Un master demande plusieurs heures : le
// monteur lance le rendu, part, et revient bien après. Avec les 15 minutes
// d'avant, le lien du master avait disparu à son retour et il relançait un
// rendu de trois heures pour rien. (Le fichier, lui, reste 48 h sur le disque.)
const FINISHED_RETENTION_MS = Number(process.env.JOB_RETENTION_MS) || 24 * 60 * 60 * 1000;

export function registerJobWeek(jobId, weekId) {
  if (jobId && weekId) {
    jobWeekMap.set(jobId, weekId);
    weekActiveJobs.set(weekId, { jobId, weekId, startedAt: Date.now() });
    const job = jobs.get(jobId);
    if (job) job.weekId = weekId;
  }
}

export function getWeekActiveJob(weekId) {
  if (!weekId) return null;
  const entry = weekActiveJobs.get(weekId);
  if (!entry) return null;
  const state = getJobState(entry.jobId);
  if (!state) {
    weekActiveJobs.delete(weekId);
    return null;
  }
  return { ...entry, ...state };
}

// (Re)arme le watchdog de stagnation. Appelé à la création + à chaque
// progression. Si le délai expire sans nouvelle progression → erreur.
function armStall(job, jobId) {
  if (job.stall) clearTimeout(job.stall);
  job.stall = setTimeout(() => {
    if (!isFinished(job.status)) {
      finishJob(jobId, 'error', null, 'Le moteur de rendu ne répond plus. Relancez le rendu ; si cela se reproduit, prévenez la personne qui gère le serveur.');
    }
  }, STALL_MS);
}

function ensure(jobId) {
  if (!jobs.has(jobId)) {
    const timeout = setTimeout(() => {
      finishJob(jobId, 'error', null, 'Le rendu a dépassé la durée maximale autorisée.');
    }, JOB_TTL_MS);
    const weekId = jobWeekMap.get(jobId) || null;
    const job = { percent: 0, status: 'pending', url: null, listeners: new Set(), timeout, stall: null, doneAt: null, weekId };
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
  const weekId = job.weekId || jobWeekMap.get(jobId);
  progressIo?.emit('editor_job_update', { jobId, weekId, percent: job.percent, status: job.status, url: job.url });
}

/**
 * `message` : la raison d'un échec, en clair, montrée au monteur. Sans elle il
 * ne voyait que « Erreur serveur lors du montage » et ne savait ni quel plan
 * corriger ni s'il fallait simplement relancer.
 */
export function finishJob(jobId, status = 'done', url = null, message = null) {
  if (!jobId) return;
  if (finishedIds.has(jobId)) return; // déjà terminé + purgé : ignore.
  const job = ensure(jobId);
  if (isFinished(job.status)) return; // déjà terminé, ne pas réémettre
  if (job.timeout) clearTimeout(job.timeout);
  if (job.stall) { clearTimeout(job.stall); job.stall = null; }
  job.percent = status === 'done' ? 100 : job.percent;
  job.status = status;
  job.url = url;
  job.message = status === 'error' && typeof message === 'string' && message.trim()
    ? message.trim().slice(0, 400)
    : null;
  job.doneAt = Date.now();
  const payload = `data: ${JSON.stringify({ percent: job.percent, status, url, message: job.message })}\n\n`;
  for (const res of job.listeners) {
    try {
      if (res._hb) { clearInterval(res._hb); res._hb = null; }
      res.write(payload);
      res.end();
    } catch { /* ignore */ }
  }
  job.listeners.clear();
  const weekId = job.weekId || jobWeekMap.get(jobId);
  progressIo?.emit('editor_job_update', { jobId, weekId, percent: job.percent, status, url, message: job.message });
  // Conserve l'état terminé un moment (récupérable via /result ou reconnexion
  // SSE), puis purge + pose un tombstone pour bloquer les callbacks rejoués.
  job.timeout = setTimeout(() => {
    jobs.delete(jobId);
    jobWeekMap.delete(jobId);
    if (weekId && weekActiveJobs.get(weekId)?.jobId === jobId) {
      weekActiveJobs.delete(weekId);
    }
    tombstone(jobId);
  }, FINISHED_RETENTION_MS);
  // Ce minuteur de 24 h ne doit pas retenir l'arrêt du serveur.
  job.timeout.unref?.();
}

/** État courant d'un job pour le fallback polling. null si inconnu/purgé. */
export function getJobState(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return { percent: job.percent, status: job.status, url: job.url, message: job.message || null };
}

export function addListener(jobId, res) {
  const job = ensure(jobId);

  // Job déjà terminé : pousse l'état final immédiatement et ferme. Permet à
  // un EventSource qui se reconnecte après une coupure de récupérer le
  // résultat (url) au lieu de repartir à 0.
  if (isFinished(job.status)) {
    try {
      res.write(`data: ${JSON.stringify({ percent: job.percent, status: job.status, url: job.url, message: job.message || null })}\n\n`);
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
