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

