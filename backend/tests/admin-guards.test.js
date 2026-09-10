import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { WEEKS } from '../src/data/constants.js';

const ADMIN_PASSWORD = 'mot-de-passe-montage';
const WEEK = WEEKS.find((week) => week.status === 'active').id;

let app;

// requireAdmin laisse tout passer quand NODE_ENV === 'test' (IS_TEST dans
// middleware/auth.js, figé à l'import). Sous NODE_ENV=test ces tests
// passeraient donc même si les routes n'étaient PAS protégées : on remonte
// une application dans un registre de modules neuf, hors mode test, pour
// vérifier la vraie garde. On reste en 'development' et pas en 'production'
// (celle-ci exige WORKER_KEY/GLOBAL_PASSWORD pour signer les tokens).
beforeAll(async () => {
  vi.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  const { createApp } = await import('../src/app.js');
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

afterAll(() => {
  // Le pool vitest est mono-processus : sans restauration, les fichiers de
  // tests suivants tourneraient hors mode test.
  process.env.NODE_ENV = 'test';
  delete process.env.ADMIN_PASSWORD;
  vi.resetModules();
});

describe('opérations à fort impact réservées à l’équipe montage', () => {
  it('refuse la publication du JT sans mot de passe admin', async () => {
    const res = await request(app).post(`/api/deliveries/${WEEK}`);
    expect(res.status).toBe(403);
  });

  it('refuse la publication du JT avec un mauvais mot de passe admin', async () => {
    const res = await request(app)
      .post(`/api/deliveries/${WEEK}`)
      .set('X-Admin-Password', 'pas-le-bon');
    expect(res.status).toBe(403);
  });

  it('laisse passer la publication du JT avec le bon mot de passe admin', async () => {
    // 400 (aucun fichier reçu) et non 403 : la garde a bien laissé passer.
    const res = await request(app)
      .post(`/api/deliveries/${WEEK}`)
      .set('X-Admin-Password', ADMIN_PASSWORD);
    expect(res.status).toBe(400);
  });

  it('refuse la suppression d’un JT sans mot de passe admin (garde préexistante)', async () => {
    const res = await request(app)
      .delete(`/api/deliveries/${WEEK}/00000000-0000-4000-8000-000000000000`);
    expect(res.status).toBe(403);
  });

  it('refuse l’écrasement de la timeline sans mot de passe admin', async () => {
    const res = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send({ clips: [], overlays: [], branding: {} });
    expect(res.status).toBe(403);
  });

  it('laisse passer l’écrasement de la timeline avec le bon mot de passe admin', async () => {
    const res = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .set('X-Admin-Password', ADMIN_PASSWORD)
      .send({ clips: [], overlays: [], branding: {} });
    expect(res.status).toBe(200);
    expect(res.body.workspace.revision).toBeGreaterThan(0);
  });

  it('refuse le lancement d’un rendu ffmpeg sans mot de passe admin', async () => {
    const res = await request(app)
      .post('/api/editor/concat')
      .send({ clips: [{ filename: 'rush.mp4' }], jobId: 'job-sans-admin' });
    expect(res.status).toBe(403);
  });

  it('laisse passer /concat avec le bon mot de passe admin (rejet 400 sur le payload)', async () => {
    // Payload volontairement vide : la garde passe, la validation refuse —
    // aucun rendu ffmpeg n'est déclenché par le test.
    const res = await request(app)
      .post('/api/editor/concat')
      .set('X-Admin-Password', ADMIN_PASSWORD)
      .send({});
    expect(res.status).toBe(400);
  });

  it('laisse les routes de lecture ouvertes (l’API reste publique)', async () => {
    const timeline = await request(app).get(`/api/editor/timeline/${WEEK}`);
    expect(timeline.status).toBe(200);
    const deliveries = await request(app).get(`/api/deliveries/${WEEK}`);
    expect(deliveries.status).toBe(200);
  });
});
