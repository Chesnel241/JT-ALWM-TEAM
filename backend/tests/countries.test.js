import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { existsSync, rmSync } from 'fs';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { COUNTRIES } from '../src/data/constants.js';

let app;
const STORE_PATH = process.env.JT_STORE_PATH;

beforeAll(() => {
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

beforeEach(() => {
  // On nettoie uniquement la clé _countries — on garde les éventuels
  // uploads des autres tests pour ne pas casser leur isolation.
  if (STORE_PATH && existsSync(STORE_PATH)) {
    // Pas de manipulation directe : le store charge à l'import, donc
    // on accepte l'état accumulé. Les tests utilisent des codes/ids
    // uniques pour éviter les collisions.
  }
});

describe('GET /api/countries', () => {
  it('returns at least the defaults', async () => {
    const res = await request(app).get('/api/countries');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(COUNTRIES.length);
  });
});

describe('POST /api/countries — validation', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/countries').send({});
    expect(res.status).toBe(422);
  });

  it('normalises uppercase id to lowercase', async () => {
    // id 'NORM-1' devient 'norm-1' avant validation → 201
    const res = await request(app)
      .post('/api/countries')
      .send({ id: 'NORM-1', name: 'Norm one', code: 'NM1' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('norm-1');
  });

  it('normalises lowercase code to uppercase', async () => {
    const res = await request(app)
      .post('/api/countries')
      .send({ id: 'norm-2', name: 'Norm two', code: 'nm2' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('NM2');
  });

  it('rejects name too long', async () => {
    const res = await request(app)
      .post('/api/countries')
      .send({ id: 'longname', name: 'x'.repeat(200), code: 'XX' });
    expect(res.status).toBe(422);
  });

  it('rejects id with special characters', async () => {
    const res = await request(app)
      .post('/api/countries')
      .send({ id: 'bj!', name: 'Bénin', code: 'BJ' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/countries — create', () => {
  it('creates a valid country and lists it', async () => {
    const payload = { id: 'bj-test', name: 'Bénin (test)', code: 'BJT' };
    const res = await request(app).post('/api/countries').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('bj-test');

    const list = await request(app).get('/api/countries');
    expect(list.body.find((c) => c.id === 'bj-test')).toBeDefined();
  });

  it('rejects an id that already exists', async () => {
    // 'sn' est dans la liste par défaut
    const res = await request(app)
      .post('/api/countries')
      .send({ id: 'sn', name: 'Doublon', code: 'XYZ' });
    expect(res.status).toBe(400);
  });

  it('rejects a code that already exists', async () => {
    const res = await request(app)
      .post('/api/countries')
      .send({ id: 'sn-other', name: 'Autre', code: 'SN' });
    expect(res.status).toBe(400);
  });

  it('accepts an id with digits and hyphens', async () => {
    const res = await request(app)
      .post('/api/countries')
      .send({ id: 'ml-2', name: 'Mali', code: 'ML2' });
    expect(res.status).toBe(201);
  });
});
