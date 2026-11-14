import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'fs';
import { PORT_APP, URL_API, URL_APP } from './e2e/outils/banc.mjs';

/**
 * Les tests de bout en bout : la vraie application, contre un vrai serveur.
 *
 *   npm run test:e2e
 *
 * Playwright lance lui-même un serveur JT ALWM neuf (e2e/outils/serveur.mjs,
 * données vides, mot de passe propre aux tests) et l'application (Vite),
 * puis joue les parcours d'un correspondant sur téléphone et d'un monteur sur
 * ordinateur. Rien n'est simulé : les fichiers partent réellement par tus,
 * le serveur les mesure avec ffprobe et en fabrique les aperçus avec ffmpeg.
 *
 * Il faut ffmpeg (celui du système, ou celui que le serveur embarque) et
 * Python 3 pour fabriquer les fichiers d'essai (e2e/outils/fichiers.mjs).
 */

// Le Chromium préinstallé d'un poste ou d'une intégration continue, s'il y
// en a un ; sinon celui que télécharge `npx playwright install chromium`.
const CHROMIUM = process.env.E2E_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const lancement = CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  globalSetup: './e2e/outils/preparation.mjs',
  // Chaque fichier de tests travaille sur ses propres pays : ils peuvent
  // tourner en même temps ; à l'intérieur d'un fichier, l'ordre compte.
  fullyParallel: false,
  workers: process.env.CI ? 1 : 3,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: URL_APP,
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
    trace: 'off',
    ...lancement,
  },
  projects: [
    {
      name: 'telephone',
      testMatch: /journalistes\.spec\.js/,
      use: {
        ...devices['Pixel 7'],
        // Un faux micro, fourni par Chromium : la voix off s'enregistre pour
        // de vrai (MediaRecorder), sans matériel ni fenêtre d'autorisation.
        permissions: ['microphone'],
        launchOptions: {
          ...(lancement.launchOptions || {}),
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
    {
      name: 'ordinateur',
      testIgnore: /journalistes\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...lancement },
    },
  ],
  webServer: [
    {
      command: 'node e2e/outils/serveur.mjs',
      url: `${URL_API}/health`,
      reuseExistingServer: !!process.env.E2E_REUTILISER,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${PORT_APP} --strictPort`,
      url: URL_APP,
      env: { JT_API_CIBLE: URL_API },
      reuseExistingServer: !!process.env.E2E_REUTILISER,
      timeout: 120_000,
    },
  ],
});
