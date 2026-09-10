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


// Concurrence optimiste : deux monteurs peuvent ouvrir la même semaine. Le
// serveur numérote chaque sauvegarde (revision) ; `baseRevision` dit sur
// quelle version le client a travaillé.
describe('concurrence de la timeline (baseRevision)', () => {
  const workspaceDe = (label) => ({
    clips: [{ instanceId: `clip-${label}`, filename: `${label}.mp4`, name: label }],
    overlays: [],
    branding: { logo: true },
  });

  const revisionCourante = async () => {
    const res = await request(app).get(`/api/editor/timeline/${WEEK}`);
    return Number(res.body.workspace?.revision) || 0;
  };

  it('refuse en 409 une sauvegarde basée sur une révision périmée et n’écrit rien', async () => {
    const premier = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send(workspaceDe('monteur-a'));
    expect(premier.status).toBe(200);
    const revisionApresA = premier.body.workspace.revision;

    // Le monteur B avait chargé la version d'AVANT la sauvegarde de A.
    const conflit = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send({ ...workspaceDe('monteur-b'), baseRevision: revisionApresA - 1 });

    expect(conflit.status).toBe(409);
    expect(conflit.body.code).toBe('TIMELINE_CONFLICT');
    expect(typeof conflit.body.message).toBe('string');
    expect(conflit.body.message.length).toBeGreaterThan(0);
    // Le corps rend l'état courant pour que le client puisse fusionner.
    expect(conflit.body.workspace.revision).toBe(revisionApresA);
    expect(conflit.body.workspace.clips[0].filename).toBe('monteur-a.mp4');

    // Rien n'a été écrit : ni le contenu ni la révision n'ont bougé.
    const apres = await request(app).get(`/api/editor/timeline/${WEEK}`);
    expect(apres.body.workspace.revision).toBe(revisionApresA);
    expect(apres.body.workspace.clips[0].filename).toBe('monteur-a.mp4');
  });

  it('accepte une sauvegarde basée sur la révision courante', async () => {
    const base = await revisionCourante();
    const res = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send({ ...workspaceDe('monteur-c'), baseRevision: base });

    expect(res.status).toBe(200);
    expect(res.body.workspace.revision).toBe(base + 1);
    expect(res.body.workspace.clips[0].filename).toBe('monteur-c.mp4');
    // baseRevision est un champ de protocole, pas du projet de montage.
    expect(res.body.workspace).not.toHaveProperty('baseRevision');
  });

  it('reste compatible avec un client qui n’envoie pas baseRevision', async () => {
    const base = await revisionCourante();
    const res = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send(workspaceDe('client-ancien'));

    expect(res.status).toBe(200);
    expect(res.body.workspace.revision).toBe(base + 1);
  });

  it('refuse le second des deux monteurs partis de la même révision', async () => {
    const base = await revisionCourante();

    const premier = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send({ ...workspaceDe('simultane-a'), baseRevision: base });
    const second = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send({ ...workspaceDe('simultane-b'), baseRevision: base });

    expect(premier.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('TIMELINE_CONFLICT');

    const apres = await request(app).get(`/api/editor/timeline/${WEEK}`);
    expect(apres.body.workspace.clips[0].filename).toBe('simultane-a.mp4');
  });

  it('rejette un baseRevision qui n’est pas un entier positif', async () => {
    const res = await request(app)
      .put(`/api/editor/timeline/${WEEK}`)
      .send({ ...workspaceDe('base-invalide'), baseRevision: 'pas-un-nombre' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TIMELINE');
  });
});
