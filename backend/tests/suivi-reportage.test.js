import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { TEST_UPLOADS_DIR } from './setup.js';

// Les notifications partent vers des téléphones : ici, on les regarde partir.
const envois = [];
vi.mock('../src/routes/webpush.js', () => ({
  default: Router(),
  AUDIENCES: { EDITOR: 'editor', REPORTER: 'reporter', UNKNOWN: 'unknown' },
  broadcastNotification: vi.fn(async (payload, filtre) => { envois.push({ payload, filtre }); }),
}));

const { createApp } = await import('../src/app.js');
const { WEEKS } = await import('../src/data/constants.js');
const { addUpload, saveTimelineWorkspace, addDelivery, updateFileStatus } = await import('../src/data/store.js');
const { suiviDuSujet, reportagesDiffuses } = await import('../src/services/suiviSujet.js');
const { messageDiffusion } = await import('../src/routes/deliveries.js');
const { nettoyerSommaire } = await import('../src/lib/sommaire.js');

// LE BESOIN : une fois ses fichiers envoyés, le correspondant ne savait plus
// rien jusqu'à la publication du JT — et même alors, il devait parcourir
// trente minutes pour savoir si son reportage y était. Le suivi se déduit de
// ce que la rédaction fait déjà : aucun geste de plus ne lui est demandé.

const SEMAINE = WEEKS.find((w) => w.status === 'active').id;
let app;
beforeAll(() => {
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});

const SUJET = { id: '11111111-2222-4333-8444-555555555555', etat: 'recu' };
const piece = (extra = {}) => ({ filename: 'r1.mp4', status: 'pending', uploadedAt: '2026-11-10T09:00:00Z', ...extra });

describe('le suivi d’un reportage — déduit, jamais saisi', () => {
  it('avance de « reçu » à « diffusé », avec la minute dans le JT', () => {
    expect(suiviDuSujet(SUJET, []).etape).toBe('attendu');
    expect(suiviDuSujet(SUJET, [piece()])).toMatchObject({ etape: 'recu', recuLe: '2026-11-10T09:00:00Z' });
    expect(suiviDuSujet({ ...SUJET, vuLe: '2026-11-10T12:00:00Z' }, [piece()])).toMatchObject({ etape: 'vu', vuLe: '2026-11-10T12:00:00Z' });
    expect(suiviDuSujet(SUJET, [piece({ status: 'approved' })]).etape).toBe('valide');
    expect(suiviDuSujet(SUJET, [piece()], { auDeroule: new Set(['r1.mp4']) }).etape).toBe('retenu');
    const livraisons = [{ id: 'jt1', type: 'video', uploadedAt: '2026-11-15T18:00:00Z', sommaire: [{ t: 0, titre: 'Générique' }, { t: 252, titre: 'Le marché', sujetId: SUJET.id }] }];
    expect(suiviDuSujet(SUJET, [piece()], { livraisons })).toMatchObject({
      etape: 'diffuse',
      diffusion: { livraisonId: 'jt1', t: 252, publieLe: '2026-11-15T18:00:00Z' },
    });
  });

  it('dit « à corriger » tant que le reportage n’est pas retenu', () => {
    expect(suiviDuSujet(SUJET, [piece({ status: 'rejected' })]).etape).toBe('aCorriger');
    // Un autre plan du même reportage est au déroulé : il est retenu malgré tout.
    expect(suiviDuSujet(SUJET, [piece({ status: 'rejected' }), piece({ filename: 'r2.mp4' })], { auDeroule: new Set(['r2.mp4']) }).etape).toBe('retenu');
  });

  it('sait qu’un reportage retenu est dans un JT publié sans sommaire, sans inventer de minute', () => {
    const livraisons = [{ id: 'jt-manuel', type: 'video', uploadedAt: '2026-11-15T18:00:00Z', sommaire: [] }];
    expect(suiviDuSujet(SUJET, [piece()], { auDeroule: new Set(['r1.mp4']), livraisons }).diffusion).toEqual({ livraisonId: 'jt-manuel', t: null, publieLe: '2026-11-15T18:00:00Z' });
    // Pas retenu : rien ne dit qu'il y est.
    expect(suiviDuSujet(SUJET, [piece()], { livraisons }).diffusion).toBeNull();
  });

  it('garde le reportage d’un chapitre, et seulement un identifiant valable', () => {
    expect(nettoyerSommaire([
      { t: 10, titre: 'A', sujetId: SUJET.id.toUpperCase() },
      { t: 20, titre: 'B', sujetId: '../../etc' },
    ])).toEqual([{ t: 10, titre: 'A', sujetId: SUJET.id }, { t: 20, titre: 'B' }]);
  });
});

