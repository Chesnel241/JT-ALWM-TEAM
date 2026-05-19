import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { COUNTRIES, WEEKS } from '../src/data/constants.js';

let app;

beforeAll(() => {
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

describe('GET /api/countries', () => {
  it('returns the configured countries list', async () => {
    const res = await request(app).get('/api/countries');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(COUNTRIES.length);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });
});

describe('GET /api/weeks', () => {
  it('returns the configured weeks list', async () => {
    const res = await request(app).get('/api/weeks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(WEEKS.length);
  });
});

describe('404 fallback', () => {
  it('returns a 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
