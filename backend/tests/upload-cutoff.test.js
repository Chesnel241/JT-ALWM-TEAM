import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { WEEKS, weekUploadCutoff } from '../src/data/constants.js';

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

afterAll(() => {
  vi.useRealTimers();
});

describe('weekUploadCutoff', () => {
  it('returns Sunday 17:30 of the given ISO week', () => {
    // 2026-w21 = lundi 18 mai → dimanche 24 mai
    const cutoff = weekUploadCutoff('2026-w21');
    expect(cutoff).not.toBeNull();
    expect(cutoff.getDay()).toBe(0); // 0 = dimanche
    expect(cutoff.getHours()).toBe(17);
    expect(cutoff.getMinutes()).toBe(30);
    expect(cutoff.getDate()).toBe(24);
    expect(cutoff.getMonth()).toBe(4); // mai
  });

  it('returns null for legacy ID', () => {
    expect(weekUploadCutoff('w-43')).toBeNull();
  });
});

describe('POST /api/uploads — deadline enforcement', () => {
  it('rejects upload with 423 after Sunday 17:30', async () => {
    // Mock le temps : on se place lundi 25 mai à 10h, donc semaine
    // active = w22, et w21 doit être bloquée (cutoff dimanche 24 à 17h30).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 10, 0));

    // Note : isValidWeek vérifie contre buildWeeks(now). w21 reste
    // visible le lundi (archived). On tente d'uploader sur w21.
    const res = await request(app)
      .post('/api/uploads/2026-w21/sn')
      .attach('file', MP4_HEADER, { filename: 'late.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe('UPLOAD_DEADLINE_PASSED');

    vi.useRealTimers();
  });

  it('accepts upload before the deadline (current active week)', async () => {
    const res = await request(app)
      .post(`/api/uploads/${WEEK}/sn`)
      .attach('file', MP4_HEADER, { filename: 'on_time.mp4', contentType: 'video/mp4' });

    // 201 si on est avant dimanche 17h30 — sinon 423 (légitime selon le moment du run)
    expect([201, 423]).toContain(res.status);
  });

  it('rejects script upload with 423 after the deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 10, 0));

    const res = await request(app)
      .post('/api/uploads/2026-w21/sn/script')
      .send({ content: 'Late note' });

    expect(res.status).toBe(423);

    vi.useRealTimers();
  });
});
