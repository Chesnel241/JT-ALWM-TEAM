/**
 * Suivi de progression des jobs de montage (in-memory).
 * Le frontend ouvre un EventSource sur /api/editor/progress/:jobId,
 * le job concat met à jour le pourcentage via setProgress().
 *
 * Mono-instance only (Map en mémoire) — cohérent avec scaling=1.
 */

const jobs = new Map(); // jobId -> { percent, status, listeners:Set<res>, timeout: NodeJS.Timeout }

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour max duration per job

function ensure(jobId) {
  if (!jobs.has(jobId)) {
    const timeout = setTimeout(() => {
      finishJob(jobId, 'error');
    }, JOB_TTL_MS);
    jobs.set(jobId, { percent: 0, status: 'pending', listeners: new Set(), timeout });
  }
  return jobs.get(jobId);
}

export function setProgress(jobId, percent, status = 'processing') {
  if (!jobId) return;
  const job = ensure(jobId);
  job.percent = Math.max(0, Math.min(100, Math.round(percent)));
  job.status = status;
  const payload = `data: ${JSON.stringify({ percent: job.percent, status: job.status })}\n\n`;
  for (const res of job.listeners) {
    try { res.write(payload); } catch { /* client parti */ }
  }
}

export function finishJob(jobId, status = 'done', url = null) {
  if (!jobId) return;
  const job = ensure(jobId);
  if (job.timeout) clearTimeout(job.timeout);
  job.percent = status === 'done' ? 100 : job.percent;
  job.status = status;
  const payload = `data: ${JSON.stringify({ percent: job.percent, status, url })}\n\n`;
  for (const res of job.listeners) {
    try {
      if (res._hb) { clearInterval(res._hb); res._hb = null; }
      res.write(payload);
      res.end();
    } catch { /* ignore */ }
  }
  jobs.delete(jobId);
}

export function addListener(jobId, res) {
  const job = ensure(jobId);
  job.listeners.add(res);
  // Pousse l'état courant immédiatement.
  res.write(`data: ${JSON.stringify({ percent: job.percent, status: job.status })}\n\n`);
  // Heartbeat (commentaire SSE) toutes les 15 s : empêche les proxies
  // (Render) de fermer la connexion idle pendant un encodage long sans
  // mise à jour de %.
  res._hb = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 15000);
}

export function removeListener(jobId, res) {
  if (res._hb) { clearInterval(res._hb); res._hb = null; }
  const job = jobs.get(jobId);
  if (job) job.listeners.delete(res);
}
