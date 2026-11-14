#!/usr/bin/env node
/**
 * Un serveur JT ALWM neuf, pour les tests de bout en bout.
 *
 * Lancé par Playwright (playwright.config.js, `webServer`) : il repart à
 * chaque fois d'un dossier de données vide (`e2e/.banc/donnees`), sur son
 * propre port, avec un mot de passe et un secret de liens propres aux tests.
 * Il ne lit jamais les données ni les secrets d'un vrai déploiement.
 */
import { mkdirSync, rmSync } from 'fs';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BANC, PORT_API, MOT_DE_PASSE_MONTAGE, URL_API, URL_APP } from './banc.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const SERVEUR = join(ICI, '../../../backend');

const donnees = join(BANC, 'donnees');
rmSync(donnees, { recursive: true, force: true });
mkdirSync(join(donnees, 'uploads'), { recursive: true });
mkdirSync(join(donnees, 'logs'), { recursive: true });

Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: String(PORT_API),
  PUBLIC_API_URL: URL_APP,
  UPLOADS_DIR: join(donnees, 'uploads'),
  JT_STORE_PATH: join(donnees, 'store.json'),
  LOG_DIR: join(donnees, 'logs'),
  ADMIN_PASSWORD: MOT_DE_PASSE_MONTAGE,
  REPORTER_TOKEN_SECRET: 'secret-des-tests-de-bout-en-bout-0123456789',
  // Les tests enchaînent des centaines d'appels en quelques minutes : les
  // limites de débit de la production les couperaient.
  RATE_LIMIT_MAX_REQUESTS: '100000',
  GLOBAL_RATE_LIMIT_MAX_REQUESTS: '100000',
  LOGIN_RATE_LIMIT_MAX: '1000',
});
// Des clés de notification propres à ce serveur : sans elles, chaque page
// demandait la clé publique et recevait une erreur 503.
const { generateVAPIDKeys } = createRequire(join(SERVEUR, 'package.json'))('web-push');
const cles = generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = cles.publicKey;
process.env.VAPID_PRIVATE_KEY = cles.privateKey;
delete process.env.SENTRY_DSN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.ALERT_WEBHOOK_URL;
delete process.env.ALERT_EMAIL;

await import(join(SERVEUR, 'src/index.js'));

// Les envois ferment chaque dimanche. Lancés après la clôture, les tests
// trouveraient la semaine verrouillée : on accorde alors à tous un délai,
// comme le ferait l'équipe montage.
const semaines = await (await fetch(`${URL_API}/api/weeks`)).json();
const active = semaines.find((s) => s.status === 'active');
if (active && Date.parse(active.cutoffAt) - Date.now() < 3 * 3600e3) {
  await fetch(`${URL_API}/api/delays/global`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': MOT_DE_PASSE_MONTAGE },
    body: JSON.stringify({ weekId: active.id, minutes: 720 }),
  });
}
