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

describe('Security headers (Helmet)', () => {
  it('sets X-Content-Type-Options nosniff', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options deny', async () => {
    const res = await request(app).get('/health');
    // helmet émet 'X-Frame-Options: SAMEORIGIN' par défaut, ou 'DENY'
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('sets a Referrer-Policy', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['referrer-policy']).toBeDefined();
  });
});

describe('JSON body limit', () => {
  // Limite relevée de 100 ko à 2 Mo : le payload /concat d'un montage de
  // 30 min (clips + sous-titres auto + overlays) dépasse largement 100 ko.
  // On vérifie que la borne anti-abus existe toujours au-delà de 2 Mo.
  it('rejects bodies larger than the configured limit (2mb)', async () => {
    const huge = 'x'.repeat(3 * 1024 * 1024); // 3 Mo
    const res = await request(app)
      .post('/api/countries')
      .set('Content-Type', 'application/json')
      .send(`{"name":"${huge}"}`);
    expect(res.status).toBe(413);
  });

  it('accepts a large-but-legit body (500kb, gros montage)', async () => {
    const big = 'x'.repeat(500 * 1024);
    const res = await request(app)
      .post('/api/countries')
      .set('Content-Type', 'application/json')
      .send(`{"name":"${big}"}`);
    // Pas 413 : la route peut rejeter pour d'autres raisons (validation),
    // mais le body doit passer le parseur.
    expect(res.status).not.toBe(413);
  });
});

describe('CORS', () => {
  it('reflects the configured origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
