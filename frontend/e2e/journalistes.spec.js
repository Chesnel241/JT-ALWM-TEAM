import { test, expect } from '@playwright/test';
import { preparerFichiers } from './outils/fichiers.mjs';
import {
  entrerCommeCorrespondant, fichiersRecus, semaineActive, surveillerErreurs, ENTETE_MONTAGE,
} from './outils/parcours.mjs';
import { URL_API } from './outils/banc.mjs';

/**
 * Le parcours d'un correspondant, sur un téléphone Android.
 *
 * LE BESOIN (le propriétaire) : « se rassurer que tout fonctionne : le
 * passage d'un onglet à l'autre, le clic des boutons, l'actualisation des
 * informations ». Chaque test part d'une page réelle, servie par un vrai
 * serveur, et finit sans erreur dans la console ni réponse en erreur.
 */

const PAYS = 'sn';
const NUMERO = '771234567';

let fichiers;
let semaine;

test.beforeAll(async ({ request }) => {
  fichiers = preparerFichiers();
  semaine = (await semaineActive(request)).id;
});

const fichier = (nom) => fichiers.find((f) => f.nom === nom).chemin;

test('l’accueil s’ouvre sur le sablier et les pays, sans erreur', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await page.goto('/journalistes');
  await expect(page.getByRole('heading', { name: 'Que souhaitez-vous faire ?' })).toBeVisible();
  await expect(page.locator('.cr-sablier:visible')).toHaveCount(1);
  await expect(page.getByRole('timer').first()).toHaveAccessibleName(/Temps restant pour envoyer|Les envois de la semaine sont clôturés/);
  await expect(page.getByRole('button', { name: /^Entrer dans / })).toHaveCount(7);
  expect(erreurs()).toEqual([]);
});

test('un pays s’ouvre d’un geste, et son adresse se garde', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await page.goto('/journalistes');
  await page.getByRole('button', { name: 'Entrer dans Sénégal' }).click();
  await expect(page).toHaveURL(/\/journalistes\/sn$/);
  await expect(page.getByText('Votre numéro WhatsApp, avant le premier envoi').filter({ visible: true }).first()).toBeVisible();
  // Le lien qu'on se transmet par WhatsApp rouvre le même écran. (On laisse
  // la page finir de charger : la recharger en plein chargement coupe ses
  // requêtes, ce que la console signale à juste titre.)
  await page.waitForLoadState('networkidle');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Votre numéro WhatsApp, avant le premier envoi').filter({ visible: true }).first()).toBeVisible();
  // « Accueil » ramène au choix du pays.
  await page.getByRole('button', { name: 'Revenir à l’accueil journalistes' }).click();
  await expect(page).toHaveURL(/\/journalistes\/?$/);
  expect(erreurs()).toEqual([]);
});

test('les onglets mènent chacun à leur page, et le retour du téléphone revient en arrière', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await entrerCommeCorrespondant(page, PAYS, { numero: NUMERO, titres: ['Rentrée scolaire à Pikine'] });
  const onglet = (nom) => page.getByRole('button', { name: nom, exact: true }).filter({ visible: true }).first();

  await onglet('Voix off').click();
  await expect(page).toHaveURL(/\/journalistes\/voix-off$/);
  await expect(onglet('Voix off')).toHaveAttribute('aria-current', 'page');

  await onglet('Le JT').click();
  await expect(page).toHaveURL(/\/journalistes\/telecharger-le-jt$/);
  await expect(onglet('Le JT')).toHaveAttribute('aria-current', 'page');

  await page.goBack();
  await expect(page).toHaveURL(/\/journalistes\/voix-off$/);

  // « Reportage » ramène au pays en cours, pas à un second choix de pays.
  await onglet('Reportage').click();
  await expect(page).toHaveURL(/\/journalistes\/sn$/);
  await expect(page.getByRole('heading', { name: 'Rentrée scolaire à Pikine' }).filter({ visible: true }).first()).toBeVisible();
  expect(erreurs()).toEqual([]);
});

