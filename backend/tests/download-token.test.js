import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as store from '../src/data/store.js';
import { generateDownloadToken, verifyDownloadToken } from '../src/lib/downloadTokens.js';

let prevAdmin;
let prevWorkerKey;

beforeAll(() => {
  prevAdmin = process.env.ADMIN_PASSWORD;
  prevWorkerKey = process.env.WORKER_KEY;
  process.env.ADMIN_PASSWORD = 'admin-test';
  process.env.WORKER_KEY = process.env.WORKER_KEY || 'unit-test-secret';
});

afterAll(() => {
  if (prevAdmin === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = prevAdmin;
  if (prevWorkerKey === undefined) delete process.env.WORKER_KEY;
  else process.env.WORKER_KEY = prevWorkerKey;
});

describe('POST /api/uploads/download-token', () => {
  /**
   * Sécurité — avant ce route, le frontend mettait le mot de passe admin
   * en clair dans ?adminPassword=… → fuite dans logs/historique/proxy.
   * Désormais le frontend demande un token signé HMAC (1h, lié au
   * filename) et l'utilise dans l'URL à la place du mot de passe.
   */
  // Pas de test d'auth ici : NODE_ENV=test bypasse requireAuth/requireAdmin
  // dans middleware/auth.js. Les tests d'auth admin sont couverts par
  // security.test.js + en intégration prod.

  it('refuse un filename non sanitizable', async () => {
    const app = createApp({ enableMonitoring: false });
    const r = await request(app)
      .post('/api/uploads/download-token')
      .set('X-App-Password', 'global-test')
      .set('X-Admin-Password', 'admin-test')
      .send({ filename: '../../etc/passwd' });
    expect(r.status).toBe(400);
  });

  it("retourne un token pour un filename suivi par le store", async () => {
    vi.spyOn(store, 'getFileMetadata').mockReturnValue({ countryId: 'mj', name: 'master.mp4' });
    try {
      const app = createApp({ enableMonitoring: false });
      const r = await request(app)
        .post('/api/uploads/download-token')
        .set('X-App-Password', 'global-test')
        .set('X-Admin-Password', 'admin-test')
        .send({ filename: 'export_abc.mp4' });
      expect(r.status).toBe(200);
      expect(r.body.token).toMatch(/^export_abc\.mp4:\d+:[0-9a-f]{64}$/);
      expect(verifyDownloadToken(r.body.token, 'export_abc.mp4')).toBe(true);
    } finally {
      store.getFileMetadata.mockRestore?.();
    }
  });

  it("refuse 404 si le filename n'est pas dans le store", async () => {
    vi.spyOn(store, 'getFileMetadata').mockReturnValue(null);
    try {
      const app = createApp({ enableMonitoring: false });
      const r = await request(app)
        .post('/api/uploads/download-token')
        .set('X-App-Password', 'global-test')
        .set('X-Admin-Password', 'admin-test')
        .send({ filename: 'unknown.mp4' });
      expect(r.status).toBe(404);
    } finally {
      store.getFileMetadata.mockRestore?.();
    }
  });
});

describe('verifyDownloadToken — primitives anti-rejouage', () => {
  it("refuse un token signé pour un autre filename (lié à la cible)", () => {
    const tok = generateDownloadToken('export_a.mp4');
    expect(verifyDownloadToken(tok, 'export_a.mp4')).toBe(true);
    expect(verifyDownloadToken(tok, 'export_b.mp4')).toBe(false);
  });

  it('refuse un token expiré', () => {
    const tok = `master.mp4:${Date.now() - 1000}:` + 'f'.repeat(64);
    expect(verifyDownloadToken(tok, 'master.mp4')).toBe(false);
  });

  it('refuse une signature forgée', () => {
    const tok = `master.mp4:${Date.now() + 60000}:` + 'f'.repeat(64);
    expect(verifyDownloadToken(tok, 'master.mp4')).toBe(false);
  });
});
