import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

let app;
const ORIG_ADMIN = process.env.ADMIN_PASSWORD;
const ORIG_GLOBAL = process.env.GLOBAL_PASSWORD;

beforeAll(() => {
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

afterAll(() => {
  // Restore env pour ne pas polluer les autres suites (auth.test.js,
  // routes.test.js, etc. lisent ces variables au runtime).
  if (ORIG_ADMIN === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = ORIG_ADMIN;
  if (ORIG_GLOBAL === undefined) delete process.env.GLOBAL_PASSWORD;
  else process.env.GLOBAL_PASSWORD = ORIG_GLOBAL;
});

// Crée un faux fichier sur disque + l'enregistre dans le store sous une
// semaine/pays donnés (utile pour valider les protections IDOR).
async function seedUpload({ weekId, countryId, filename, name }) {
  const dir = join(TEST_UPLOADS_DIR);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, filename))) {
    writeFileSync(join(dir, filename), 'fake bytes');
  }
  const { addUpload, flushStore } = await import('../src/data/store.js');
  addUpload(weekId, countryId, {
    id: `seed-${filename}`,
    name,
    filename,
    type: 'video',
    size: 9,
    status: 'pending',
    uploadedAt: new Date().toISOString(),
  });
  await flushStore();
}

describe('CORS sur /uploads (Remotion Video crossOrigin)', () => {
  it('renvoie Access-Control-Allow-Origin sur HEAD', async () => {
    const res = await request(app).head('/uploads/anything.mp4');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('OPTIONS preflight → 204 + headers CORS', async () => {
    const res = await request(app).options('/uploads/anything.mp4');
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toMatch(/GET/i);
  });

  it('expose Accept-Ranges / Content-Range (Range requests vidéo)', async () => {
    const res = await request(app).options('/uploads/anything.mp4');
    expect(res.headers['access-control-expose-headers']).toMatch(/Content-Range/i);
  });
});

describe('IDOR /api/presigned/download — autorité = métadonnée serveur', () => {
  const W = '2026-w22';
  const F_MJ = 'mj-secret-file.mp4';
  const F_NORMAL = 'normal-file.mp4';

  beforeAll(async () => {
    process.env.ADMIN_PASSWORD = 'admin-secret';
    process.env.GLOBAL_PASSWORD = 'global-secret';
    await seedUpload({ weekId: W, countryId: 'mj', filename: F_MJ, name: F_MJ });
    await seedUpload({ weekId: W, countryId: 'sn', filename: F_NORMAL, name: F_NORMAL });
  });

  it('rejette filename non-safe (path traversal)', async () => {
    const res = await request(app)
      .get('/api/presigned/download')
      .query({ filename: '../etc/passwd' })
      .set('X-App-Password', 'global-secret');
    expect([400, 401]).toContain(res.status);
  });

  it('refuse fichier mj sans mot de passe admin (IDOR confirmée)', async () => {
    const res = await request(app)
      .get('/api/presigned/download')
      .query({ filename: F_MJ })
      .set('X-App-Password', 'global-secret');
    // Confirme : malgré l'absence de ?countryId=mj côté client, la métadonnée
    // serveur impose ADMIN.
    expect(res.status).toBe(403);
  });

  it('autorise fichier mj avec X-Admin-Password', async () => {
    const res = await request(app)
      .get('/api/presigned/download')
      .query({ filename: F_MJ })
      .set('X-App-Password', 'global-secret')
      .set('X-Admin-Password', 'admin-secret');
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
  });

  it('autorise fichier non-mj sans admin', async () => {
    const res = await request(app)
      .get('/api/presigned/download')
      .query({ filename: F_NORMAL })
      .set('X-App-Password', 'global-secret');
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
  });
});
