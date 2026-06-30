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

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('metrics');
  });
});

describe('GET /metrics', () => {
  it('returns 200 with metrics payload', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uploads');
    expect(res.body).toHaveProperty('memory');
  });
});
