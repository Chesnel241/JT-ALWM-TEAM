import { describe, it, expect, beforeAll, afterEach } from 'vitest';
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
 * l'état de la variable d'environnement. La protection de l'espace montage
 * (ADMIN_PASSWORD) est la seule qui subsiste : elle est décrite en bas de ce
 * fichier, et mise à l'épreuve ailleurs dans la suite (download-token,
 * planning, tus-auth…).
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

/**
 * `/check-admin` est la seule route de ce fichier qui garde quelque chose :
 * c'est elle que le frontend interroge avant d'ouvrir l'espace montage. Elle
 * doit rester une vraie porte même maintenant que les autres sont ouvertes.
 */
describe('GET /api/auth/check-admin', () => {
  const MOT_DE_PASSE = 'secret-montage';
  const precedent = process.env.ADMIN_PASSWORD;

  afterEach(() => {
    if (precedent === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = precedent;
  });

  it('refuse un mauvais mot de passe', async () => {
    process.env.ADMIN_PASSWORD = MOT_DE_PASSE;
    const res = await request(app)
      .get('/api/auth/check-admin')
      .set('X-Admin-Password', 'pas-le-bon');
    expect(res.status).toBe(401);
    expect(res.body.authenticated).toBe(false);
  });

  it('refuse une requête sans mot de passe du tout', async () => {
    process.env.ADMIN_PASSWORD = MOT_DE_PASSE;
    const res = await request(app).get('/api/auth/check-admin');
    expect(res.status).toBe(401);
    expect(res.body.authenticated).toBe(false);
  });

  it('accepte le bon mot de passe', async () => {
    process.env.ADMIN_PASSWORD = MOT_DE_PASSE;
    const res = await request(app)
      .get('/api/auth/check-admin')
      .set('X-Admin-Password', MOT_DE_PASSE);
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
  });
});
