import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';

/**
 * Ce que le monteur a réellement sous les yeux quand il coche.
 *
 * L'écran listait quinze lignes dans l'ordre de création, tous pays mêlés,
 * dont neuf sans aucun fichier — proposées à la coche et comptées dans la
 * jauge « 0 / 15 monté ». Un sujet sans rush ne peut pourtant pas être monté,
 * et un compteur qui l'ignore est un chiffre faux.
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

function lireSujets() {
  return request(app).get(`/api/planning/${SEMAINE}/sujets`).set('X-Admin-Password', ADMIN);
}

describe('le conducteur vu par le monteur', () => {
  let avecRush;
  let sansRush;

  beforeAll(() => {
    // Deux pays, créés dans l'ordre inverse de l'alphabet pour vérifier le
    // regroupement, et un sujet qui n'a rien reçu.
    const dakar = store.createSujet(SEMAINE, 'sn', { titre: 'Le port de Dakar' });
    avecRush = store.createSujet(SEMAINE, 'cm', { titre: 'Le marché de Douala' });
    sansRush = store.createSujet(SEMAINE, 'cm', { titre: 'Annoncé, jamais envoyé' });

    store.addUpload(SEMAINE, 'cm', {
      id: 'f1', name: 'plan-large.mp4', filename: 'plan-large.mp4',
      type: 'video', size: '12 MB', status: 'pending', sujetId: avecRush.id, duree: 62,
    });
    store.addUpload(SEMAINE, 'cm', {
      id: 'f2', name: 'interview.mp4', filename: 'interview.mp4',
      type: 'video', size: '30 MB', status: 'pending', sujetId: avecRush.id, duree: 40,
    });
    store.addUpload(SEMAINE, 'sn', {
      id: 'f3', name: 'port.mp4', filename: 'port.mp4',
      type: 'video', size: '8 MB', status: 'pending', sujetId: dakar.id, duree: null,
    });
  });

  it('dit combien de pièces chaque sujet a reçues', async () => {
    const res = await lireSujets();
    expect(res.status).toBe(200);
    const parId = Object.fromEntries(res.body.map((s) => [s.id, s]));
    expect(parId[avecRush.id].nbPieces).toBe(2);
    expect(parId[sansRush.id].nbPieces).toBe(0);
  });

  it('additionne les durées connues du sujet', async () => {
    const res = await lireSujets();
    const sujet = res.body.find((s) => s.id === avecRush.id);
    expect(sujet.duree).toBe(102);
  });

  it('rend une durée nulle plutôt que zéro quand rien n’a pu être mesuré', async () => {
    // « 0 s » ferait croire à un rush vide au monteur qui parcourt la liste.
    const res = await lireSujets();
    expect(res.body.find((s) => s.id === sansRush.id).duree).toBeNull();
    // Un fichier bien reçu mais non mesurable donne le même verdict honnête.
    const dakar = res.body.find((s) => s.titre === 'Le port de Dakar');
    expect(dakar.nbPieces).toBe(1);
    expect(dakar.duree).toBeNull();
  });

  it('groupe les sujets par pays au lieu de les entremêler', async () => {
    // Ils arrivaient dans l'ordre de création : le monteur sautait du
    // Cameroun au Sénégal puis au Togo pour revenir au Cameroun.
    const res = await lireSujets();
    const pays = res.body.map((s) => s.countryId);
    const sansRepetition = pays.filter((p, i) => p !== pays[i - 1]);
    expect(new Set(sansRepetition).size).toBe(sansRepetition.length);
  });

  it('garde l’ordre d’arrivée à l’intérieur d’un pays', async () => {
    const res = await lireSujets();
    const cameroun = res.body.filter((s) => s.countryId === 'cm').map((s) => s.titre);
    expect(cameroun.indexOf('Le marché de Douala'))
      .toBeLessThan(cameroun.indexOf('Annoncé, jamais envoyé'));
  });

  it('reste réservé à l’équipe montage', async () => {
    const res = await request(app).get(`/api/planning/${SEMAINE}/sujets`);
    expect(res.status).toBe(403);
  });
});
