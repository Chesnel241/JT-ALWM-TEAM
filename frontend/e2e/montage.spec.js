import { test, expect, devices } from '@playwright/test';
import { preparerFichiers } from './outils/fichiers.mjs';
import {
  deverrouillerMontage, entrerCommeCorrespondant, fichiersRecus, semaineActive, surveillerErreurs, restantsApres,
} from './outils/parcours.mjs';
import { MOT_DE_PASSE_MONTAGE } from './outils/banc.mjs';

/**
 * Le parcours de l'équipe montage, sur ordinateur — et ce que les
 * correspondants en voient, sur leur téléphone, au même moment.
 *
 * LE BESOIN (le propriétaire) : « se rassurer que tout fonctionne : le
 * passage d'un onglet à l'autre, le clic des boutons, l'actualisation des
 * informations ». Deux navigateurs tournent ensemble dans plusieurs tests :
 * celui d'un monteur et celui d'un correspondant, contre le même serveur.
 */

const PAYS = 'ma';
const NOM_PAYS = 'Maroc';
const NUMERO = '612345678';

test.describe.configure({ mode: 'serial' });

let fichiers;
let semaine;
const fichier = (nom) => fichiers.find((f) => f.nom === nom).chemin;

test.beforeAll(async ({ request }) => {
  fichiers = preparerFichiers();
  semaine = (await semaineActive(request)).id;
});

/** Un correspondant sur son téléphone, dans son propre navigateur. */
async function telephone(browser) {
  const contexte = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR', timezoneId: 'Africa/Casablanca' });
  const page = await contexte.newPage();
  return { contexte, page, erreurs: surveillerErreurs(page) };
}

const etapes = (page) => page.getByRole('navigation', { name: 'Les étapes du JT' });
// « Espace Montage » porte un compteur quand des fichiers viennent d'arriver
// (« 31 Espace Montage ») : on cherche le nom en fin de libellé.
const espaces = (page, nom) => page.getByRole('button', { name: new RegExp(`${nom}$`) }).filter({ visible: true }).first();
const carte = (page, nom) => page.locator(`[data-fichier="${nom}"]`);

test('un mauvais mot de passe est refusé, le bon ouvre l’espace montage', async ({ page }) => {
  // Le refus est provoqué exprès : on vérifie qu'il est dit clairement.
  const erreurs = surveillerErreurs(page, { toleres: ['/api/auth/check-admin'] });
  await page.goto('/monteurs');
  const champ = page.locator('input[type=password]:visible').first();
  await champ.fill('pas-le-bon-mot-de-passe');
  await page.locator('button:visible', { hasText: 'Déverrouiller' }).first().click();
  await expect(page.getByText('Mot de passe incorrect')).toBeVisible();
  await expect(etapes(page)).toHaveCount(0);

  await champ.fill(MOT_DE_PASSE_MONTAGE);
  await page.locator('button:visible', { hasText: 'Déverrouiller' }).first().click();
  await expect(etapes(page)).toBeVisible();
  // Jamais dans l'adresse (elle finit dans l'historique et les journaux).
  expect(page.url()).not.toContain(MOT_DE_PASSE_MONTAGE);
  expect(erreurs()).toEqual([]);
});

