/**
 * Suivi de progression des jobs de montage (in-memory).
 * Le frontend ouvre un EventSource sur /api/editor/progress/:jobId,
 * le job concat met à jour le pourcentage via setProgress().
 *
 * Mono-instance only (Map en mémoire) — cohérent avec scaling=1.
 */

const jobs = new Map(); // jobId -> { percent, status, listeners:Set<res> }

function ensure(jobId) {
  if (!jobs.has(jobId)) {
    jobs.set(jobId, { percent: 0, status: 'pending', listeners: new Set() });
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
  job.percent = status === 'done' ? 100 : job.percent;
  job.status = status;
  const payload = `data: ${JSON.stringify({ percent: job.percent, status, url })}\n\n`;
  for (const res of job.listeners) {
    try { res.write(payload); res.end(); } catch { /* ignore */ }
  }
  jobs.delete(jobId);
}

export function addListener(jobId, res) {
  const job = ensure(jobId);
  job.listeners.add(res);
  // Pousse l'état courant immédiatement.
  res.write(`data: ${JSON.stringify({ percent: job.percent, status: job.status })}\n\n`);
}

export function removeListener(jobId, res) {
  const job = jobs.get(jobId);
  if (job) job.listeners.delete(res);
}
