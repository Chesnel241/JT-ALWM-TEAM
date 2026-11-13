#!/usr/bin/env node
/**
 * Refait les captures du guide « Comment ça marche » (GuideView.jsx).
 *
 * LE BESOIN : un guide en images vieillit à chaque changement d'interface.
 * Plutôt que des captures faites à la main, une commande les refait toutes,
 * aux mêmes cadrages, à partir de l'application qui tourne.
 *
 * Usage, l'application lancée (serveur + `npm run dev`) avec des données de
 * démonstration (au moins un pays avec un reportage, un JT publié) :
 *
 *   GUIDE_MOT_DE_PASSE=… npm run captures:guide
 *
 *   GUIDE_URL           l'adresse de l'application (défaut : http://127.0.0.1:5173)
 *   GUIDE_MOT_DE_PASSE  le mot de passe de l'équipe montage, pour les écrans
 *                       du montage. Lu dans l'environnement, jamais écrit dans
 *                       une adresse ni dans la sortie. Sans lui, seules les
 *                       captures des journalistes sont refaites.
 *   GUIDE_PAYS          le pays montré côté journalistes (défaut : cm)
 *   GUIDE_CHROMIUM      un Chromium déjà installé, si celui de Playwright
 *                       n'est pas téléchargé sur ce poste
 *
 * Les images arrivent dans `public/guide/`, en JPEG (léger et lisible
 * partout). Le test `tests/guide.test.jsx` vérifie que chaque étape du guide
 * a la sienne.
 */
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium, devices } from '@playwright/test';

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = join(ICI, '../public/guide');
const URL_APP = (process.env.GUIDE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const MOT_DE_PASSE = process.env.GUIDE_MOT_DE_PASSE || '';
const PAYS = process.env.GUIDE_PAYS || 'cm';
const JPEG = { type: 'jpeg', quality: 82 };

mkdirSync(SORTIE, { recursive: true });

const attendre = (page, ms = 1200) => page.waitForTimeout(ms);
const centrer = (locator) => locator.evaluate((e) => e.scrollIntoView({ block: 'center' }));

async function journalistes(navigateur) {
  const contexte = await navigateur.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, locale: 'fr-FR' });
  // Un appareil déjà passé par l'accueil : numéro WhatsApp connu, guide des
  // 5W1H déjà lu. Sinon les captures montreraient ces écrans d'entrée.
  await contexte.addInitScript((pays) => {
    localStorage.setItem('jt-alwm-lang', 'fr');
    localStorage.setItem(`uploader_phone_${pays}`, '+237600000000');
    localStorage.setItem('hasSeen5W1H', 'true');
  }, PAYS);
  // L'espace d'un pays inscrit son numéro WhatsApp auprès du serveur : le
  // script ne doit jamais y laisser le faux numéro de démonstration.
  await contexte.route('**/api/notifications/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await contexte.newPage();
  const capture = async (nom, clip = null) => {
    await page.screenshot({ path: join(SORTIE, nom), ...JPEG, ...(clip ? { clip } : {}) });
    console.log(`  ${nom}`);
  };
  const hauteurUtile = 600; // 1200 px une fois doublé : ce que montre l'étape

  await page.goto(`${URL_APP}/journalistes`);
  await attendre(page, 2500);
  await capture('journaliste-accueil.jpg', { x: 0, y: 0, width: 390, height: hauteurUtile });

  await page.goto(`${URL_APP}/journalistes/${PAYS}`);
  await attendre(page, 2500);
  const envoyer = page.getByRole('button', { name: /Envoyer un fichier/ }).first();
  await centrer(envoyer);
  await attendre(page, 500);
  await capture('journaliste-envoi.jpg', { x: 0, y: 0, width: 390, height: hauteurUtile });

  const suivi = page.locator('.jr-suivi:visible').first();
  if (await suivi.count()) {
    await centrer(suivi);
    await attendre(page, 1300);
    const boite = await suivi.boundingBox();
    await capture('journaliste-suivi.jpg', { x: 0, y: Math.max(0, boite.y - 40), width: 390, height: 280 });
  } else {
    console.warn('  (pas de suivi à montrer : il faut un reportage avec des fichiers)');
  }

  await page.goto(`${URL_APP}/journalistes/voix-off`);
  await attendre(page, 2500);
  await capture('journaliste-voixoff.jpg', { x: 0, y: 0, width: 390, height: hauteurUtile });

  await page.goto(`${URL_APP}/journalistes/telecharger-le-jt`);
  await attendre(page, 2500);
  const carte = page.locator('.jr-jt').first();
  if (await carte.count()) {
    await carte.evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -80));
    await attendre(page, 600);
  }
  await capture('journaliste-jt.jpg', { x: 0, y: 0, width: 390, height: hauteurUtile });
  await contexte.close();
}

async function montage(navigateur) {
  if (!MOT_DE_PASSE) {
    console.warn('GUIDE_MOT_DE_PASSE absent : les captures du montage ne sont pas refaites.');
    return;
  }
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'fr-FR' });
  await contexte.addInitScript(() => { localStorage.setItem('jt-alwm-lang', 'fr'); });
  const page = await contexte.newPage();
  const capture = async (nom) => {
    await page.screenshot({ path: join(SORTIE, nom), ...JPEG });
    console.log(`  ${nom}`);
  };
  await page.goto(`${URL_APP}/monteurs`);
  await page.locator('input[type=password]:visible').first().fill(MOT_DE_PASSE);
  await page.locator('button:visible', { hasText: 'Déverrouiller' }).first().click();
  await attendre(page, 3500);

  // La revue des rushes : le chutier du pays.
  await page.getByRole('button', { name: /Rushes reçus/ }).first().click().catch(() => {});
  await attendre(page, 800);
  await page.locator('aside button', { hasText: /Cameroun|Sénégal|Gabon/ }).first().click().catch(() => {});
  await attendre(page, 1500);
  await capture('montage-revue.jpg');

  // Le studio : le déroulé.
  await page.getByRole('button', { name: /Montage du JT/ }).first().click().catch(() => {});
  await attendre(page, 3000);
  await capture('montage-jt-un-clic.jpg');

  // La livraison : le JT publié, sa version téléphone, son sommaire.
  await page.getByRole('button', { name: /Livraison/ }).first().click().catch(() => {});
  await attendre(page, 1500);
  const publies = page.getByText('JT publiés').first();
  if (await publies.count()) await centrer(publies);
  await attendre(page, 600);
  await capture('montage-livraison.jpg');

  // Les statistiques.
  await page.goto(`${URL_APP}/monteurs/stats`);
  await page.getByText('Participation, semaine par semaine').waitFor({ timeout: 20000 }).catch(() => {});
  await attendre(page, 1800);
  await capture('montage-stats.jpg');
  await contexte.close();
}

const navigateur = await chromium.launch(process.env.GUIDE_CHROMIUM ? { executablePath: process.env.GUIDE_CHROMIUM } : {});
try {
  console.log(`Captures du guide → ${SORTIE}`);
  await journalistes(navigateur);
  await montage(navigateur);
} finally {
  await navigateur.close();
}