test('les quatre étapes du JT s’ouvrent, et « Rushes reçus » ramène toujours aux rushes', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await deverrouillerMontage(page);
  const courant = etapes(page).locator('[aria-current=page]');

  await etapes(page).getByRole('button', { name: 'Jingles' }).click();
  await expect(page.getByRole('heading', { name: 'Jingles du JT' })).toBeVisible();
  await expect(courant).toHaveText(/Jingles/);

  await etapes(page).getByRole('button', { name: 'Livraison' }).click();
  await expect(page.getByRole('heading', { name: 'Livraison JT' })).toBeVisible();
  await expect(courant).toHaveText(/Livraison/);

  await etapes(page).getByRole('button', { name: 'Montage du JT' }).click();
  await expect(page.getByRole('heading', { name: 'Déroulé du JT' })).toBeVisible();
  await expect(courant).toHaveText(/Montage du JT/);

  // Après les jingles et la livraison, l'onglet rouvrait… les jingles.
  for (const detour of ['Jingles', 'Livraison', 'Montage du JT']) {
    await etapes(page).getByRole('button', { name: detour }).click();
    await etapes(page).getByRole('button', { name: 'Rushes reçus' }).click();
    await expect(courant, `retour depuis ${detour}`).toHaveText(/Rushes reçus/);
    await expect(page.getByRole('heading', { name: 'Jingles du JT' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Livraison JT' })).toHaveCount(0);
  }
  expect(erreurs()).toEqual([]);
});

test('le mot de passe n’est demandé qu’une fois pour tous les écrans du montage', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await deverrouillerMontage(page);
  const porte = page.locator('input[type=password]:visible');

  await espaces(page, 'Programmation').click();
  await expect(page).toHaveURL(/\/monteurs\/planning$/);
  await expect(page.getByText('Qui monte quoi, chaque semaine')).toBeVisible();
  await expect(porte).toHaveCount(0);

  await espaces(page, 'Stats & Délais').click();
  await expect(page).toHaveURL(/\/monteurs\/stats$/);
  await expect(page.getByRole('heading', { name: 'Statistiques et délais' })).toBeVisible();
  await expect(porte).toHaveCount(0);

  await espaces(page, 'Voix Off').click();
  await expect(page).toHaveURL(/\/monteurs\/voix-off$/);
  await expect(page.getByRole('heading', { name: 'Studio Voix Off' })).toBeVisible();

  await espaces(page, 'JT Prêt').click();
  await expect(page).toHaveURL(/\/monteurs\/jt-pret$/);
  await expect(page.getByRole('heading', { name: 'JT Prêt' })).toBeVisible();

  await espaces(page, 'Espace Reportages').click();
  await expect(page).toHaveURL(/\/monteurs\/reportages$/);
  await expect(page.getByRole('heading', { name: 'Choisissez votre pays' })).toBeVisible();

  await espaces(page, 'Espace Montage').click();
  await expect(page).toHaveURL(/\/monteurs\/?$/);
  await expect(etapes(page)).toBeVisible();
  await expect(porte).toHaveCount(0);

  // Et dans l'autre sens : après un rechargement, déverrouiller la
  // programmation ouvre aussi l'espace montage.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/monteurs/planning');
  await page.locator('input[type=password]:visible').first().fill(MOT_DE_PASSE_MONTAGE);
  await page.locator('button:visible', { hasText: 'Déverrouiller' }).first().click();
  await expect(page.getByText('Qui monte quoi, chaque semaine')).toBeVisible();
  await espaces(page, 'Espace Montage').click();
  await expect(etapes(page)).toBeVisible();
  await expect(porte).toHaveCount(0);
  expect(erreurs()).toEqual([]);
});

test('un envoi arrive chez le montage en direct, sans recharger la page', async ({ page, browser }) => {
  const erreurs = surveillerErreurs(page);
  await deverrouillerMontage(page);
  await expect(page.locator('aside button', { hasText: NOM_PAYS })).toHaveCount(0);

  const correspondant = await telephone(browser);
  await entrerCommeCorrespondant(correspondant.page, PAYS, { numero: NUMERO, titres: ['La médina de Fès'] });
  const espace = correspondant.page.locator('#espace-fichiers-mobile');
  await espace.locator('input[type=file]').first().setInputFiles([fichier('telephone.mp4'), fichier('interview.mp3'), fichier('photo.jpg')]);
  await expect(espace.getByText('Terminé !').first()).toBeVisible({ timeout: 30_000 });

  // Le monteur n'a touché à rien : le pays apparaît, avec son compteur.
  const chutier = page.locator('aside button', { hasText: NOM_PAYS }).first();
  await expect(chutier).toBeVisible({ timeout: 15_000 });
  await expect(chutier).toContainText('3 à revoir');
  await expect(page.getByText(/3 nouveaux fichiers.*Maroc|Maroc.*3 nouveaux fichiers/).first()).toBeVisible();

  await chutier.click();
  for (const nom of ['telephone.mp4', 'interview.mp3', 'photo.jpg']) await expect(carte(page, nom)).toBeVisible();
  // Le reportage porte le titre donné par le correspondant.
  await expect(page.getByText('La médina de Fès').first()).toBeVisible();

  expect(erreurs()).toEqual([]);
  expect(correspondant.erreurs()).toEqual([]);
  await correspondant.contexte.close();
});

test('les filtres par type ne montrent que la famille demandée', async ({ page }) => {
  await deverrouillerMontage(page);
  await page.locator('aside button', { hasText: NOM_PAYS }).first().click();
  const filtre = (nom) => page.getByRole('button', { name: nom, exact: true });

  await filtre('Vidéos').click();
  await expect(carte(page, 'telephone.mp4')).toBeVisible();
  await expect(carte(page, 'interview.mp3')).toHaveCount(0);
  await expect(carte(page, 'photo.jpg')).toHaveCount(0);

  await filtre('Audios').click();
  await expect(carte(page, 'interview.mp3')).toBeVisible();
  await expect(carte(page, 'telephone.mp4')).toHaveCount(0);

  await filtre('Images').click();
  await expect(carte(page, 'photo.jpg')).toBeVisible();
  await expect(carte(page, 'interview.mp3')).toHaveCount(0);

  await filtre('Tous').click();
  for (const nom of ['telephone.mp4', 'interview.mp3', 'photo.jpg']) await expect(carte(page, nom)).toBeVisible();
});

test('« Tout valider » valide tout le reportage d’un geste, et « Annuler » revient en arrière', async ({ page, request }) => {
  const erreurs = surveillerErreurs(page);
  await deverrouillerMontage(page);
  await page.locator('aside button', { hasText: NOM_PAYS }).first().click();
  const statuts = async () => (await fichiersRecus(request, semaine, PAYS)).map((f) => f.status).sort();
  expect(await statuts()).toEqual(['pending', 'pending', 'pending']);

  await page.getByRole('button', { name: 'Tout valider (3)' }).click();
  await expect(page.getByText('3 fichiers validés')).toBeVisible();
  await expect.poll(statuts).toEqual(['approved', 'approved', 'approved']);
  for (const nom of ['telephone.mp4', 'interview.mp3', 'photo.jpg']) {
    await expect(carte(page, nom).locator('[data-statut]')).toHaveAttribute('data-statut', 'approved');
  }

  // Un geste trop rapide se rattrape pendant quelques secondes.
  await page.getByRole('button', { name: 'Annuler', exact: true }).last().click();
  await expect.poll(statuts).toEqual(['pending', 'pending', 'pending']);
  await expect(carte(page, 'photo.jpg').locator('[data-statut]')).toHaveAttribute('data-statut', 'pending');
  expect(erreurs()).toEqual([]);
});

test('valider puis refuser : le correspondant le voit sur son téléphone, sans recharger', async ({ page, browser, request }) => {
  const erreurs = surveillerErreurs(page);
  const correspondant = await telephone(browser);
  await entrerCommeCorrespondant(correspondant.page, PAYS, { numero: NUMERO });
  const espace = correspondant.page.locator('#espace-fichiers-mobile');
  await expect(espace.getByText('telephone.mp4').first()).toBeVisible();

  await deverrouillerMontage(page);
  await page.locator('aside button', { hasText: NOM_PAYS }).first().click();

  // Valider : un geste, sans fenêtre.
  await carte(page, 'telephone.mp4').getByRole('button', { name: 'Valider', exact: true }).click();
  await expect(carte(page, 'telephone.mp4').locator('[data-statut]')).toHaveAttribute('data-statut', 'approved');
  await expect(page.getByText('« telephone.mp4 » validé')).toBeVisible();

  // Refuser : la fenêtre demande le motif.
  await carte(page, 'interview.mp3').getByRole('button', { name: 'Refuser', exact: true }).click();
  const boite = page.getByRole('dialog');
  await expect(boite).toBeVisible();
  await boite.getByText('Rush Refusé (À refaire)').click();
  await boite.locator('textarea').first().fill('Le son sature : merci de refaire la prise.');
  await boite.getByRole('button', { name: /Enregistrer|Envoyer|Valider/ }).last().click();
  await expect(boite).toBeHidden();
  await expect(carte(page, 'interview.mp3').locator('[data-statut]')).toHaveAttribute('data-statut', 'rejected');

  // Le serveur a bien les deux décisions.
  const statuts = Object.fromEntries((await fichiersRecus(request, semaine, PAYS)).map((f) => [f.name, f.status]));
  expect(statuts).toMatchObject({ 'telephone.mp4': 'approved', 'interview.mp3': 'rejected', 'photo.jpg': 'pending' });

  // Le correspondant revient sur la page : les deux décisions s'affichent.
  await expect(async () => {
    await correspondant.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(espace.getByText('Validé', { exact: true }).first()).toBeVisible({ timeout: 1000 });
    await expect(espace.getByText(/Refusé|À corriger/).first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect(espace.getByText(/Le son sature/).first()).toBeVisible();

  expect(erreurs()).toEqual([]);
  expect(correspondant.erreurs()).toEqual([]);
  await correspondant.contexte.close();
});

test('le ZIP du pays se télécharge', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await deverrouillerMontage(page);
  await page.locator('aside button', { hasText: NOM_PAYS }).first().click();
  // L'archive d'un pays peut peser des gigaoctets : elle se confirme.
  await page.getByRole('button', { name: /Télécharger ZIP/ }).first().click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation).toBeVisible();
  const [telechargement] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    confirmation.getByRole('button', { name: /Télécharger|Confirmer/ }).last().click(),
  ]);
  expect(telechargement.suggestedFilename()).toMatch(/\.zip$/i);
  const chemin = await telechargement.path();
  const { statSync, openSync, readSync, closeSync } = await import('fs');
  expect(statSync(chemin).size).toBeGreaterThan(50_000);
  const tete = Buffer.alloc(2);
  const fd = openSync(chemin, 'r');
  readSync(fd, tete, 0, 2, 0);
  closeSync(fd);
  expect(tete.toString('latin1')).toBe('PK');
  expect(erreurs()).toEqual([]);
});

