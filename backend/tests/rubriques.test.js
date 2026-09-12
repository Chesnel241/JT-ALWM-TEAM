import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { RUBRIQUES, nettoyerChamps } from '../src/data/rubriques.js';

/**
 * Le conducteur et le Mot du JT ne sont plus des pays.
 *
 * Le premier recense les reportages de tous les pays ; le second est
 * l'intervention filmée de quelqu'un. Ni l'un ni l'autre n'appartient à un
 * correspondant : tout lien valide y donne accès, quel que soit son pays.
 */

const ADMIN = 'mot-de-passe-montage';
const SECRET = 'secret-de-signature';
const SEMAINE = '2026-w37';

let app;
let lien;

beforeAll(async () => {
  vi.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_PASSWORD = ADMIN;
  process.env.REPORTER_TOKEN_SECRET = SECRET;

  const { issueReporterToken } = await import('../src/lib/reporterToken.js');
  lien = issueReporterToken({ pays: 'cm', nom: 'Awa' });

  const { createApp } = await import('../src/app.js');
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});

afterAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.REPORTER_ACCESS = 'ouvert';
  delete process.env.ADMIN_PASSWORD;
  delete process.env.REPORTER_TOKEN_SECRET;
  vi.resetModules();
});

describe('elles ne figurent plus parmi les pays', () => {
  it('la liste des pays ne contient ni le conducteur ni le Mot du JT', async () => {
    const res = await request(app).get('/api/countries');
    expect(res.status).toBe(200);
    const ids = res.body.map((c) => c.id);
    expect(ids).not.toContain('tj');
    expect(ids).not.toContain('mj');
    expect(ids).toContain('cm'); // les vrais pays sont toujours là
  });

  it('mais leurs tiroirs restent des destinations valides', async () => {
    // Les fichiers déjà déposés y sont, et le studio de montage les adresse
    // toujours ainsi : rien n'a bougé sur le disque.
    const { isCountryAccepted } = await import('../src/data/constants.js');
    expect(isCountryAccepted('tj')).toBe(true);
    expect(isCountryAccepted('mj')).toBe(true);
  });
});