describe('le message de diffusion, pays par pays', () => {
  it('regroupe les reportages diffusés par pays', () => {
    const sujets = [{ id: 'a', countryId: 'cmr', titre: 'La pêche' }, { id: 'b', countryId: 'gab', titre: 'Le marché' }, { id: 'c', countryId: 'cmr', titre: 'L’école' }];
    const parPays = reportagesDiffuses({ sommaire: [{ t: 44, sujetId: 'a' }, { t: 252, sujetId: 'b' }, { t: 400, sujetId: 'c' }, { t: 0 }] }, sujets);
    expect([...parPays.keys()]).toEqual(['cmr', 'gab']);
    expect(parPays.get('cmr').map((r) => r.t)).toEqual([44, 400]);
  });

  it('dit la minute, au singulier comme au pluriel', () => {
    expect(messageDiffusion([{ titre: 'La pêche reprend à Kribi', t: 252 }], 46)).toBe('« La pêche reprend à Kribi » passe à 4:12 dans le JT de la semaine 46.');
    expect(messageDiffusion([{ titre: 'A', t: 44 }, { titre: 'B', t: 400 }], 46)).toBe('Vos 2 reportages sont dans le JT de la semaine 46, dès 0:44.');
  });
});

describe('le suivi par l’API, du dépôt à la diffusion', () => {
  const PAYS = 'cg';
  let sujet;

  it('suit le reportage étape par étape', async () => {
    sujet = (await request(app).post(`/api/sujets/${SEMAINE}/${PAYS}`).send({ titre: 'Le port de Pointe-Noire' })).body;
    expect(sujet.suivi.etape).toBe('attendu');

    addUpload(SEMAINE, PAYS, { id: 'f-suivi-1', name: 'port.mp4', filename: 'suivi-port.mp4', type: 'video', status: 'pending', sujetId: sujet.id, uploadedAt: '2026-11-11T08:00:00Z' });
    const lire = async () => (await request(app).get(`/api/sujets/${SEMAINE}/${PAYS}`)).body.find((s) => s.id === sujet.id).suivi;
    expect((await lire()).etape).toBe('recu');

    // La rédaction ouvre le fichier dans sa visionneuse.
    const vu = await request(app).post(`/api/sujets/${SEMAINE}/${PAYS}/${sujet.id}/vu`);
    expect(vu.status).toBe(200);
    const apresVu = await lire();
    expect(apresVu.etape).toBe('vu');
    expect(apresVu.vuLe).toBe(vu.body.vuLe);
    // Une seconde ouverture ne change pas l'heure : c'est la première qui compte.
    const encore = await request(app).post(`/api/sujets/${SEMAINE}/${PAYS}/${sujet.id}/vu`);
    expect(encore.body.vuLe).toBe(vu.body.vuLe);

    // Posé au déroulé.
    saveTimelineWorkspace(SEMAINE, { clips: [{ filename: 'suivi-port.mp4' }], overlays: [] });
    expect((await lire()).etape).toBe('retenu');

    // Publié, avec son chapitre.
    addDelivery(SEMAINE, { id: 'jt-suivi', name: 'JT.mp4', filename: 'jt-suivi.mp4', type: 'video', uploadedAt: '2026-11-15T18:00:00Z', sommaire: [{ t: 0, titre: 'Générique' }, { t: 95, titre: 'Le port de Pointe-Noire — Congo', sujetId: sujet.id }] });
    expect(await lire()).toMatchObject({ etape: 'diffuse', diffusion: { livraisonId: 'jt-suivi', t: 95 } });
  });

  it('refuse un « vu » sur le sujet d’un autre pays', async () => {
    const res = await request(app).post(`/api/sujets/${SEMAINE}/sn/${sujet.id}/vu`);
    expect(res.status).toBe(404);
  });

  it('compte une validation comme une ouverture', async () => {
    const autre = (await request(app).post(`/api/sujets/${SEMAINE}/${PAYS}`).send({ titre: 'Le marché Total' })).body;
    addUpload(SEMAINE, PAYS, { id: 'f-suivi-2', name: 'marche.mp4', filename: 'suivi-marche.mp4', type: 'video', status: 'pending', sujetId: autre.id, uploadedAt: '2026-11-11T08:00:00Z' });
    updateFileStatus(SEMAINE, 'f-suivi-2', 'approved');
    const suivi = (await request(app).get(`/api/sujets/${SEMAINE}/${PAYS}`)).body.find((s) => s.id === autre.id).suivi;
    expect(suivi.vuLe).toBeTruthy();
  });
});

describe('la publication prévient chaque pays de SON reportage', () => {
  it('envoie un message à part au pays diffusé, et l’annonce générale aux autres', async () => {
    const sujet = (await request(app).post(`/api/sujets/${SEMAINE}/tg`).send({ titre: 'La lagune de Lomé' })).body;
    envois.length = 0;
    const MP4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32]);
    const res = await request(app)
      .post(`/api/deliveries/${SEMAINE}`)
      .field('sommaire', JSON.stringify([{ t: 0, titre: 'Générique' }, { t: 130, titre: 'La lagune de Lomé — Togo', sujetId: sujet.id }]))
      .attach('file', MP4, { filename: 'jt.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);

    const perso = envois.find((e) => e.filtre.countryId === 'tg');
    expect(perso.payload.body).toMatch(/« La lagune de Lomé » passe à 2:10 dans le JT/);
    expect(perso.payload.url).toBe(`/journalistes/telecharger-le-jt?jt=${res.body.id}&a=130`);
    const general = envois.find((e) => e.filtre.audiences?.includes('reporter') && !e.filtre.countryId);
    expect(general.filtre.saufPays).toEqual(['tg']);
  });
});
