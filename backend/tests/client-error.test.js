import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/app.js';
import { nettoyerSignalement } from '../src/routes/clientError.js';

/**
 * Les plantages du studio, relayés par le backend.
 *
 * POURQUOI CETTE ROUTE EXISTE
 * ---------------------------
 * `VITE_SENTRY_DSN` était documenté dans trois fichiers et **aucun code Sentry
 * n'existait côté navigateur**. Un monteur qui voyait l'écran rouge à Douala
 * un samedi soir était le seul au courant, et il fallait qu'il pense à le
 * dire.
 *
 * CE QU'IL FAUT SURVEILLER
 * ------------------------
 * C'est un chemin d'écriture **non authentifié** — il doit l'être, un plantage
 * survient souvent avant l'écran de connexion — dont le contenu est relayé à un
 * tiers. Tout ce qui arrive ici est hostile par construction.
 */

let app;
let dossier;

beforeAll(() => {
  dossier = mkdtempSync(join(tmpdir(), 'jt-client-error-'));
  app = createApp({ uploadsDir: dossier, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});

afterAll(() => rmSync(dossier, { recursive: true, force: true }));

/**
 * Chaque test parle depuis sa propre adresse : le limiteur de débit compte par
 * IP, et sans cela les tests se refuseraient les uns les autres — l'échec
 * ressemblerait alors à un défaut de la route.
 */
const depuis = (ip) => request(app).post('/api/client-error').set('X-Forwarded-For', ip);

describe('la route de signalement', () => {
  it('accepte un plantage sans qu’on soit connecté', async () => {
    // Le studio peut s'effondrer avant l'écran de connexion, et c'est souvent
    // là que ça compte. Elle est donc montée avant `requireAuth`.
    const rep = await depuis('10.0.0.1')
      .send({ message: 'Cannot read properties of undefined', url: '/studio' });
    expect(rep.status).toBe(204);
  });

  it('avale un corps vide sans bruit', async () => {
    const rep = await depuis('10.0.0.2').send({});
    expect(rep.status).toBe(204);
  });

  it('ne renvoie jamais d’erreur au studio', async () => {
    // Le studio ne doit pas dépendre de cette réponse pour afficher son écran
    // d'erreur — ni la voir échouer au pire moment.
    for (const [i, corps] of [null, 'texte brut', [1, 2, 3], { message: 42 }].entries()) {
      const rep = await depuis(`10.0.1.${i}`).send(corps);
      expect(rep.status, `corps ${JSON.stringify(corps)}`).toBe(204);
    }
  });
});

describe('ce que la route retient d’un signalement', () => {
  it('tronque ce qui est démesuré', () => {
    // Un navigateur en boucle de plantage remplirait le quota Sentry à lui
    // seul, et les vraies pannes seraient jetées faute de place.
    const s = nettoyerSignalement({
      message: 'x'.repeat(5000),
      stack: 'y'.repeat(50000),
      composant: 'z'.repeat(5000),
    });
    expect(s.message).toHaveLength(500);
    expect(s.pile).toHaveLength(4000);
    expect(s.composant).toHaveLength(200);
  });

  it('jette la query string de l’URL', () => {
    // Elle peut porter un jeton de téléchargement : même discipline
    // qu'`errorHandlerMiddleware`, qui journalise `req.path` et jamais
    // `req.originalUrl`.
    expect(nettoyerSignalement({ message: 'x', url: '/livraison?dl_token=secret#a' }).chemin)
      .toBe('/livraison');
  });

  it('expurge l’adresse d’un correspondant', () => {
    // Elle arrive par le message du plantage, pas par un en-tête.
    const s = nettoyerSignalement({ message: 'échec pour paul.yaounde@example.org' });
    expect(s.message).not.toMatch(/paul\.yaounde@example\.org/);
    expect(s.message).toMatch(/\[adresse expurgée\]/);
  });

  it('n’accepte que les deux langues du studio', () => {
    expect(nettoyerSignalement({ message: 'x', langue: 'fr' }).langue).toBe('fr');
    expect(nettoyerSignalement({ message: 'x', langue: 'constructor' }).langue).toBe('');
  });

  it('refuse tout ce qui n’est pas une chaîne', () => {
    // Un objet glissé à la place d'un message finirait sérialisé chez le tiers.
    const s = nettoyerSignalement({ message: { toString: () => 'ruse' }, stack: ['a'], composant: 7 });
    expect(s).toMatchObject({ message: '', pile: '', composant: '' });
  });

  it('tient debout sur n’importe quelle entrée', () => {
    for (const entree of [null, undefined, 'texte', 42, [1], { a: { b: 1 } }]) {
      expect(() => nettoyerSignalement(entree)).not.toThrow();
    }
  });
});

describe('le débit de la route', () => {
  it('refuse au-delà de quelques signalements par adresse', async () => {
    // La route est publique par nécessité et relaie à un tiers. Sans limite,
    // une boucle de plantage chez un seul monteur épuiserait le quota
    // d'erreurs de toute l'association, et les vraies pannes seraient jetées
    // faute de place.
    const max = parseInt(process.env.CLIENT_ERROR_RATE_LIMIT_MAX || 5, 10);
    const codes = [];
    for (let i = 0; i <= max; i += 1) {
      const rep = await depuis('10.9.9.9').send({ message: 'boucle' });
      codes.push(rep.status);
    }
    expect(codes.slice(0, max)).toEqual(Array(max).fill(204));
    expect(codes[max], 'la route accepte un signalement de trop').toBe(429);
  });

  it('est montée avant la garde d’authentification', async () => {
    // Sinon elle serait inutile : un plantage survient souvent avant l'écran
    // de connexion.
    const source = await import('node:fs').then((fs) => fs.readFileSync(
      new URL('../src/app.js', import.meta.url), 'utf8'));
    expect(source).toMatch(/app\.use\('\/api\/client-error', signalementLimiter/);
    expect(source.indexOf("'/api/client-error'")).toBeLessThan(source.indexOf("app.use('/api', requireAuth)"));
  });
});

describe('le coût d’un signalement', () => {
  it('est borné par ce qu’on garde, pas par ce qu’on reçoit', () => {
    // On tronque **avant** d'expurger. L'ordre inverse faisait parcourir les
    // deux mégaoctets que le corps peut porter pour n'en garder que quatre
    // kilo-octets — et c'est ce travail inutile qui a fait expirer ce fichier
    // en intégration continue.
    const debut = Date.now();
    nettoyerSignalement({ message: 'x'.repeat(2_000_000), stack: 'y'.repeat(2_000_000) });
    expect(Date.now() - debut, 'le signalement est parcouru en entier avant d’être tronqué').toBeLessThan(300);
  });

  it('ne laisse pas survivre une adresse à cheval sur la troncature', () => {
    // Le piège de l'ordre « tronquer puis expurger » : coupée en deux, une
    // adresse n'est plus reconnue et son début reste lisible. D'où la marge de
    // découpe, qui vaut la longueur maximale d'une adresse.
    const s = nettoyerSignalement({ message: `${'z'.repeat(490)}marie.douala@example.org${'w'.repeat(100)}` });
    expect(s.message).not.toMatch(/marie|douala|example/);
  });
});
