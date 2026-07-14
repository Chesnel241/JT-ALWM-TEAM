import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { WEEKS } from '../src/data/constants.js';
import { TEST_UPLOADS_DIR } from './setup.js';

let app;
const WEEK = WEEKS.find((week) => week.status === 'active').id;

beforeAll(() => {
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

describe('projet de montage partagé', () => {
  it('retourne une timeline absente avant la première sauvegarde', async () => {
    const response = await request(app).get(`/api/editor/timeline/${WEEK}`);
    expect(response.status).toBe(200);
    expect(response.body.workspace).toBeNull();
  });

  it('sauvegarde puis restitue clips, titres et habillage', async () => {
    const workspace = {
      clips: [{
        instanceId: 'clip-pc-a',
        filename: 'rush-partage.mp4',
        name: 'Rush partagé',
        inPoint: 1.25,
        outPoint: 8.5,
      }],
      overlays: [{ id: 'title-1', templateId: 'lower_third', startTime: 2, duration: 3 }],
      branding: { logo: true, logoPosition: 'tr', ticker: { enabled: false } },
    };

    const saved = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send(workspace);
    expect(saved.status).toBe(200);
    expect(saved.body.workspace.revision).toBeGreaterThan(0);
    expect(saved.body.workspace.updatedAt).toBeTruthy();

    const restored = await request(app).get(`/api/editor/timeline/${WEEK}`);
    expect(restored.status).toBe(200);
    expect(restored.body.workspace.clips).toEqual(workspace.clips);
    expect(restored.body.workspace.overlays).toEqual(workspace.overlays);
    expect(restored.body.workspace.branding).toEqual(workspace.branding);
  });

  it('n’expose pas la timeline comme un chutier de rushs', async () => {
    const dashboard = await request(app).get(`/api/uploads/${WEEK}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body).not.toHaveProperty('_timeline');
  });

  it('refuse les projets invalides et les semaines inconnues', async () => {
    const invalid = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send({ clips: 'incorrect', overlays: [], branding: {} });
    expect(invalid.status).toBe(400);

    const unknown = await request(app).get('/api/editor/timeline/2099-w99');
    expect(unknown.status).toBe(404);
  });
});
