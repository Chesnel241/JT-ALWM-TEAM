import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';

let app;

beforeAll(() => {
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

/**
 * Le mot de passe de session global (GLOBAL_PASSWORD) a été retiré (décision
 * produit) : ces routes n'authentifient plus jamais personne, quel que soit
 * l'état de la variable d'environnement. requireAdmin (ADMIN_PASSWORD) reste
 * inchangé — voir tests/download-token.test.js et le reste de la suite pour
 * sa couverture.
 */
describe('POST /api/auth/login', () => {
  it('accepte toujours, sans exiger de body', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepte toujours, même avec GLOBAL_PASSWORD configuré en env', async () => {
    process.env.GLOBAL_PASSWORD = 'test-password';
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'nimporte-quoi' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    delete process.env.GLOBAL_PASSWORD;
  });
});

describe('GET /api/auth/check', () => {
  it('authentifié même sans header (plus de mot de passe de session)', async () => {
    const res = await request(app).get('/api/auth/check');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
  });

  it('authentifié même avec GLOBAL_PASSWORD configuré en env (le check est retiré du code)', async () => {
    process.env.GLOBAL_PASSWORD = 'test-password';
    const res = await request(app).get('/api/auth/check');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    delete process.env.GLOBAL_PASSWORD;
  });
});

describe('POST /api/auth/logout', () => {
  it('returns success', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('requireAuth (middleware) — no-op après retrait du mot de passe global', () => {
  it('laisse passer une route protégée sans aucun header, même avec GLOBAL_PASSWORD en env', async () => {
    process.env.GLOBAL_PASSWORD = 'test-password';
    const res = await request(app).get('/api/weeks');
    expect(res.status).not.toBe(401);
    delete process.env.GLOBAL_PASSWORD;
  });
});
