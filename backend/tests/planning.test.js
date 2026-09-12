import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';

/**
 * Le planning des monteurs.
 *
 * Deux personnes par semaine, chacune avec son avancement, et les reportages
 * cochés au fur et à mesure. Le planning porte SES semaines : celles de
 * `buildWeeks` ne couvrent qu'une fenêtre de deux à trois semaines, alors
 * qu'une programmation se regarde deux mois à l'avance.
 */

const ADMIN = 'mot-de-passe-montage';
let app;
let store;

beforeAll(async () => {
  vi.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_PASSWORD = ADMIN;

  store = await import('../src/data/store.js');
  await store.initDb();

  const { createApp } = await import('../src/app.js');
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

afterAll(() => {
  process.env.NODE_ENV = 'test';
  delete process.env.ADMIN_PASSWORD;
  vi.resetModules();
});

const enTantQueRedaction = (appel) => appel.set('X-Admin-Password', ADMIN);

describe('programmation de départ', () => {
  it('reprend exactement le tableau fourni par la rédaction', async () => {
    const res = await enTantQueRedaction(request(app).get('/api/planning'));
    expect(res.status).toBe(200);

    const nom = (id) => res.body.monteurs.find((m) => m.id === id)?.nom;
    const attendu = [
      ['2026-w37', 'Sem. 18', 'Godsway', 'David'],
      ['2026-w38', 'Sem. 19', 'Rodolphe', 'Chesnel'],
      ['2026-w39', 'Sem. 20', 'Godsway', 'Chadimi'],
      ['2026-w40', 'Sem. 21', 'David', 'Chesnel'],
      ['2026-w41', 'Sem. 22', 'Chadimi', 'Rodolphe'],
      ['2026-w42', 'Sem. 23', 'Chesnel', 'Godsway'],
      ['2026-w43', 'Sem. 24', 'David', 'Rodolphe'],
      ['2026-w44', 'Sem. 25', 'Chesnel', 'Chadimi'],
    ];

    for (const [weekId, libelle, assemblage, habillage] of attendu) {
      const s = res.body.semaines[weekId];
      expect(s, weekId).toBeDefined();
      expect(s.libelle, weekId).toBe(libelle);
      expect(nom(s.assemblage.monteurId), `${weekId} assemblage`).toBe(assemblage);
      expect(nom(s.habillage.monteurId), `${weekId} habillage`).toBe(habillage);
    }
  });

  it('couvre des semaines que la liste de travail n’expose pas', async () => {
    // `buildWeeks` ne rend que la semaine courante et la suivante : un
    // planning à deux mois ne peut pas s'appuyer dessus.
    const { buildWeeks } = await import('../src/data/constants.js');
    const connues = new Set(buildWeeks().map((w) => w.id));
    const res = await enTantQueRedaction(request(app).get('/api/planning'));
    const auPlanning = Object.keys(res.body.semaines);

    expect(auPlanning.length).toBeGreaterThan(connues.size);
    expect(auPlanning.some((id) => !connues.has(id))).toBe(true);
  });

  it('n’écrase jamais une affectation déjà saisie', async () => {
    // Le planning est fait pour bouger : un redémarrage ne doit pas remettre
    // la programmation d'origine par-dessus les décalages de la rédaction.
    const avant = (await enTantQueRedaction(request(app).get('/api/planning'))).body;
    const chadimi = avant.monteurs.find((m) => m.nom === 'Chadimi');

    await enTantQueRedaction(request(app).put('/api/planning/2026-w37'))
      .send({ assemblage: chadimi.id, libelle: 'Sem. 18 (décalée)' });
    await store.flushStore();
    await store.initDb();

    const apres = (await enTantQueRedaction(request(app).get('/api/planning'))).body;
    expect(apres.semaines['2026-w37'].assemblage.monteurId).toBe(chadimi.id);
    expect(apres.semaines['2026-w37'].libelle).toBe('Sem. 18 (décalée)');
    expect(apres.monteurs).toHaveLength(5); // pas de doublon à l'amorçage
  });
});

describe('avancement et reportages montés', () => {
  it('enregistre l’avancement de chaque rôle séparément', async () => {
    await enTantQueRedaction(request(app).patch('/api/planning/2026-w39/assemblage/etat')).send({ etat: 'termine' });
    const res = await enTantQueRedaction(request(app).patch('/api/planning/2026-w39/habillage/etat')).send({ etat: 'en_cours' });

    expect(res.status).toBe(200);
    expect(res.body.assemblage.etat).toBe('termine');
    expect(res.body.habillage.etat).toBe('en_cours');
    expect(res.body.habillage.majLe).toBeTruthy();
  });

  it('refuse un état ou un rôle inventé', async () => {
    const etat = await enTantQueRedaction(request(app).patch('/api/planning/2026-w39/assemblage/etat')).send({ etat: 'presque' });
    expect(etat.status).toBe(400);
    const role = await enTantQueRedaction(request(app).patch('/api/planning/2026-w39/etalonnage/etat')).send({ etat: 'termine' });
    expect(role.status).toBe(400);
  });

  it('coche et décoche un reportage, sans toucher à son état éditorial', async () => {
    const sujet = store.createSujet('2026-w39', 'cm', { titre: 'Marché de Douala' });

    let res = await enTantQueRedaction(request(app).patch(`/api/planning/2026-w39/sujets/${sujet.id}`)).send({ monte: true });
    expect(res.status).toBe(200);
    expect(res.body.sujetsMontes).toContain(sujet.id);

    const liste = await enTantQueRedaction(request(app).get('/api/planning/2026-w39/sujets'));
    const vu = liste.body.find((s) => s.id === sujet.id);
    expect(vu.monte).toBe(true);
    // « monté » et « état éditorial » sont deux axes distincts.
    expect(vu.etat).toBe('attendu');

    res = await enTantQueRedaction(request(app).patch(`/api/planning/2026-w39/sujets/${sujet.id}`)).send({ monte: false });
    expect(res.body.sujetsMontes).not.toContain(sujet.id);
  });

  it('liste les reportages de TOUS les pays — c’est le conducteur', async () => {
    store.createSujet('2026-w40', 'cm', { titre: 'Sujet Cameroun' });
    store.createSujet('2026-w40', 'sn', { titre: 'Sujet Sénégal' });

    const res = await enTantQueRedaction(request(app).get('/api/planning/2026-w40/sujets'));
    expect(res.status).toBe(200);
    expect(new Set(res.body.map((s) => s.countryId))).toEqual(new Set(['cm', 'sn']));
  });
});

describe('l’équipe', () => {
  it('ajoute un monteur sans en créer deux fois le même', async () => {
    const premier = await enTantQueRedaction(request(app).post('/api/planning/monteurs')).send({ nom: 'Awa' });
    expect(premier.status).toBe(201);
    const second = await enTantQueRedaction(request(app).post('/api/planning/monteurs')).send({ nom: '  awa  ' });
    expect(second.body.id).toBe(premier.body.id);
  });

  it('refuse d’affecter quelqu’un qui n’est pas de l’équipe', async () => {
    const res = await enTantQueRedaction(request(app).put('/api/planning/2026-w41')).send({ assemblage: 'inconnu' });
    expect(res.status).toBe(400);
  });

  it('garde les affectations passées quand quelqu’un quitte l’équipe', async () => {
    const ajout = await enTantQueRedaction(request(app).post('/api/planning/monteurs')).send({ nom: 'Passager' });
    await enTantQueRedaction(request(app).put('/api/planning/2026-w42')).send({ habillage: ajout.body.id });

    const retrait = await enTantQueRedaction(request(app).delete(`/api/planning/monteurs/${ajout.body.id}`));
    expect(retrait.status).toBe(204);

    const apres = (await enTantQueRedaction(request(app).get('/api/planning'))).body;
    expect(apres.monteurs.find((m) => m.id === ajout.body.id)).toBeUndefined();
    // L'affectation survit : effacer l'historique ferait mentir le planning.
    expect(apres.semaines['2026-w42'].habillage.monteurId).toBe(ajout.body.id);
  });
});

describe('le planning reste interne', () => {
  it('refuse la lecture sans le mot de passe montage', async () => {
    expect((await request(app).get('/api/planning')).status).toBe(403);
    expect((await request(app).get('/api/planning/2026-w37/sujets')).status).toBe(403);
  });

  it('refuse toute modification sans le mot de passe montage', async () => {
    expect((await request(app).put('/api/planning/2026-w37').send({})).status).toBe(403);
    expect((await request(app).post('/api/planning/monteurs').send({ nom: 'X' })).status).toBe(403);
  });
});
