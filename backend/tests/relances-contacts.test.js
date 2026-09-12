import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';

/**
 * Les deux corvées hebdomadaires de l'équipe montage, outillées.
 *
 * Relancer : la plateforme savait déjà qui n'avait rien envoyé, et à quel
 * numéro écrire — sans jamais mettre les deux côte à côte.
 *
 * Les numéros : ils étaient rangés POUR UNE SEMAINE, si bien que la liste
 * repartait vide chaque lundi et que le bloc « prévenir les pays » n'avait
 * plus personne à prévenir.
 */

const ADMIN = 'mot-de-passe-montage';
const SEMAINE = '2026-w37';

let app;
let store;

beforeAll(async () => {
  vi.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_PASSWORD = ADMIN;

  store = await import('../src/data/store.js');
  const { createApp } = await import('../src/app.js');
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});

afterAll(() => {
  process.env.NODE_ENV = 'test';
  delete process.env.ADMIN_PASSWORD;
  vi.resetModules();
});

const admin = (r) => r.set('X-Admin-Password', ADMIN);

describe('le carnet de contacts', () => {
  it('garde un numéro par pays, en dehors des semaines', async () => {
    await admin(request(app).put('/api/notifications/contacts/cm')).send({ phone: '+237 6 99 00 11 22' });

    const res = await admin(request(app).get('/api/notifications/contacts'));
    expect(res.status).toBe(200);
    // Les espaces et la mise en forme sont nettoyés : c'est un numéro à
    // composer, pas un texte à afficher tel quel.
    expect(res.body.cm.phone).toBe('+237699001122');
  });

  it('ressort le numéro sur une semaine où personne ne l’a reconfirmé', async () => {
    const res = await admin(request(app).get('/api/notifications/2026-w38'));
    const cameroun = res.body.find((s) => s.countryId === 'cm');
    expect(cameroun.phone).toBe('+237699001122');
    // Marqué comme repris : il n'a pas été reconfirmé cette semaine-là, et
    // le correspondant a pu changer de téléphone depuis.
    expect(cameroun.origine).toBe('contact');
  });

  it('refuse un numéro inutilisable plutôt que de l’enregistrer', async () => {
    const res = await admin(request(app).put('/api/notifications/contacts/sn')).send({ phone: '12' });
    expect(res.status).toBe(400);
  });

  it('refuse un pays inconnu', async () => {
    const res = await admin(request(app).put('/api/notifications/contacts/zz')).send({ phone: '+33600000000' });
    expect(res.status).toBe(400);
  });

  it('reste réservé à l’équipe montage', async () => {
    expect((await request(app).get('/api/notifications/contacts')).status).toBe(403);
    expect((await request(app).put('/api/notifications/contacts/cm').send({ phone: '+33600000000' })).status).toBe(403);
  });

  it('s’efface quand on le demande', async () => {
    await admin(request(app).put('/api/notifications/contacts/ci')).send({ phone: '+225070000000' });
    expect((await admin(request(app).delete('/api/notifications/contacts/ci'))).status).toBe(204);
    const res = await admin(request(app).get('/api/notifications/contacts'));
    expect(res.body.ci).toBeUndefined();
  });
});

describe('la liste de relance', () => {
  beforeAll(() => {
    // Le Cameroun a sa vidéo : il est en règle. Le Sénégal a envoyé une photo
    // seulement — reçu, mais rien à monter.
    store.addUpload(SEMAINE, 'cm', {
      id: 'v1', name: 'sujet.mp4', filename: 'sujet.mp4',
      type: 'video', size: '20 MB', status: 'pending',
    });
    store.addUpload(SEMAINE, 'sn', {
      id: 'p1', name: 'photo.jpg', filename: 'photo.jpg',
      type: 'image', size: '2 MB', status: 'pending',
    });
  });

  it('écarte le pays qui a envoyé sa vidéo', async () => {
    const res = await admin(request(app).get(`/api/notifications/${SEMAINE}/relances`));
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.countryId)).not.toContain('cm');
  });

  it('garde le pays qui a envoyé sans vidéo, en disant ce qui manque', async () => {
    // Une photo n'est pas un reportage : ce pays passait pour servi.
    const res = await admin(request(app).get(`/api/notifications/${SEMAINE}/relances`));
    const senegal = res.body.find((p) => p.countryId === 'sn');
    expect(senegal.manque).toBe('sans_video');
    expect(senegal.nbFichiers).toBe(1);
    expect(senegal.nbVideos).toBe(0);
  });

  it('joint le numéro à écrire, pour que la relance tienne en un geste', async () => {
    const res = await admin(request(app).get(`/api/notifications/${SEMAINE}/relances`));
    const senegal = res.body.find((p) => p.countryId === 'sn');
    expect(senegal.nom).toBeTruthy();
    // Le carnet a été rempli plus haut pour le Cameroun seulement : le
    // Sénégal ressort donc sans numéro, et l'écran doit pouvoir le dire.
    expect(typeof senegal.phone).toBe('string');
  });

  it('n’inclut jamais les tiroirs du journal', async () => {
    const res = await admin(request(app).get(`/api/notifications/${SEMAINE}/relances`));
    const ids = res.body.map((p) => p.countryId);
    expect(ids).not.toContain('tj');
    expect(ids).not.toContain('mj');
  });

  it('reste réservée à l’équipe montage', async () => {
    const res = await request(app).get(`/api/notifications/${SEMAINE}/relances`);
    expect(res.status).toBe(403);
  });
});

describe('les demandes de délai', () => {
  it('sont visibles par l’équipe montage, la plus ancienne d’abord', async () => {
    // Elles n'apparaissaient que dans l'onglet Statistiques : le
    // correspondant attendait une réponse qui ne venait pas.
    store.requestExtension(SEMAINE, 'tg');
    store.requestExtension(SEMAINE, 'ma');

    const res = await admin(request(app).get(`/api/delays/${SEMAINE}/demandes`));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toHaveProperty('nom');
    expect(res.body[0]).toHaveProperty('demandeLe');
  });

  it('ne montre plus une demande déjà accordée', async () => {
    store.approveExtension(SEMAINE, 'tg', 60);
    const res = await admin(request(app).get(`/api/delays/${SEMAINE}/demandes`));
    expect(res.body.map((d) => d.countryId)).not.toContain('tg');
  });

  it('restent réservées à l’équipe montage', async () => {
    const res = await request(app).get(`/api/delays/${SEMAINE}/demandes`);
    expect(res.status).toBe(403);
  });
});
