import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Le suivi des erreurs arrive-t-il vraiment chez Sentry ?
 *
 * L'INCIDENT
 * ----------
 * Le fichier existait, `SENTRY_DSN` était documenté, la garde « no-op si
 * absent » était écrite — et **aucune exception de route n'arrivait.** Trois
 * défauts empilés :
 *
 * 1. `getSentryErrorHandler()` testait `Sentry.Handlers`, retiré du SDK depuis
 *    la v8 (la version installée est une v10). Le test échouait toujours et la
 *    fonction retournait un passe-plat qui ne rapporte rien.
 * 2. `initSentry(app)` posait `setupExpressErrorHandler(app)` **avant** les
 *    routes. Express cherche les gestionnaires d'erreur en avant depuis la
 *    couche fautive : celui-là n'était jamais atteint.
 * 3. `SENTRY_DSN` n'était pas transmis au conteneur.
 *
 * Aucun test ne pouvait le voir : il n'y en avait aucun sur ce module.
 *
 * CE QUE CE TEST FAIT, ET POURQUOI AINSI
 * --------------------------------------
 * Il fait tourner un **vrai point d'entrée Sentry local** — un serveur HTTP qui
 * reçoit ce que le SDK envoie réellement — plutôt qu'un transport de doublure.
 * Une doublure prouve qu'on appelle le SDK ; elle ne prouve pas qu'un événement
 * sort. Ici on lit ce qui part. Rien ne quitte la machine.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

let ingest;
let recu = [];
let sentry;
let app;

/** Les charges utiles de type `event` reçues, décodées. */
function evenements() {
  return recu.flatMap((corps) => {
    const lignes = corps.split('\n').filter(Boolean);
    const sorties = [];
    for (let i = 0; i < lignes.length - 1; i += 1) {
      try {
        if (JSON.parse(lignes[i]).type === 'event') sorties.push(JSON.parse(lignes[i + 1]));
      } catch { /* les en-têtes d'enveloppe ne sont pas tous des items */ }
    }
    return sorties;
  });
}

/** Laisse au SDK le temps d'écouler sa file, sans dormir au hasard. */
async function attendreUnEvenement(limiteMs = 4000) {
  const fin = Date.now() + limiteMs;
  await sentry.flush(2000);
  while (Date.now() < fin) {
    if (evenements().length) return evenements();
    await new Promise((r) => setTimeout(r, 50));
  }
  return evenements();
}

beforeAll(async () => {
  ingest = http.createServer((req, res) => {
    let corps = '';
    req.on('data', (c) => { corps += c; });
    req.on('end', () => {
      recu.push(corps);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"id":"test"}');
    });
  });
  await new Promise((r) => ingest.listen(0, '127.0.0.1', r));
  process.env.SENTRY_DSN = `http://cledetest@127.0.0.1:${ingest.address().port}/1`;

  const { initSentry, getSentryErrorHandler } = await import('../src/monitoring/sentry.js');
  const { errorHandlerMiddleware } = await import('../src/middleware/errorHandler.js');
  sentry = await import('@sentry/node');
  initSentry();

  // Le même ordre que `createApp()` : initialisation en tête, routes, puis le
  // gestionnaire Sentry et le gestionnaire maison tout en bas. C'est cet ordre
  // qui était faux, donc c'est lui qu'on reproduit.
  app = express();
  app.get('/panne', () => {
    const err = new Error('rendu interrompu pour marie.douala@example.org');
    err.statusCode = 500;
    throw err;
  });
  app.get('/refus', () => {
    const err = new Error('semaine inconnue');
    err.statusCode = 400;
    throw err;
  });
  app.use(getSentryErrorHandler());
  app.use(errorHandlerMiddleware);
});

afterAll(() => {
  delete process.env.SENTRY_DSN;
  ingest?.close();
});

beforeEach(() => { recu = []; });

describe('une panne du serveur arrive chez Sentry', () => {
  it('l’exception d’une route y parvient vraiment', async () => {
    // LE test du lot. Avant correction, la seule enveloppe envoyée était un
    // `client_report` sur des spans jetés : pas un seul événement d'erreur.
    const rep = await request(app).get('/panne');
    expect(rep.status).toBe(500);

    const evts = await attendreUnEvenement();
    expect(evts.length, 'aucun événement n’est parti chez Sentry').toBeGreaterThan(0);
    expect(evts[0].exception.values[0].value).toMatch(/rendu interrompu/);
  });

  it('elle porte de quoi situer la requête', async () => {
    // Un rapport sans sa requête est difficile à exploiter. Le SDK n'instrumente
    // pas Express ici (il le faut via `--import`), donc on joint le contexte
    // nous-mêmes.
    await request(app).get('/panne');
    const evts = await attendreUnEvenement();
    expect(evts[0].contexts?.requete).toMatchObject({ methode: 'GET', chemin: '/panne' });
  });

  it('l’adresse d’un correspondant n’y figure pas', async () => {
    // Elle arrive par le message de l'exception, pas par un en-tête : aucune
    // option du SDK ne l'écarte.
    await request(app).get('/panne');
    await attendreUnEvenement();
    expect(recu.join('\n'), 'une adresse est partie chez un tiers').not.toMatch(/marie\.douala@example\.org/);
  });

  it('le mot de passe d’administration n’y figure pas', async () => {
    await request(app).get('/panne').set('X-Admin-Password', 'montage-tres-secret');
    await attendreUnEvenement();
    expect(recu.join('\n')).not.toMatch(/montage-tres-secret/);
  });
});

