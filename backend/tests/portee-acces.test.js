import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { semaineActive } from './semaine.js';

/**
 * La portée : qui a le droit de toucher à quel pays.
 *
 * Ces tests montent une application HORS mode test. `requireAdmin` laisse
 * tout passer quand NODE_ENV === 'test' (IS_TEST, figé à l'import), donc un
 * test naïf serait vert même sans aucune garde. Même montage que
 * admin-guards.test.js, pour la même raison.
 *
 * Le cran se règle par REPORTER_ACCESS, relu à chaque appel : une seule
 * application suffit, on bascule la variable d'un bloc à l'autre.
 */

const ADMIN = 'mot-de-passe-montage';
const SECRET = 'secret-de-signature-des-liens';
// La semaine active, et non une semaine figée : une suite qui ne passe que la
// semaine de son écriture annonce une panne tous les lundis.
const SEMAINE = semaineActive();
const GABON = 'cm';   // le pays du correspondant testé
const AUTRE = 'sn';   // un pays qui n'est pas le sien
const UUID = '00000000-0000-4000-8000-000000000000';

let app;
let emettreLien;
let revoquerLien;

beforeAll(async () => {
  vi.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_PASSWORD = ADMIN;
  process.env.REPORTER_TOKEN_SECRET = SECRET;

  // Même registre de modules que l'application : le registre des liens
  // révoqués est un état partagé, deux instances ne se verraient pas.
  ({ issueReporterToken: emettreLien } = await import('../src/lib/reporterToken.js'));
  ({ revoquerLien } = await import('../src/data/store.js'));

  const { createApp } = await import('../src/app.js');
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

afterEach(() => {
  process.env.REPORTER_ACCESS = 'ouvert';
});

afterAll(() => {
  // Le pool vitest est mono-processus : sans restauration, les fichiers
  // suivants tourneraient hors mode test.
  process.env.NODE_ENV = 'test';
  process.env.REPORTER_ACCESS = 'ouvert';
  delete process.env.ADMIN_PASSWORD;
  delete process.env.REPORTER_TOKEN_SECRET;
  vi.resetModules();
});

const lienPour = (pays) => emettreLien({ pays, nom: 'Awa', id: `lien-${pays}-${Math.random()}` });

describe('cran `ouvert` — rien ne change', () => {
  it('laisse lire la semaine entière sans rien présenter', async () => {
    process.env.REPORTER_ACCESS = 'ouvert';
    const res = await request(app).get(`/api/uploads/${SEMAINE}`);
    expect(res.status).toBe(200);
  });

  it('laisse lire le chutier d’un pays sans rien présenter', async () => {
    process.env.REPORTER_ACCESS = 'ouvert';
    const res = await request(app).get(`/api/uploads/${SEMAINE}/${AUTRE}`);
    expect(res.status).toBe(200);
  });
});

describe('cran `observe` — on compte, on ne refuse pas', () => {
  it('sert la semaine entière à un inconnu, comme avant', async () => {
    process.env.REPORTER_ACCESS = 'observe';
    const res = await request(app).get(`/api/uploads/${SEMAINE}`);
    expect(res.status).toBe(200);
  });

  it('sert le chutier d’un autre pays au porteur d’un lien', async () => {
    process.env.REPORTER_ACCESS = 'observe';
    const res = await request(app)
      .get(`/api/uploads/${SEMAINE}/${AUTRE}`)
      .set('X-Reporter-Token', lienPour(GABON));
    expect(res.status).toBe(200);
  });

  it('rend compte de ce qu’il aurait refusé', async () => {
    process.env.REPORTER_ACCESS = 'observe';
    await request(app).get(`/api/uploads/${SEMAINE}/${AUTRE}`);
    const res = await request(app).get('/api/liens/etat').set('X-Admin-Password', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.acces.paysNonPrets).toContain(AUTRE);
  });
});

describe('cran `strict` — la portée s’applique', () => {
  const strict = () => { process.env.REPORTER_ACCESS = 'strict'; };

  it('refuse la semaine entière à un inconnu', async () => {
    strict();
    const res = await request(app).get(`/api/uploads/${SEMAINE}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PORTEE_REDACTION');
  });

  it('refuse le chutier d’un pays à un inconnu', async () => {
    strict();
    const res = await request(app).get(`/api/uploads/${SEMAINE}/${GABON}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PORTEE_PAYS');
  });

  it('refuse la suppression du fichier d’un autre — le cas le plus grave', async () => {
    strict();
    const res = await request(app)
      .delete(`/api/uploads/${SEMAINE}/${AUTRE}/${UUID}`)
      .set('X-Reporter-Token', lienPour(GABON));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PORTEE_PAYS');
  });

  it('laisse le correspondant lire SON pays', async () => {
    strict();
    const res = await request(app)
      .get(`/api/uploads/${SEMAINE}/${GABON}`)
      .set('X-Reporter-Token', lienPour(GABON));
    expect(res.status).toBe(200);
  });

  it('refuse au correspondant le pays d’un autre, en le lui expliquant', async () => {
    strict();
    const res = await request(app)
      .get(`/api/uploads/${SEMAINE}/${AUTRE}`)
      .set('X-Reporter-Token', lienPour(GABON));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/lien personnel/i);
  });

  it('ouvre les rubriques du journal à tout correspondant identifié', async () => {
    // Le conducteur et le Mot du JT ne sont le pays de personne : il suffit
    // d'être identifié, quel que soit le pays de son lien.
    strict();
    for (const rubrique of ['tj', 'mj']) {
      const res = await request(app)
        .get(`/api/uploads/${SEMAINE}/${rubrique}`)
        .set('X-Reporter-Token', lienPour(GABON));
      expect(res.status, rubrique).toBe(200);
    }
  });

  it('ouvre le Mot du JT à n\'importe qui, même anonyme et sans lien', async () => {
    strict();
    const res = await request(app).get(`/api/uploads/${SEMAINE}/mj`);
    expect(res.status).toBe(200);
  });

  it('refuse le conducteur à qui ne présente aucun lien', async () => {
    strict();
    const res = await request(app).get(`/api/uploads/${SEMAINE}/tj`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/lien personnel/i);
  });

  it('ignore un jeton falsifié plutôt que de lui faire confiance', async () => {
    strict();
    const res = await request(app)
      .get(`/api/uploads/${SEMAINE}/${GABON}`)
      .set('X-Reporter-Token', `${lienPour(GABON).split('.')[0]}.signature-bidon`);
    expect(res.status).toBe(403);
  });

  it('laisse passer la rédaction partout', async () => {
    strict();
    for (const chemin of [
      `/api/uploads/${SEMAINE}`,
      `/api/uploads/${SEMAINE}/${AUTRE}`,
      `/api/sujets/${SEMAINE}`,
      `/api/editor/timeline/${SEMAINE}`,
      '/api/analytics',
    ]) {
      const res = await request(app).get(chemin).set('X-Admin-Password', ADMIN);
      expect(res.status, chemin).toBe(200);
    }
  });

  it('laisse le JT livré ouvert à tous — un correspondant sans lien doit le recevoir', async () => {
    strict();
    const res = await request(app).get(`/api/deliveries/${SEMAINE}`);
    expect(res.status).toBe(200);
  });
});

describe('révocation d’un lien', () => {
  it('un lien révoqué ne vaut plus rien, même émis avant', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const id = `lien-a-revoquer-${Math.random()}`;
    const jeton = emettreLien({ pays: GABON, nom: 'Awa', id });

    const avant = await request(app)
      .get(`/api/uploads/${SEMAINE}/${GABON}`)
      .set('X-Reporter-Token', jeton);
    expect(avant.status).toBe(200);

    // Le registre n'a pas d'entrée pour cet id tant qu'on n'a pas émis par
    // l'API : on le révoque directement, c'est le même chemin de données.
    const { enregistrerLien } = await import('../src/data/store.js');
    enregistrerLien({ id, pays: GABON, nom: 'Awa' });
    revoquerLien(id);

    const apres = await request(app)
      .get(`/api/uploads/${SEMAINE}/${GABON}`)
      .set('X-Reporter-Token', jeton);
    expect(apres.status).toBe(403);
  });

  it('n’émet pas de lien « pour le conducteur » — ce n’est pas un pays', async () => {
    const res = await request(app)
      .post('/api/liens')
      .set('X-Admin-Password', ADMIN)
      .send({ pays: 'tj', nom: 'Quelqu’un' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/n'est pas un pays/i);
  });
});

describe('le chemin TUS applique la même portée', () => {
  // TUS est monté avant les middlewares — les analyseurs de corps
  // casseraient le protocole — donc `readReporter` ne s'y exécute pas : il
  // relit le jeton lui-même. C'est le chemin d'envoi le plus utilisé, celui
  // des vidéos depuis un téléphone ; s'il échappait à la portée, tout le
  // reste ne servirait à rien.
  //
  // Ce bloc existe parce qu'un essai sur serveur réel a montré ce que les
  // tests ne voyaient pas : @tus/server v2 passe aux crochets un `Request`
  // de l'API fetch, dont `headers` est un objet `Headers`. L'indexer comme
  // un dictionnaire renvoyait toujours `undefined`, et tout correspondant
  // muni de son lien était traité en inconnu — donc refusé.
  const b64 = (v) => Buffer.from(String(v), 'utf-8').toString('base64');
  const metadonnees = (pays) => [
    `filename ${b64('rush.mp4')}`,
    `name ${b64('rush.mp4')}`,
    `filetype ${b64('video/mp4')}`,
    `weekId ${b64(SEMAINE)}`,
    `countryId ${b64(pays)}`,
  ].join(',');

  const ouvrirEnvoi = (pays, entetes = {}) => {
    const appel = request(app)
      .post('/api/tus/')
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', '2048')
      .set('Upload-Metadata', metadonnees(pays));
    for (const [cle, valeur] of Object.entries(entetes)) appel.set(cle, valeur);
    return appel;
  };

  it('accepte l’envoi du correspondant dans SON pays, jeton en en-tête', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const res = await ouvrirEnvoi(GABON, { 'X-Reporter-Token': lienPour(GABON) });
    expect(res.status).toBe(201);
  });

  it('refuse l’envoi au nom d’un autre pays', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const res = await ouvrirEnvoi(AUTRE, { 'X-Reporter-Token': lienPour(GABON) });
    expect(res.status).toBe(403);
  });

  it('refuse l’envoi de qui ne présente rien', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const res = await ouvrirEnvoi(GABON);
    expect(res.status).toBe(403);
  });

  it('accepte le jeton porté en métadonnée, si un proxy a retiré l’en-tête', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const avecJetonDansMeta = [metadonnees(GABON), `reporterToken ${b64(lienPour(GABON))}`].join(',');
    const res = await request(app)
      .post('/api/tus/')
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', '2048')
      .set('Upload-Metadata', avecJetonDansMeta);
    expect(res.status).toBe(201);
  });

  it('laisse passer la rédaction, y compris sur ses propres chutiers', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const avecMotDePasse = [metadonnees('tj'), `adminPassword ${b64(ADMIN)}`].join(',');
    const res = await request(app)
      .post('/api/tus/')
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', '2048')
      .set('Upload-Metadata', avecMotDePasse);
    expect(res.status).toBe(201);
  });
});

