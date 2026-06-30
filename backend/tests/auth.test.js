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

describe('POST /api/auth/login', () => {
  it('rejects empty password with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('accepts any password when GLOBAL_PASSWORD unset (dev/test)', async () => {
    delete process.env.GLOBAL_PASSWORD;
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'whatever' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe('dev-noauth');
  });
});

describe('GET /api/auth/check', () => {
  it('returns 401 without header', async () => {
    process.env.GLOBAL_PASSWORD = 'test-password';
    const res = await request(app).get('/api/auth/check');
    expect(res.status).toBe(401);
    expect(res.body.authenticated).toBe(false);
  });

  it('returns 200 with valid header', async () => {
    process.env.GLOBAL_PASSWORD = 'test-password';
    const res = await request(app)
      .get('/api/auth/check')
      .set('X-App-Password', 'test-password');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns success', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