describe('ce qui ne doit pas encombrer Sentry', () => {
  it('une requête refusée (4xx) ne part pas', async () => {
    // Une validation refusée est le fonctionnement normal de l'application.
    // Les envoyer épuiserait le quota en bruit et noierait les vraies pannes.
    const rep = await request(app).get('/refus');
    expect(rep.status).toBe(400);
    await sentry.flush(1500);
    await new Promise((r) => setTimeout(r, 200));
    expect(evenements(), 'un 4xx est parti chez Sentry').toHaveLength(0);
  });
});

describe('les données de performance', () => {
  it('ne partent pas du tout', async () => {
    // Trouvaille du banc : les enveloppes `transaction` emportent
    // `request.headers` en clair — `x-admin-password` compris — et
    // `beforeSend` ne s'applique pas à elles. Avec le tracé à 0,1 en
    // production, une requête sur dix aurait expédié le mot de passe de
    // l'équipe chez un tiers. Le tracé est donc coupé.
    await request(app).get('/panne').set('X-Admin-Password', 'montage-tres-secret');
    await attendreUnEvenement();
    expect(recu.join('\n'), 'une transaction de performance est partie').not.toMatch(/"type":"transaction"/);
  });
});

describe('le module sans DSN', () => {
  it('rend un passe-plat plutôt que de lever', async () => {
    // C'est le cas courant en développement et en test : le studio doit tourner
    // sans compte Sentry.
    const { getSentryErrorHandler } = await import('../src/monitoring/sentry.js');
    const memoire = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    try {
      const handler = getSentryErrorHandler();
      expect(handler).toHaveLength(4);
      let suivant = null;
      handler(new Error('x'), {}, {}, (e) => { suivant = e; });
      expect(suivant).toBeInstanceOf(Error);
    } finally {
      process.env.SENTRY_DSN = memoire;
    }
  });
});

describe('le code de supervision', () => {
  it('ne s’appuie plus sur une API retirée du SDK', () => {
    // `Sentry.Handlers` a disparu en v8. S'y fier rendait le gestionnaire
    // silencieusement inerte — le fichier compilait, les tests passaient, et
    // rien n'était rapporté.
    const fichiers = (dossier) => readdirSync(dossier, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory()
        ? fichiers(join(dossier, e.name))
        : (e.name.endsWith('.js') ? [join(dossier, e.name)] : [])));
    const sansCommentaires = (code) => code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const coupables = fichiers(join(RACINE, 'src'))
      .filter((f) => /Sentry\.Handlers/.test(sansCommentaires(readFileSync(f, 'utf8'))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(coupables, 'ces fichiers utilisent une API retirée du SDK').toEqual([]);
  });

  it('pose le gestionnaire Sentry après les routes, pas avant', () => {
    // Express cherche les gestionnaires d'erreur **en avant** depuis la couche
    // fautive : posé en tête de pile, celui-ci n'est jamais atteint. C'était le
    // défaut n° 2, et il est invisible à la lecture si l'on ne connaît pas
    // cette règle.
    const source = readFileSync(join(RACINE, 'src/app.js'), 'utf8');
    const init = source.indexOf('initSentry(');
    const routes = source.lastIndexOf("app.use('/api");
    const handler = source.indexOf('getSentryErrorHandler()');
    const maison = source.indexOf('app.use(errorHandlerMiddleware)');
    expect(init).toBeGreaterThan(-1);
    expect(handler, 'le gestionnaire Sentry est posé avant les routes').toBeGreaterThan(routes);
    expect(handler, 'le gestionnaire Sentry passe après le gestionnaire maison').toBeLessThan(maison);
  });

  it('n’installe plus de gestionnaire depuis l’initialisation', () => {
    // `initSentry` ne doit qu'initialiser : c'est en y posant aussi le
    // gestionnaire qu'on l'avait mis au mauvais endroit.
    const source = readFileSync(join(RACINE, 'src/monitoring/sentry.js'), 'utf8');
    const init = source.slice(source.indexOf('export function initSentry'), source.indexOf('export function captureException'));
    expect(init).not.toMatch(/setupExpressErrorHandler|app\.use\(/);
  });
});