describe('leurs champs', () => {
  it('décrit ce que chaque rubrique attend', async () => {
    const res = await request(app).get('/api/rubriques');
    expect(res.status).toBe(200);
    const parCle = Object.fromEntries(res.body.map((r) => [r.cle, r]));

    expect(parCle.conducteur.champs.map((c) => c.cle)).toEqual(['texte', 'texteVoixOff']);
    expect(parCle.conducteur.natureFichier).toBe('audio');
    expect(parCle.motDuJt.champs.map((c) => c.cle)).toEqual(['orateur', 'pays', 'theme']);
    expect(parCle.motDuJt.natureFichier).toBe('video');
  });

  it('enregistre le conducteur et son texte de voix off', async () => {
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/conducteur`)
      .set('X-Reporter-Token', lien)
      .send({ texte: 'Lancement plateau, puis Pikine.', texteVoixOff: 'Bonsoir à tous.' });

    expect(res.status).toBe(200);
    expect(res.body.texte).toBe('Lancement plateau, puis Pikine.');
    expect(res.body.majLe).toBeTruthy();
  });

  it('n’efface pas un champ que l’appelant n’a pas envoyé', async () => {
    // Deux personnes peuvent remplir le conducteur et la voix off chacune de
    // son côté : écrire l'un ne doit pas effacer l'autre.
    await request(app).put(`/api/rubriques/${SEMAINE}/conducteur`)
      .set('X-Reporter-Token', lien).send({ texteVoixOff: 'Nouvelle voix off.' });

    const res = await request(app).get(`/api/rubriques/${SEMAINE}/conducteur`);
    expect(res.body.champs.texte).toBe('Lancement plateau, puis Pikine.');
    expect(res.body.champs.texteVoixOff).toBe('Nouvelle voix off.');
  });

  it('ignore un champ qui n’appartient pas à la rubrique', async () => {
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/motDuJt`)
      .set('X-Reporter-Token', lien)
      .send({ orateur: 'M. Nguema', theme: 'Éducation', pirate: 'ignoré' });

    expect(res.status).toBe(200);
    expect(res.body.orateur).toBe('M. Nguema');
    expect(res.body.pirate).toBeUndefined();
  });

  it('refuse un corps sans aucun champ connu, en disant lesquels il attend', async () => {
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/motDuJt`)
      .set('X-Reporter-Token', lien)
      .send({ nimporte: 'quoi' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/orateur/);
  });

  it('numérote chaque enregistrement, pour que deux mains ne s’effacent pas', async () => {
    // Le conducteur s'écrit à plusieurs. La réponse dit désormais sur quelle
    // révision le formulaire vient d'écrire — même mécanique que le plan de
    // montage — sans rien changer à ce que la saisie lit déjà à la racine.
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/conducteur`)
      .set('X-Reporter-Token', lien)
      .send({ texte: 'Relecture du conducteur.' });

    expect(res.status).toBe(200);
    expect(res.body.conflit).toBe(false);
    expect(res.body.revision).toBeGreaterThan(0);
    expect(res.body.texte).toBe('Relecture du conducteur.');
    expect(res.body.champs.texte).toBe('Relecture du conducteur.');

    // Et la lecture rend le même numéro, celui sur lequel un client se fonde.
    // Il vit à la racine de la réponse, pas parmi les champs : la révision
    // relève du protocole d'écriture, elle n'est pas un contenu du journal et
    // ne doit jamais se retrouver affichée dans un formulaire de saisie.
    const lu = await request(app).get(`/api/rubriques/${SEMAINE}/conducteur`);
    expect(lu.body.revision).toBe(res.body.revision);
    expect(lu.body.champs.texte).toBe('Relecture du conducteur.');
    expect(lu.body.champs).not.toHaveProperty('revision');
    expect(lu.body.champs).not.toHaveProperty('majLe');
  });

  it('refuse une écriture fondée sur une révision périmée, sans rien perdre', async () => {
    // Deux personnes ouvrent le conducteur en même temps. La seconde écrivait
    // par-dessus la première, sans que personne ne le sache.
    const premiere = await request(app)
      .put(`/api/rubriques/${SEMAINE}/conducteur`)
      .set('X-Reporter-Token', lien)
      .send({ texte: 'Version de la première personne.' });
    expect(premiere.status).toBe(200);

    const revisionPerimee = premiere.body.revision - 1;
    const seconde = await request(app)
      .put(`/api/rubriques/${SEMAINE}/conducteur`)
      .set('X-Reporter-Token', lien)
      .send({ texte: 'Version de la seconde.', baseRevision: revisionPerimee });

    expect(seconde.status).toBe(409);
    expect(seconde.body.conflit).toBe(true);
    // Rien n'a été écrit : le texte de la première est intact, et la seconde
    // reçoit de quoi se resituer plutôt qu'une erreur opaque.
    expect(seconde.body.texte).toBe('Version de la première personne.');
    expect(seconde.body.revision).toBe(premiere.body.revision);

    const lu = await request(app).get(`/api/rubriques/${SEMAINE}/conducteur`);
    expect(lu.body.champs.texte).toBe('Version de la première personne.');
  });

  it('écrit toujours quand le client n’annonce aucune révision', async () => {
    // Un onglet ouvert avant la mise à jour n'envoie pas `baseRevision` :
    // il doit continuer de fonctionner exactement comme avant.
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/conducteur`)
      .set('X-Reporter-Token', lien)
      .send({ texte: 'Écrit par un client plus ancien.' });

    expect(res.status).toBe(200);
    expect(res.body.conflit).toBe(false);
    expect(res.body.texte).toBe('Écrit par un client plus ancien.');
  });

  it('ne prend jamais « baseRevision » pour un champ du journal', () => {
    // Elle voyage dans le même corps que le texte : si elle était rangée avec
    // les champs, elle finirait affichée dans le conducteur.
    const propre = nettoyerChamps(RUBRIQUES.conducteur, {
      texte: 'Ouverture.',
      baseRevision: 7,
    });
    expect(propre).toEqual({ texte: 'Ouverture.' });
  });
});

describe('qui peut les remplir', () => {
  it('tout correspondant identifié, quel que soit le pays de son lien', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/conducteur`)
      .set('X-Reporter-Token', lien)   // un lien du Cameroun
      .send({ texte: 'Écrit par le correspondant du Cameroun.' });
    expect(res.status).toBe(200);
    process.env.REPORTER_ACCESS = 'ouvert';
  });

  it('la rédaction, évidemment', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/conducteur`)
      .set('X-Admin-Password', ADMIN)
      .send({ texte: 'Écrit par la rédaction.' });
    expect(res.status).toBe(200);
    process.env.REPORTER_ACCESS = 'ouvert';
  });

  it('mais personne sans lien pour le conducteur, une fois la portée appliquée', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/conducteur`)
      .send({ texte: 'Écrit par un inconnu.' });
    expect(res.status).toBe(403);
    // Le refus explique que n'importe quel lien conviendrait.
    expect(res.body.message).toMatch(/n'appartient à aucun pays/i);
    process.env.REPORTER_ACCESS = 'ouvert';
  });

  it('le Mot du JT est ouvert à tous, sans authentification ni lien même en strict', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/motDuJt`)
      .send({ orateur: 'Journaliste Anonyme', theme: 'Actualité locale' });
    expect(res.status).toBe(200);
    expect(res.body.orateur).toBe('Journaliste Anonyme');
    process.env.REPORTER_ACCESS = 'ouvert';
  });
});
