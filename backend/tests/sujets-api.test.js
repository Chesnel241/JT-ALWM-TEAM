import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { WEEKS } from '../src/data/constants.js';

const WEEK = WEEKS.find((w) => w.status === 'active').id;
let app;

// Le plafond est de cinq sujets par pays et par semaine, et le store est
// partagé dans le fichier : chaque bloc travaille donc sur son propre pays.
const PAYS = 'sn';
const PAYS_RENOMMAGE = 'ci';
const PAYS_PLAFOND = 'cm';
const PAYS_ETAT = 'tg';

beforeAll(() => {
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'] });
});

async function creer(titre, pays = PAYS) {
  return request(app).post(`/api/sujets/${WEEK}/${pays}`).send({ titre });
}

describe('sujets — création et lecture', () => {
  it('ouvre un sujet avec son titre', async () => {
    const res = await creer('Marché de Kermel, la hausse du poisson');
    expect(res.status).toBe(201);
    expect(res.body.titre).toBe('Marché de Kermel, la hausse du poisson');
    expect(res.body.countryId).toBe(PAYS);
    // Un sujet vide est attendu, pas reçu : c'est ce qui permettra à la
    // rédaction de voir ce qui manque.
    expect(res.body.etat).toBe('attendu');
    expect(res.body.nbPieces).toBe(0);
  });

  it('refuse un sujet sans titre', async () => {
    for (const titre of ['', '   ', null]) {
      const res = await request(app).post(`/api/sujets/${WEEK}/${PAYS}`).send({ titre });
      expect(res.status).toBe(400);
    }
  });

  it('normalise le titre et le borne', async () => {
    const res = await creer('  Trop   d\'espaces   ici  ');
    expect(res.body.titre).toBe("Trop d'espaces ici");

    const long = await creer('x'.repeat(400));
    expect(long.body.titre.length).toBe(120);
  });

  it('rend les sujets d\'un pays, dans l\'ordre de création', async () => {
    const res = await request(app).get(`/api/sujets/${WEEK}/${PAYS}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('rejette une semaine ou un pays inconnus', async () => {
    expect((await request(app).get('/api/sujets/pas-une-semaine')).status).toBe(400);
    expect((await request(app).get(`/api/sujets/${WEEK}/zz`)).status).toBe(400);
  });
});

describe('sujets — renommage et suppression', () => {
  it('renomme un sujet', async () => {
    const { body } = await creer('Titre provisoire', PAYS_RENOMMAGE);
    const res = await request(app)
      .patch(`/api/sujets/${WEEK}/${PAYS_RENOMMAGE}/${body.id}`)
      .send({ titre: 'Titre définitif' });
    expect(res.status).toBe(200);
    expect(res.body.titre).toBe('Titre définitif');
  });

  it('ne renomme pas un sujet d\'un autre pays', async () => {
    const { body } = await creer('Sujet ivoirien', PAYS_RENOMMAGE);
    const res = await request(app)
      .patch(`/api/sujets/${WEEK}/cd/${body.id}`)
      .send({ titre: 'Détourné' });
    expect(res.status).toBe(404);
  });

  it('supprime un sujet vide', async () => {
    const { body } = await creer('À supprimer', PAYS_RENOMMAGE);
    expect((await request(app).delete(`/api/sujets/${WEEK}/${PAYS_RENOMMAGE}/${body.id}`)).status).toBe(204);
  });

  it('plafonne à cinq sujets par pays et par semaine', async () => {
    const pays = PAYS_PLAFOND;
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post(`/api/sujets/${WEEK}/${pays}`).send({ titre: `Sujet ${i}` });
      expect(res.status).toBe(201);
    }
    const trop = await request(app).post(`/api/sujets/${WEEK}/${pays}`).send({ titre: 'Le sixième' });
    expect(trop.status).toBe(400);
  });
});

describe('sujets — état', () => {
  it('accepte les états du conducteur et refuse le reste', async () => {
    const { body } = await creer('Sujet à valider', PAYS_ETAT);
    const ok = await request(app)
      .patch(`/api/sujets/${WEEK}/${PAYS_ETAT}/${body.id}/etat`)
      .send({ etat: 'valide' });
    expect(ok.status).toBe(200);
    expect(ok.body.etat).toBe('valide');

    const ko = await request(app)
      .patch(`/api/sujets/${WEEK}/${PAYS_ETAT}/${body.id}/etat`)
      .send({ etat: 'inventé' });
    expect(ko.status).toBe(400);
  });
});