test('actualiser la page garde l’écran où l’on était', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  for (const chemin of ['/journalistes/telecharger-le-jt', '/journalistes/voix-off', '/journalistes/comment-ca-marche', '/journalistes/conducteur', '/journalistes/mot-du-jt']) {
    await page.goto(chemin);
    // On laisse la page finir de charger : recharger en plein chargement
    // coupe ses requêtes, ce que la console signale à juste titre.
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page, chemin).toHaveURL(new RegExp(`${chemin}$`));
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.getByText(/Une erreur est survenue|Something went wrong/)).toHaveCount(0);
  }
  expect(erreurs()).toEqual([]);
});

test('un premier envoi : la vidéo part, arrive, et le correspondant le voit', async ({ page, request }) => {
  const erreurs = surveillerErreurs(page);
  await entrerCommeCorrespondant(page, 'cd', { numero: '812345678', titres: ['Le marché de Kinshasa'] });
  const espace = page.locator('#espace-fichiers-mobile');
  await espace.locator('input[type=file]').first().setInputFiles(fichier('telephone.mp4'));
  await expect(espace.getByText('Terminé !').first()).toBeVisible({ timeout: 30_000 });
  const recus = await fichiersRecus(request, semaine, 'cd');
  expect(recus.map((f) => [f.name, f.type])).toEqual([['telephone.mp4', 'video']]);
  // Le fichier apparaît dans son reportage, sans recharger la page.
  await expect(espace.getByText('telephone.mp4').first()).toBeVisible();
  expect(erreurs()).toEqual([]);
});

test('l’écran se met à jour quand le montage valide un fichier, sans recharger', async ({ page, request }) => {
  const erreurs = surveillerErreurs(page);
  await entrerCommeCorrespondant(page, 'cg', { numero: '066123456', titres: ['La pêche reprend'] });
  await page.locator('#espace-fichiers-mobile input[type=file]').first().setInputFiles(fichier('interview.mp3'));
  await expect(page.locator('#espace-fichiers-mobile').getByText('Terminé !').first()).toBeVisible({ timeout: 30_000 });

  // Le montage valide le son, depuis son poste.
  const [recu] = await fichiersRecus(request, semaine, 'cg');
  const r = await request.patch(`${URL_API}/api/uploads/${semaine}/files/${recu.id}/status`, {
    headers: { ...ENTETE_MONTAGE, 'Content-Type': 'application/json' },
    data: { status: 'approved' },
  });
  expect(r.ok()).toBeTruthy();

  // Le correspondant revient sur la page (il était sur WhatsApp) : l'écran
  // relit, sans qu'il recharge quoi que ce soit.
  const valide = page.locator('#espace-fichiers-mobile').getByText('Validé', { exact: true }).first();
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(valide).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  expect(erreurs()).toEqual([]);
});

test('la langue passe en anglais, et le reste après rechargement', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await page.goto('/journalistes');
  await page.getByRole('button', { name: 'English' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible();
  await page.getByRole('button', { name: 'Français' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Que souhaitez-vous faire ?' })).toBeVisible();
  expect(erreurs()).toEqual([]);
});

test('« Gros caractères » agrandit le texte, et s’en souvient', async ({ page }) => {
  await page.goto('/journalistes');
  const taille = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const avant = await taille();
  await page.getByRole('button', { name: 'Gros caractères' }).filter({ visible: true }).first().click();
  await expect.poll(taille).toBeGreaterThan(avant);
  await page.reload();
  await expect.poll(taille).toBeGreaterThan(avant);
});

test('le guide en images s’ouvre, ses images se chargent, « Retour » ramène', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await page.goto('/journalistes');
  await page.getByRole('button', { name: 'Le guide en images' }).click();
  await expect(page).toHaveURL(/\/journalistes\/comment-ca-marche$/);
  await expect(page.getByRole('heading', { name: 'Comment ça marche' })).toBeVisible();
  const images = page.locator('main img[src^="/guide/"]');
  await expect(images).toHaveCount(5);
  for (let i = 0; i < 5; i += 1) {
    const img = images.nth(i);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(true);
  }
  await page.getByRole('button', { name: /Retour/ }).first().click();
  await expect(page).toHaveURL(/\/journalistes\/?$/);
  expect(erreurs()).toEqual([]);
});

test('« Garder mon accès » et « Rappel dans mon agenda » répondent', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await entrerCommeCorrespondant(page, 'ci', { numero: '0701020304', titres: ['Abidjan se prépare'] });
  await page.getByRole('button', { name: /Garder mon accès/ }).first().click();
  const feuille = page.getByRole('dialog');
  await expect(feuille).toBeVisible();
  await expect(feuille.getByRole('link', { name: /WhatsApp/ }).first()).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=.*journalistes%2Fci/);
  await page.keyboard.press('Escape');
  await expect(feuille).toBeHidden();

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Rappel dans mon agenda|Rappel agenda/ }).first().click(),
  ]);
  expect(telechargement.suggestedFilename()).toMatch(/\.ics$/);
  expect(erreurs()).toEqual([]);
});

