import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';

/**
 * Deux numérotations pour la même semaine.
 *
 * L'application range et affiche par semaine ISO — « Semaine 37 », qui sert
 * de clé partout — tandis que la rédaction compte ses éditions, « Sem. 18 ».
 * Le décalage est de 19, et il n'est écrit nulle part : devant deux écrans
 * côte à côte, personne ne savait s'il regardait deux semaines ou une seule.
 * La liste des semaines porte donc les deux.
 */

let app;
let store;
let semaines;

beforeAll(async () => {
  vi.resetModules();
  store = await import('../src/data/store.js');
  const { createApp } = await import('../src/app.js');
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });

  const { buildWeeks } = await import('../src/data/constants.js');
  semaines = buildWeeks();
  // Une seule des semaines visibles est programmée : l'autre sert de témoin.
  store.affecterSemaine(semaines.find((s) => s.status === 'active').id, { libelle: 'Sem. 18' });
});

afterAll(() => {
  vi.resetModules();
});

describe('GET /api/weeks — le libellé de la rédaction accompagne le numéro ISO', () => {
  it('rend le libellé de la rédaction pour une semaine programmée', async () => {
    const active = semaines.find((s) => s.status === 'active');
    const res = await request(app).get('/api/weeks');
    expect(res.status).toBe(200);

    const rendue = res.body.find((s) => s.id === active.id);
    expect(rendue.libelle).toBe('Sem. 18');
    // Les deux numéros cohabitent : ils ne disent pas la même chose.
    expect(rendue.name).toBe(active.name);
    expect(rendue.name).not.toBe(rendue.libelle);
  });

  it('rend une chaîne vide pour une semaine absente du planning', async () => {
    const suivante = semaines.find((s) => s.status === 'upcoming');
    const res = await request(app).get('/api/weeks');

    const rendue = res.body.find((s) => s.id === suivante.id);
    // Vide, et non `undefined` : l'écran affiche l'un ou l'autre sans avoir à
    // distinguer « pas de libellé » de « champ absent ».
    expect(rendue.libelle).toBe('');
  });

  it('ne touche ni à `id` ni à `name`, dont d’autres écrans se servent', async () => {
    const res = await request(app).get('/api/weeks');
    expect(res.body.map((s) => s.id)).toEqual(semaines.map((s) => s.id));
    expect(res.body.map((s) => s.name)).toEqual(semaines.map((s) => s.name));
  });
});

describe('store.libelleSemaine', () => {
  it('rend le libellé saisi au planning', () => {
    store.affecterSemaine('2026-w44', { libelle: 'Sem. 25' });
    expect(store.libelleSemaine('2026-w44')).toBe('Sem. 25');
  });

  it('rend une chaîne vide pour une semaine inconnue du planning', () => {
    expect(store.libelleSemaine('2026-w52')).toBe('');
  });

  it('consulter un libellé ne crée pas de semaine au planning', () => {
    store.libelleSemaine('2026-w51');
    expect(store.getPlanning().semaines['2026-w51']).toBeUndefined();
  });
});
