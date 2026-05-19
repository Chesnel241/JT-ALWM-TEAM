import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { rmSync } from 'fs';
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

afterAll(() => {
  try {
    rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
});

// Magic number minimal d'un MP4 valide : 4 octets size + 'ftyp' + 4 octets brand
const MP4_HEADER = Buffer.from([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70, // 'ftyp'
  0x69, 0x73, 0x6f, 0x6d, // 'isom'
  0x00, 0x00, 0x02, 0x00,
  0x69, 0x73, 0x6f, 0x6d,
  0x69, 0x73, 0x6f, 0x32,
]);

describe('POST /api/uploads/:weekId/:countryId', () => {
  it('rejects upload on an unknown week', async () => {
    const res = await request(app)
      .post('/api/uploads/w-999/sn')
      .attach('file', MP4_HEADER, { filename: 'test.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(404);
  });

  it('rejects upload on an unknown country', async () => {
    const res = await request(app)
      .post('/api/uploads/w-43/zz')
      .attach('file', MP4_HEADER, { filename: 'test.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(404);
  });

  it('rejects a forbidden extension', async () => {
    const res = await request(app)
      .post('/api/uploads/w-43/sn')
      .attach('file', Buffer.from('fake exe'), {
        filename: 'malware.exe',
        contentType: 'application/octet-stream',
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects a file whose magic number does not match the extension', async () => {
    const fakeMp4 = Buffer.from('this is not a real mp4 content');
    const res = await request(app)
      .post('/api/uploads/w-43/sn')
      .attach('file', fakeMp4, {
        filename: 'fake.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(415);
  });

  it('accepts a valid MP4 upload', async () => {
    const res = await request(app)
      .post('/api/uploads/w-43/sn')
      .attach('file', MP4_HEADER, {
        filename: 'real_video.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('real_video.mp4');
    expect(res.body.type).toBe('video');
  });
});

describe('POST /api/uploads/:weekId/:countryId/script', () => {
  it('rejects empty script content', async () => {
    const res = await request(app)
      .post('/api/uploads/w-43/sn/script')
      .send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('accepts a non-empty script', async () => {
    const res = await request(app)
      .post('/api/uploads/w-43/sn/script')
      .send({ content: 'Lead du jour : reportage ALWM.' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('script');
  });
});

describe('DELETE /api/uploads/:weekId/:countryId/:fileId', () => {
  it('rejects a non-UUID fileId', async () => {
    const res = await request(app).delete('/api/uploads/w-43/sn/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown fileId', async () => {
    const res = await request(app).delete(
      '/api/uploads/w-43/sn/00000000-0000-4000-8000-000000000000'
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/uploads/:weekId/:countryId', () => {
  it('returns the list of uploads for a country', async () => {
    const res = await request(app).get('/api/uploads/w-43/sn');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
