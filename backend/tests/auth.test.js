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
    const cookies = res.headers['set-cookie'];
    expect(cookies?.join(' ')).toMatch(/jt-auth=/);
    expect(cookies?.join(' ')).toMatch(/HttpOnly/i);
  });
});

describe('GET /api/auth/check', () => {
  it('returns 401 without cookie', async () => {
    const res = await request(app).get('/api/auth/check');
    expect(res.status).toBe(401);
    expect(res.body.authenticated).toBe(false);
  });

  it('returns 200 with valid cookie', async () => {
    const res = await request(app)
      .get('/api/auth/check')
      .set('Cookie', ['jt-auth=ok']);
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] || [];
    // clearCookie sets it with an expired date and empty value
    expect(cookies.join(' ')).toMatch(/jt-auth=;/);
  });
});
