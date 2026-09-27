import { describe, it, expect, afterEach, afterAll, beforeAll, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { TEST_UPLOADS_DIR, RACINE_TESTS } from './setup.js';

/**
 * Où les abonnements aux notifications sont enregistrés — et ce qui n'en sort
 * jamais.
 *
 * L'INCIDENT : le module calculait son chemin depuis son propre fichier
 * source, trois niveaux au-dessus de `src/data/`. Dans l'image Docker, cela
 * donne `/uploads/…`, à la racine du conteneur — pas `/app/uploads`, où est
 * monté le volume persistant. Le processus tourne en utilisateur `node` et
 * `/uploads` n'existe pas : l'écriture échouait, l'erreur n'était que
 * journalisée, et les abonnements ne vivaient qu'en mémoire. Chaque
 * redéploiement désabonnait en silence tous ceux qui avaient activé les
 * notifications.
 *
 * LE PIÈGE DU CORRECTIF : le ranger dans le dossier des envois. Ce dossier
 * est servi sans authentification par `/uploads` ; les adresses de
 * notification et les clés de chaque appareil seraient devenues
 * téléchargeables par quiconque devine le nom du fichier. D'où les deux
 * derniers tests : le fichier vit à côté du store, et le serveur refuse de
 * servir un fichier d'état même s'il se retrouve dans le dossier servi.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const storeAvant = process.env.JT_STORE_PATH;
let dossier;

async function moduleNeuf() {
  vi.resetModules();
  return import('../src/data/webpushSubscriptions.js');
}

afterEach(() => {
  process.env.JT_STORE_PATH = storeAvant;
  if (dossier) rmSync(dossier, { recursive: true, force: true });
  dossier = null;
});

const abonnement = { endpoint: 'https://push.example/abc', keys: { auth: 'a', p256dh: 'p' } };

describe('les abonnements aux notifications', () => {
  it('sont écrits à côté du store, sur le volume persistant', async () => {
    dossier = mkdtempSync(join(RACINE_TESTS, 'jt-webpush-'));
    process.env.JT_STORE_PATH = join(dossier, 'store.json');
    const store = await moduleNeuf();
    await store.initWebPushDb();
    await store.addSubscription(abonnement, { audience: 'reporter', countryId: 'cm' });

    const fichier = join(dossier, 'webpush_subscriptions.json');
    expect(existsSync(fichier), 'l’abonnement n’est pas à côté du store').toBe(true);
    expect(JSON.parse(readFileSync(fichier, 'utf8'))[abonnement.endpoint].countryId).toBe('cm');
  });

  it('ne sont jamais rangés dans le dossier servi par /uploads', async () => {
    dossier = mkdtempSync(join(RACINE_TESTS, 'jt-webpush-'));
    process.env.JT_STORE_PATH = join(dossier, 'store.json');
    const store = await moduleNeuf();
    await store.initWebPushDb();
    await store.addSubscription(abonnement, { audience: 'editor' });

    expect(existsSync(join(TEST_UPLOADS_DIR, 'webpush_subscriptions.json'))).toBe(false);
    const { uploadsDir, dataDir } = await import('../src/lib/paths.js');
    expect(resolve(dataDir()).startsWith(resolve(uploadsDir()) + '/')).toBe(false);
  });

  it('survivent à un redémarrage du serveur', async () => {
    // C'est ce que l'ancien chemin empêchait : rien n'était écrit, donc rien
    // n'était relu.
    dossier = mkdtempSync(join(RACINE_TESTS, 'jt-webpush-'));
    process.env.JT_STORE_PATH = join(dossier, 'store.json');
    const premier = await moduleNeuf();
    await premier.initWebPushDb();
    await premier.addSubscription(abonnement, { audience: 'editor' });

    const apresRedemarrage = await moduleNeuf();
    await apresRedemarrage.initWebPushDb();
    expect(apresRedemarrage.getSubscriptions({ audiences: ['editor'] })).toHaveLength(1);
  });

  it('ne dépendent plus de l’emplacement du code source', () => {
    const source = readFileSync(join(RACINE, 'src/data/webpushSubscriptions.js'), 'utf8');
    expect(source).not.toMatch(/__dirname/);
    expect(source).toMatch(/dataDir\(\)/);
  });
});

describe('les fichiers d’état du serveur, posés dans le dossier servi', () => {
  // Le cas du développement (store.json vit DANS le dossier des envois) et
  // celui d'un UPLOADS_DIR mal réglé en production.
  let app;
  const poses = ['store.json', 'webpush_subscriptions.json', 'store.json.123.tmp'];

  beforeAll(async () => {
    for (const nom of poses) writeFileSync(join(TEST_UPLOADS_DIR, nom), '{"secret":"x"}');
    writeFileSync(join(TEST_UPLOADS_DIR, 'rush-temoin.mp4'), 'video');
    vi.resetModules();
    const { createApp } = await import('../src/app.js');
    app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
  });

  afterAll(() => {
    for (const nom of [...poses, 'rush-temoin.mp4']) rmSync(join(TEST_UPLOADS_DIR, nom), { force: true });
  });

  it.each([
    '/uploads/store.json',
    '/uploads/webpush_subscriptions.json',
    '/uploads/store.json.123.tmp',
    '/uploads/store%2Ejson',
    '/api/uploads/files/webpush_subscriptions.json',
    '/uploads/webpush_subscriptions.json?dl=1',
  ])('%s n’est pas servi', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('secret');
  });

  it('un rush du même dossier reste servi', async () => {
    const res = await request(app).get('/uploads/rush-temoin.mp4');
    expect(res.status).toBe(200);
  });
});