test('« Ajouter au JT » pose le plan dans le déroulé du studio', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await deverrouillerMontage(page);
  await page.locator('aside button', { hasText: NOM_PAYS }).first().click();
  await carte(page, 'telephone.mp4').getByRole('button', { name: 'Ajouter au JT' }).click();
  // On reste dans les rushes ; l'onglet du studio compte le plan.
  await expect(etapes(page).getByRole('button', { name: /Montage du JT/ })).toContainText('1');
  await etapes(page).getByRole('button', { name: /Montage du JT/ }).click();
  await expect(page.getByRole('heading', { name: 'Déroulé du JT' })).toBeVisible();
  await expect(page.locator('[data-clip-id], [data-plan], .timeline-clip').first()).toBeVisible();
  expect(erreurs()).toEqual([]);
});

test('publier le JT : les correspondants le voient apparaître et peuvent le télécharger', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const erreurs = surveillerErreurs(page);
  const correspondant = await telephone(browser);
  await correspondant.page.goto('/journalistes/telecharger-le-jt');
  await correspondant.page.waitForLoadState('networkidle');

  await deverrouillerMontage(page);
  await etapes(page).getByRole('button', { name: 'Livraison' }).click();
  await page.locator('#tour-editing-grid input[type=file]').first().setInputFiles(fichier('telephone.mp4'));
  const confirmation = page.getByRole('dialog').filter({ hasText: 'Publier le JT ?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Publier et prévenir' }).click();
  await expect(confirmation).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#tour-editing-grid').getByText('telephone.mp4').first()).toBeVisible({ timeout: 30_000 });

  // Sur le téléphone du correspondant, sans recharger.
  const telecharger = correspondant.page.getByRole('link', { name: /Télécharger/ }).filter({ visible: true }).first();
  await expect(async () => {
    await correspondant.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(telecharger).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  const adresse = await telecharger.getAttribute('href');
  const reponse = await correspondant.page.request.get(new URL(adresse, correspondant.page.url()).toString());
  expect(reponse.ok()).toBeTruthy();
  expect(Number(reponse.headers()['content-length'])).toBeGreaterThan(50_000);

  // L'accueil le dit aussi.
  await correspondant.page.goto('/journalistes');
  await expect(correspondant.page.getByRole('button', { name: /Télécharger le JT/ }).first()).not.toContainText('En préparation');

  // La version téléphone se fabrique seule, quelques secondes après.
  const sansVersionLegere = await restantsApres(async () => {
    const liste = await (await page.request.get(`/api/deliveries/${semaine}`)).json();
    return liste.filter((d) => d.leger?.statut !== 'pret').map((d) => `${d.name || d.filename} : ${d.leger?.statut || 'absente'}`);
  }, { delai: 60_000 });
  expect(sansVersionLegere, 'version téléphone').toEqual([]);

  expect(erreurs()).toEqual([]);
  expect(correspondant.erreurs()).toEqual([]);
  await correspondant.contexte.close();
});
