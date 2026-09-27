import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Les réglages de production atteignent-ils vraiment le conteneur ?
 *
 * L'INCIDENT : `REPORTER_ACCESS` — le cran qui décide si le lien personnel
 * protège quelque chose — n'était pas transmis par `docker-compose.yml`, qui
 * énumère les variables une à une (pas d'`env_file`). Le backend retombait
 * donc sur `observe` quoi que dise le `.env` : écrire `strict` ne changeait
 * rien, et n'importe qui pouvait supprimer le fichier d'un correspondant.
 * Le code, ses tests et sa documentation étaient justes ; le fil entre le
 * `.env` et le processus manquait.
 *
 * Un réglage ajouté au backend sans être ajouté ici doit faire échouer ce
 * test, pas se découvrir en production.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '../..');
const compose = readFileSync(join(RACINE, 'docker-compose.yml'), 'utf8');

function blocService(nom) {
  const debut = compose.indexOf(`\n  ${nom}:\n`);
  expect(debut, `service ${nom} introuvable`).toBeGreaterThan(-1);
  const suite = compose.slice(debut + 1);
  const fin = suite.slice(1).search(/\n {2}[a-z_-]+:\n|\n[a-z_]+:\n/);
  return fin === -1 ? suite : suite.slice(0, fin + 1);
}

// Ce que le backend lit et que seul le `.env` du VPS peut fournir.
const REGLAGES_BACKEND = [
  'ADMIN_PASSWORD',
  'WORKER_KEY',
  'REPORTER_TOKEN_SECRET',
  'REPORTER_ACCESS',
  'TRUST_PROXY',
  'CORS_ORIGIN',
  'SENTRY_DSN',
  'ALERT_WEBHOOK_URL',
  'DISK_CAPACITY_MB',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

describe('docker-compose transmet au backend ses réglages de production', () => {
  const backend = blocService('backend');

  it.each(REGLAGES_BACKEND)('%s', (nom) => {
    expect(backend).toMatch(new RegExp(`^\\s*-\\s*${nom}=\\$\\{${nom}[:}?-]`, 'm'));
  });

  it('le cran des liens personnels garde « observe » par défaut', () => {
    // Déployer ne doit fermer la porte à personne : on mesure d'abord
    // (GET /api/liens/etat), on bascule ensuite, à la main.
    expect(backend).toMatch(/REPORTER_ACCESS=\$\{REPORTER_ACCESS:-observe\}/);
  });

  it('chaque réglage lu par le backend est bien un réglage qu’il lit', () => {
    // La liste ci-dessus ne doit pas vieillir en silence : un nom retiré du
    // code, mais encore listé ici, serait une fausse garantie.
    const sources = readdirSync(join(RACINE, 'backend/src'), { recursive: true })
      .filter((f) => String(f).endsWith('.js'))
      .map((f) => readFileSync(join(RACINE, 'backend/src', String(f)), 'utf8'))
      .join('\n');
    for (const nom of REGLAGES_BACKEND) {
      expect(sources, `${nom} n’est lu nulle part`).toMatch(new RegExp(`process\\.env\\.${nom}\\b|process\\.env\\[['"]${nom}['"]\\]`));
    }
  });
});
