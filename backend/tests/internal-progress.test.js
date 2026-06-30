import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { setProgress, getJobState } from '../src/services/editorProgress.js';

let app;
const ORIG_KEY = process.env.WORKER_KEY;

beforeAll(() => {
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

afterAll(() => {
  if (ORIG_KEY === undefined) delete process.env.WORKER_KEY;
  else process.env.WORKER_KEY = ORIG_KEY;
});

describe('POST /api/editor/internal/progress (callback worker Cloud Run)', () => {
  beforeEach(() => {
    process.env.WORKER_KEY = 'test-secret-key';
  });

  it('rejette 403 sans X-Worker-Key', async () => {
    const res = await request(app)
      .post('/api/editor/internal/progress')
      .send({ jobId: 'j1', percent: 42, status: 'encoding' });
    expect(res.status).toBe(403);
  });

  it('rejette 403 si X-Worker-Key incorrect', async () => {
    const res = await request(app)
      .post('/api/editor/internal/progress')
      .set('X-Worker-Key', 'wrong')
      .send({ jobId: 'j1', percent: 42 });
    expect(res.status).toBe(403);
    // La réponse ne doit PAS divulguer d'info sur la clé (longueur, raison
    // précise) — juste 'forbidden'.
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('rejette 403 si WORKER_KEY non configuré côté backend', async () => {
    delete process.env.WORKER_KEY;
    const res = await request(app)
      .post('/api/editor/internal/progress')
      .set('X-Worker-Key', 'anything')
      .send({ jobId: 'j1', percent: 10 });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('rejette 400 si jobId manquant', async () => {
    const res = await request(app)
      .post('/api/editor/internal/progress')
      .set('X-Worker-Key', 'test-secret-key')
      .send({ percent: 50 });
    expect(res.status).toBe(400);
  });

  it('met à jour setProgress sur callback encoding', async () => {
    const jobId = `job-progress-${Math.random()}`;
    const res = await request(app)
      .post('/api/editor/internal/progress')
      .set('X-Worker-Key', 'test-secret-key')
      .send({ jobId, percent: 73, status: 'encoding' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(getJobState(jobId)).toMatchObject({ percent: 73, status: 'encoding' });
  });

  it('finalise via finishJob sur status=done avec URL locale autorisée', async () => {
    const jobId = `job-done-${Math.random()}`;
    const url = '/uploads/exports/out.mp4';
    setProgress(jobId, 90, 'encoding');
    const res = await request(app)
      .post('/api/editor/internal/progress')
      .set('X-Worker-Key', 'test-secret-key')
      .send({ jobId, status: 'done', url });
    expect(res.status).toBe(200);
    expect(getJobState(jobId)).toEqual({ percent: 100, status: 'done', url });
  });

  it('rejette une URL de résultat d\'origine non autorisée (anti-injection)', async () => {
    const jobId = `job-evil-${Math.random()}`;
    setProgress(jobId, 90, 'encoding');
    const res = await request(app)
      .post('/api/editor/internal/progress')
      .set('X-Worker-Key', 'test-secret-key')
      .send({ jobId, status: 'done', url: 'https://evil.example/pwn.mp4' });
    expect(res.status).toBe(400);
    // Le job bascule en erreur, l'URL malveillante n'est jamais servie.
    expect(getJobState(jobId).status).toBe('error');
  });

  it('finalise en erreur sur status=error', async () => {
    const jobId = `job-err-${Math.random()}`;
    setProgress(jobId, 30, 'encoding');
    await request(app)
      .post('/api/editor/internal/progress')
      .set('X-Worker-Key', 'test-secret-key')
      .send({ jobId, status: 'error', error: 'boom' });
    expect(getJobState(jobId).status).toBe('error');
  });

  it('est accessible AVANT le middleware requireAuth (pas de cookie session requis)', async () => {
    // Mise en preuve : pas de cookie, pas de header App-Password → on doit
    // recevoir 200 (pas 401), car la route est montée avant requireAuth.
    const jobId = `job-noauth-${Math.random()}`;
    const res = await request(app)
      .post('/api/editor/internal/progress')
      .set('X-Worker-Key', 'test-secret-key')
      .send({ jobId, percent: 5, status: 'downloading' });
    expect(res.status).toBe(200);
  });
});
