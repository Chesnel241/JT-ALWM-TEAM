import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { WEEKS } from '../src/data/constants.js';

let app;
const WEEK = WEEKS.find((w) => w.status === 'active').id;

const MP4_HEADER = Buffer.from([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x02, 0x00,
  0x69, 0x73, 0x6f, 0x6d,
  0x69, 0x73, 0x6f, 0x32,
]);

beforeAll(() => {
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

describe('GET /api/deliveries/:weekId', () => {
  it('returns 404 for an unknown week', async () => {
    const res = await request(app).get('/api/deliveries/w-999');
    expect(res.status).toBe(404);
  });

  it('returns an empty array for an active week with no delivery', async () => {
    const res = await request(app).get(`/api/deliveries/${WEEK}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/deliveries/:weekId', () => {
  it('rejects upload on an unknown week', async () => {
    const res = await request(app)
      .post('/api/deliveries/w-999')
      .attach('file', MP4_HEADER, { filename: 'jt.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(404);
  });

  it('rejects a forbidden extension', async () => {
    const res = await request(app)
      .post(`/api/deliveries/${WEEK}`)
      .attach('file', Buffer.from('fake'), {
        filename: 'jt.exe',
        contentType: 'application/octet-stream',
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('accepts a valid MP4 delivery', async () => {
    const res = await request(app)
      .post(`/api/deliveries/${WEEK}`)
      .attach('file', MP4_HEADER, {
        filename: 'jt_montage_final.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('jt_montage_final.mp4');
    expect(res.body.type).toBe('video');
    expect(res.body).toHaveProperty('uploadedAt');
  });

  it('subsequent GET returns the uploaded delivery', async () => {
    const list = await request(app).get(`/api/deliveries/${WEEK}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThan(0);
    expect(list.body[0].type).toBe('video');
  });
});

describe('DELETE /api/deliveries/:weekId/:fileId', () => {
  it('rejects an invalid UUID', async () => {
    const res = await request(app).delete(`/api/deliveries/${WEEK}/not-a-uuid`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown fileId', async () => {
    const res = await request(app).delete(
      `/api/deliveries/${WEEK}/00000000-0000-4000-8000-000000000000`
    );
    expect(res.status).toBe(404);
  });

  it('removes an existing delivery', async () => {
    const created = await request(app)
      .post(`/api/deliveries/${WEEK}`)
      .attach('file', MP4_HEADER, { filename: 'to_delete.mp4', contentType: 'video/mp4' });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const del = await request(app).delete(`/api/deliveries/${WEEK}/${id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get(`/api/deliveries/${WEEK}`);
    expect(list.body.find((f) => f.id === id)).toBeUndefined();
  });
});

describe('Deliveries vs rushes: isolation', () => {
  it('GET /api/uploads/:weekId does not include the _delivery key', async () => {
    // Crée une delivery, puis vérifie qu'elle n'apparaît pas dans la
    // liste "rushes par pays".
    await request(app)
      .post(`/api/deliveries/${WEEK}`)
      .attach('file', MP4_HEADER, { filename: 'iso_check.mp4', contentType: 'video/mp4' });

    const dashboard = await request(app).get(`/api/uploads/${WEEK}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body).not.toHaveProperty('_delivery');
  });
});