test.describe('la voix off', () => {
  // Les deux tests écrivent dans le même pays : l'un après l'autre.
  test.describe.configure({ mode: 'serial' });
  const PAYS_VOIX = 'ci';
  const voixRecues = async (request) => (await fichiersRecus(request, semaine, PAYS_VOIX)).filter((f) => / - Voix \(Studio\)\.mp3$/.test(f.name));

  test('enregistrée au micro du téléphone, elle part au monteur en MP3', async ({ page, request }) => {
    const erreurs = surveillerErreurs(page);
    await page.goto('/journalistes/voix-off');
    await page.getByRole('button', { name: "Côte d'Ivoire" }).click();
    await page.locator('main input[type=text]:visible').first().fill('Abidjan se prépare');
    await page.locator('main textarea:visible').first().fill('À Abidjan, les préparatifs de la fête battent leur plein.');

    await page.getByRole('button', { name: 'Commencer l’enregistrement' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.waitForTimeout(2500); // le temps de dire une phrase
    await page.getByRole('button', { name: 'Terminer' }).first().click();
    await page.getByRole('button', { name: 'Envoyer au monteur' }).click();
    await expect(page.getByText('Votre voix off est arrivée chez le monteur.').first()).toBeVisible({ timeout: 30_000 });

    const voix = await voixRecues(request);
    expect(voix.map((f) => [f.name, f.type])).toEqual([['Abidjan se prépare - Voix (Studio).mp3', 'audio']]);
    // Le MP3 fabriqué par le serveur se lit, et dure le temps de la prise.
    const duree = await page.evaluate((url) => new Promise((resolve) => {
      const a = new Audio(url);
      a.onloadedmetadata = () => resolve(a.duration);
      a.onerror = () => resolve(0);
    }), `/uploads/${encodeURIComponent(voix[0].filename)}`);
    expect(duree).toBeGreaterThan(1.5);
    expect(erreurs()).toEqual([]);
  });

  test('envoyée depuis un fichier — une note vocale WhatsApp —, elle part aussi', async ({ page, request }) => {
    const erreurs = surveillerErreurs(page);
    await page.goto('/journalistes/voix-off');
    await page.getByRole('button', { name: "Côte d'Ivoire" }).click();
    // (Les boutons de reportage portent les vrais titres du pays quand il en
    // a déjà donné : on écrit simplement le titre de cette voix.)
    await page.locator('main input[type=text]:visible').first().fill('Le port reprend');
    await page.getByRole('button', { name: 'Avec un fichier audio' }).click();
    await page.locator('main input[type=file]').first().setInputFiles(fichier('whatsapp.ogg'));
    await page.getByRole('button', { name: 'Envoyer au monteur' }).click();
    await expect(page.getByText('Votre voix off est arrivée chez le monteur.').first()).toBeVisible({ timeout: 30_000 });

    const noms = (await voixRecues(request)).map((f) => f.name);
    expect(noms).toContain('Le port reprend - Voix (Studio).mp3');
    expect(erreurs()).toEqual([]);
  });
});
