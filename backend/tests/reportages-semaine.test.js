import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { semaineOuverte } from './semaine.js';
import { createApp } from '../src/app.js';
import { addUpload, getCountryUploads, getSujets } from '../src/data/store.js';
import { ETIQUETTES_HORS_SUJET } from '../src/data/rubriques.js';

/**
 * Le nombre de reportages d'une semaine, et les fichiers qui s'y rattachent.
 *
 * L'INCIDENT, vu par un correspondant
 * -----------------------------------
 * Il dépose son rush dans « Reportage 1 » — la section que l'écran montre tant
 * qu'aucun reportage n'est nommé. Puis il ajoute un second reportage, qu'il
 * titre. L'écran passe alors aux reportages nommés : **son rush n'apparaît
 * plus nulle part**, et le reportage qu'il vient d'ajouter prend la place du
 * premier. Au redémarrage suivant du serveur, la migration rattachait le rush
 * à un nouveau « Reportage 1 », rangé *après* — et transformait au passage ses
 * annonces en un reportage « Annonces ». Tout cela vérifié sur le vrai store.
 *
 * C'est ce qui rendait « Ajouter un reportage » incompréhensible.
 */

const SEMAINE = semaineOuverte();
let app;

beforeAll(() => {
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});

const fixer = (pays, reportages) => request(app).put(`/api/sujets/${SEMAINE}/${pays}`).send({ reportages });
const deposer = (pays, fichier) => addUpload(SEMAINE, pays, { status: 'pending', type: 'video', ...fichier });

describe('le rush déposé avant tout reportage nommé', () => {
  it('reste le premier reportage quand le correspondant en choisit deux', async () => {
    // LE test du lot, côté serveur.
    deposer('cm', { id: 'rush-douala', name: 'rush.mp4', reportage: 'Reportage 1', sujetId: null });

    const res = await fixer('cm', [{ titre: 'Inondations à Douala' }, { titre: 'Marché central' }]);
    expect(res.status).toBe(200);
    expect(res.body.sujets.map((s) => s.titre)).toEqual(['Inondations à Douala', 'Marché central']);

    const rush = getCountryUploads(SEMAINE, 'cm').find((f) => f.id === 'rush-douala');
    expect(rush.sujetId, 'le rush est orphelin : il a disparu de l’écran').toBe(res.body.sujets[0].id);
    expect(res.body.sujets[0].nbPieces).toBe(1);
  });

  it('ne disparaît pas non plus quand un reportage est créé un par un', async () => {
    deposer('sn', { id: 'rush-dakar', name: 'rush.mp4', reportage: 'Reportage 1', sujetId: null });
    const res = await request(app).post(`/api/sujets/${SEMAINE}/sn`).send({ titre: 'Pêche à Kayar' });
    expect(res.status).toBe(201);
    const rush = getCountryUploads(SEMAINE, 'sn').find((f) => f.id === 'rush-dakar');
    expect(rush.sujetId).toBe(res.body.id);
  });

  it('laisse les annonces à leur section, sans en faire un reportage', async () => {
    deposer('ci', { id: 'annonce-ci', name: 'annonce.mp3', reportage: 'Annonces', sujetId: null });
    const res = await fixer('ci', [{ titre: 'Rentrée scolaire' }]);
    expect(res.body.sujets.map((s) => s.titre)).toEqual(['Rentrée scolaire']);
    const annonce = getCountryUploads(SEMAINE, 'ci').find((f) => f.id === 'annonce-ci');
    expect(annonce.sujetId).toBeFalsy();
  });
});