describe('l’archive de la rédaction survit à la portée', () => {
  it('se télécharge par jeton signé, sans en-tête — un <a href> n’en porte aucun', async () => {
    process.env.REPORTER_ACCESS = 'strict';

    const sansJeton = await request(app).get(`/api/uploads/${SEMAINE}/${GABON}/archive`);
    expect(sansJeton.status).toBe(403);

    const emission = await request(app)
      .post('/api/uploads/archive-token')
      .set('X-Admin-Password', ADMIN)
      .send({ weekId: SEMAINE, countryId: GABON });
    expect(emission.status).toBe(200);

    const avecJeton = await request(app)
      .get(`/api/uploads/${SEMAINE}/${GABON}/archive`)
      .query({ dl_token: emission.body.token });
    // 404 « aucun fichier à archiver » et non 403 : la garde a laissé passer.
    expect(avecJeton.status).not.toBe(403);
  });

  it('refuse un jeton émis pour un autre pays', async () => {
    process.env.REPORTER_ACCESS = 'strict';
    const emission = await request(app)
      .post('/api/uploads/archive-token')
      .set('X-Admin-Password', ADMIN)
      .send({ weekId: SEMAINE, countryId: GABON });

    const res = await request(app)
      .get(`/api/uploads/${SEMAINE}/${AUTRE}/archive`)
      .query({ dl_token: emission.body.token });
    expect(res.status).toBe(403);
  });

  it('n’émet aucun jeton d’archive sans mot de passe montage', async () => {
    const res = await request(app)
      .post('/api/uploads/archive-token')
      .send({ weekId: SEMAINE, countryId: GABON });
    expect(res.status).toBe(403);
  });
});
