import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { buildWeeks } from '../src/data/constants.js';
import { registerJobWeek, setProgress, finishJob, getWeekActiveJob } from '../src/services/editorProgress.js';

let app;
let validWeek1;
let validWeek2;

beforeAll(() => {
  const weeks = buildWeeks();
  validWeek1 = weeks[0].id;
  validWeek2 = weeks[1]?.id || weeks[0].id;

  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

describe('Editor Real-Time Sync & Recovery Routes', () => {
  it('GET /api/editor/job/:weekId returns 404 for an invalid week ID', async () => {
    const res = await request(app).get('/api/editor/job/invalid-week-999');
    expect(res.status).toBe(404);
  });

  it('GET /api/editor/job/:weekId returns null when no active job for the valid week', async () => {
    const res = await request(app).get(`/api/editor/job/${validWeek1}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ job: null });
  });

  it('registers a job to a week and retrieves it via GET /api/editor/job/:weekId', async () => {
    const jobId = 'job-test-sync-1';

    registerJobWeek(jobId, validWeek1);
    setProgress(jobId, 45, 'processing');

    const res = await request(app).get(`/api/editor/job/${validWeek1}`);
    expect(res.status).toBe(200);
    expect(res.body.job).toMatchObject({
      jobId,
      weekId: validWeek1,
      percent: 45,
      status: 'processing',
    });
  });

  it('updates week job status to done and returns export URL', async () => {
    const jobId = 'job-test-sync-2';

    registerJobWeek(jobId, validWeek2);
    finishJob(jobId, 'done', 'https://cdn.example.com/master-w35.mp4');

    const res = await request(app).get(`/api/editor/job/${validWeek2}`);
    expect(res.status).toBe(200);
    expect(res.body.job).toMatchObject({
      jobId,
      weekId: validWeek2,
      percent: 100,
      status: 'done',
      url: 'https://cdn.example.com/master-w35.mp4',
    });
  });

  // Incident : pendant un rendu de trois heures, un second clic sur
  // « Générer le master » prenait la place du premier dans le suivi de la
  // semaine, puis échouait (moteur occupé). Les collègues ne voyaient plus le
  // rendu en cours.
  it('refuse un second master pendant que le premier tourne, sans le masquer', async () => {
    const avant = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = 'montage-essai';
    registerJobWeek('job-premier', validWeek2);
    setProgress('job-premier', 37, 'encoding');
    const res = await request(app)
      .post('/api/editor/concat')
      .set('X-Admin-Password', 'montage-essai')
      .send({ jobId: 'job-second', weekId: validWeek2, clips: [{ filename: 'a.mp4' }] });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/déjà en cours de rendu.*37 %/);
    expect(getWeekActiveJob(validWeek2).jobId).toBe('job-premier');
    finishJob('job-premier', 'error');
    if (avant === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = avant;
  });

  it('PUT /api/editor/timeline/:weekId accepts X-Client-Id and saves workspace', async () => {
    const workspace = {
      clips: [{ filename: 'test.mp4', inPoint: 0, outPoint: 5 }],
      overlays: [],
      branding: { ticker: { enabled: true, text: 'Breaking News' } },
    };

    const res = await request(app)
      .put(`/api/editor/timeline/${validWeek1}`)
      .set('X-Client-Id', 'client-paris-1')
      .send(workspace);

    expect(res.status).toBe(200);
    expect(res.body.workspace).toBeDefined();
    expect(res.body.workspace.clips).toHaveLength(1);

    const getRes = await request(app).get(`/api/editor/timeline/${validWeek1}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.workspace.clips).toHaveLength(1);
    expect(getRes.body.workspace.branding.ticker.text).toBe('Breaking News');
  });
});