describe('choisir le nombre de reportages', () => {
  it('crée les reportages dans l’ordre donné', async () => {
    const res = await fixer('cd', [{ titre: 'Un' }, { titre: 'Deux' }, { titre: 'Trois' }]);
    expect(res.status).toBe(200);
    expect(getSujets(SEMAINE, 'cd').map((s) => s.titre)).toEqual(['Un', 'Deux', 'Trois']);
  });

  it('renomme un reportage existant sans le recréer', async () => {
    const [un] = getSujets(SEMAINE, 'cd');
    const res = await fixer('cd', getSujets(SEMAINE, 'cd').map((s) => (
      s.id === un.id ? { id: s.id, titre: 'Un, mieux titré' } : { id: s.id, titre: s.titre }
    )));
    expect(res.status).toBe(200);
    expect(res.body.sujets[0]).toMatchObject({ id: un.id, titre: 'Un, mieux titré' });
  });

  it('en retire un s’il est vide', async () => {
    const avant = getSujets(SEMAINE, 'cd');
    const res = await fixer('cd', avant.slice(0, 2).map((s) => ({ id: s.id, titre: s.titre })));
    expect(res.status).toBe(200);
    expect(getSujets(SEMAINE, 'cd')).toHaveLength(2);
  });

  it('en ajoute après ceux qui existent', async () => {
    const avant = getSujets(SEMAINE, 'cd').map((s) => ({ id: s.id, titre: s.titre }));
    const res = await fixer('cd', [...avant, { titre: 'Nouveau' }]);
    expect(res.status).toBe(200);
    expect(getSujets(SEMAINE, 'cd').map((s) => s.titre).at(-1)).toBe('Nouveau');
  });
});

describe('rien ne se perd', () => {
  it('refuse de retirer un reportage qui porte des fichiers — et ne touche à rien', async () => {
    const res1 = await fixer('cg', [{ titre: 'Plein' }, { titre: 'Vide' }]);
    const [plein] = res1.body.sujets;
    deposer('cg', { id: 'piece-cg', name: 'a.mp4', reportage: 'Plein', sujetId: plein.id });

    const res = await fixer('cg', [{ id: res1.body.sujets[1].id, titre: 'Vide, renommé' }]);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Plein/);
    // Tout est vérifié avant la première écriture : le renommage n'a pas eu lieu.
    expect(getSujets(SEMAINE, 'cg').map((s) => s.titre)).toEqual(['Plein', 'Vide']);
  });

  it('refuse d’abandonner une section de repli qui porte des fichiers', async () => {
    // Deux sections de repli visibles, la seconde déjà remplie : choisir un
    // seul reportage fondrait silencieusement la seconde dans la première.
    deposer('ma', { id: 'repli-1', name: 'a.mp4', reportage: 'Reportage 1', sujetId: null });
    deposer('ma', { id: 'repli-2', name: 'b.mp4', reportage: 'Reportage 2', sujetId: null });
    const res = await fixer('ma', [{ titre: 'Un seul' }]);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Reportage 2/);
    expect(getSujets(SEMAINE, 'ma')).toHaveLength(0);
  });
});

describe('ce qui est refusé', () => {
  it('plus de cinq reportages', async () => {
    const res = await fixer('tg', Array.from({ length: 6 }, (_, i) => ({ titre: `R${i}` })));
    expect(res.status).toBe(400);
  });

  it('un reportage sans titre', async () => {
    expect((await fixer('tg', [{ titre: '   ' }])).status).toBe(400);
  });

  it('un reportage d’un autre pays, ou inconnu', async () => {
    expect((await fixer('tg', [{ id: 'pas-un-sujet', titre: 'X' }])).status).toBe(404);
  });

  it('un réordonnancement : la position d’un reportage est son ordre de création', async () => {
    const res1 = await fixer('tg', [{ titre: 'A' }, { titre: 'B' }]);
    const [a, b] = res1.body.sujets;
    const res = await fixer('tg', [{ id: b.id, titre: 'B' }, { id: a.id, titre: 'A' }]);
    expect(res.status).toBe(400);
  });

  it('une rubrique, qui n’a pas de reportages', async () => {
    expect((await fixer('tj', [{ titre: 'X' }])).status).toBe(400);
  });

  it('autre chose qu’une liste', async () => {
    const res = await request(app).put(`/api/sujets/${SEMAINE}/tg`).send({ reportages: 'trois' });
    expect(res.status).toBe(400);
  });
});

describe('la migration du démarrage', () => {
  // Le store lit son chemin au chargement : on l'isole par test.
  let dir;
  let dbPath;
  let cheminAvant;

  async function chargerAvec(contenu) {
    fs.writeFileSync(dbPath, JSON.stringify(contenu, null, 2));
    vi.resetModules();
    process.env.JT_STORE_PATH = dbPath;
    const store = await import('../src/data/store.js');
    await store.initDb();
    return store;
  }

  beforeEach(() => {
    cheminAvant = process.env.JT_STORE_PATH;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-reportages-'));
    dbPath = path.join(dir, 'db.json');
  });

  afterEach(() => {
    process.env.JT_STORE_PATH = cheminAvant;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('ne fait jamais un reportage d’une section fixe', async () => {
    const store = await chargerAvec({
      '2026-w37': {
        sn: [
          { id: 'a', reportage: 'Annonces', status: 'pending' },
          { id: 's', reportage: 'Séminaires de la semaine', status: 'pending' },
          { id: 'r', reportage: 'Reportage Assemblé', status: 'pending' },
          { id: 'v', reportage: 'Reportage 1', status: 'pending' },
        ],
      },
    });
    expect(store.getSujets('2026-w37', 'sn').map((s) => s.titre)).toEqual(['Reportage 1']);
    const fichiers = store.getCountryUploads('2026-w37', 'sn');
    for (const id of ['a', 's', 'r']) {
      expect(fichiers.find((f) => f.id === id).sujetId, id).toBeFalsy();
    }
  });

  it('ne donne pas de reportages aux tiroirs des rubriques', async () => {
    const store = await chargerAvec({
      '2026-w37': {
        tj: [{ id: 't', reportage: 'Titres', status: 'pending' }],
        mj: [{ id: 'm', reportage: 'Détails', status: 'pending' }],
      },
    });
    expect(store.getSujets('2026-w37')).toEqual([]);
  });

  it('rattache un libellé de repli au reportage de même rang', async () => {
    const store = await chargerAvec({
      '2026-w37': {
        _sujets: {
          s1: { id: 's1', weekId: '2026-w37', countryId: 'sn', titre: 'Inondations', etat: 'attendu', creeLe: '2026-09-07T10:00:00.000Z' },
          s2: { id: 's2', weekId: '2026-w37', countryId: 'sn', titre: 'Marché', etat: 'attendu', creeLe: '2026-09-07T10:01:00.000Z' },
        },
        sn: [{ id: 'x', reportage: 'Reportage 2', status: 'pending' }],
      },
    });
    expect(store.getCountryUploads('2026-w37', 'sn')[0].sujetId).toBe('s2');
    // Et sans créer de sujet parasite « Reportage 2 ».
    expect(store.getSujets('2026-w37', 'sn')).toHaveLength(2);
  });

  it('ne défait pas au redémarrage une validation de la rédaction', async () => {
    const store = await chargerAvec({
      '2026-w37': {
        _sujets: {
          s1: { id: 's1', weekId: '2026-w37', countryId: 'sn', titre: 'Validé', etat: 'valide', creeLe: '2026-09-07T10:00:00.000Z' },
        },
        sn: [{ id: 'x', status: 'pending' }],
      },
    });
    expect(store.getSujets('2026-w37', 'sn')[0].etat).toBe('valide');
  });
});

describe('les deux listes de sections fixes', () => {
  it('sont accordées entre le serveur et le studio', async () => {
    // Une section fixe que le studio affiche sans que le serveur la connaisse
    // redeviendrait un reportage au premier redémarrage.
    const { SECTIONS_FIXES } = await import('../../frontend/src/lib/sujets.js');
    for (const section of SECTIONS_FIXES) {
      expect(ETIQUETTES_HORS_SUJET.has(section.name), section.name).toBe(true);
    }
  });
});
