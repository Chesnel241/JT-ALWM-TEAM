import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { preparerFichiers, FORMATS } from './outils/fichiers.mjs';
import { DOSSIER_FICHIERS, URL_API } from './outils/banc.mjs';
import { entrerCommeCorrespondant, deverrouillerMontage, fichiersRecus, semaineActive, surveillerErreurs, attendre, restantsApres } from './outils/parcours.mjs';

/**
 * Tous les formats que la plateforme annonce, envoyés pour de vrai.
 *
 * LE BESOIN (le propriétaire) : « se rassurer que la plateforme accepte tout
 * format de fichier audio, vidéo, images ». Un correspondant filme et
 * enregistre avec ce qu'il a ; un format refusé, c'est un reportage perdu
 * pour la semaine. Chaque fichier part par le vrai sélecteur de l'espace
 * d'envoi, arrive par tus, puis le serveur le range, le mesure (ffprobe) et,
 * pour une vidéo, en fabrique l'aperçu léger (ffmpeg).
 */

const PAYS = 'cm';
const ICI = dirname(fileURLToPath(import.meta.url));

test.describe.configure({ mode: 'serial' });

let fichiers;
let semaine;

test.beforeAll(async ({ request }) => {
  fichiers = preparerFichiers();
  semaine = (await semaineActive(request)).id;
});

test('la liste des formats essayés couvre celle du serveur', () => {
  // Une extension ajoutée au serveur sans fichier d'essai passerait sans
  // jamais avoir été envoyée : ce test le refuse.
  const source = readFileSync(join(ICI, '../../backend/src/lib/upload.js'), 'utf8');
  const serveur = new Set();
  for (const bloc of ['VIDEO_EXTENSIONS', 'AUDIO_EXTENSIONS', 'IMAGE_EXTENSIONS', 'DOCUMENT_EXTENSIONS']) {
    const corps = source.match(new RegExp(`${bloc} = \\[([^\\]]*)\\]`))[1];
    for (const ext of corps.match(/'\.[a-z0-9]+'/g)) serveur.add(ext.slice(1, -1));
  }
  const essayees = new Set(FORMATS.map((f) => f.nom.slice(f.nom.lastIndexOf('.'))));
  expect([...serveur].filter((e) => !essayees.has(e))).toEqual([]);
});

test('un correspondant envoie d’un coup un fichier de chaque format, et tous arrivent', async ({ page, request }) => {
  test.setTimeout(180_000);
  const erreurs = surveillerErreurs(page);
  await entrerCommeCorrespondant(page, PAYS);

  // Le bouton « Parcourir » du premier reportage, celui qu'on toucherait.
  const selecteur = page.locator('#tour-dropzone input[type=file]:not([webkitdirectory])').first();
  await selecteur.setInputFiles(fichiers.map((f) => f.chemin));

  const recus = await attendre(async () => {
    const liste = await fichiersRecus(request, semaine, PAYS);
    return liste.length >= fichiers.length ? liste : null;
  }, { delai: 150_000, message: `les ${fichiers.length} fichiers sur le serveur` });

  const parNom = new Map(recus.map((f) => [f.name, f]));
  const manquants = fichiers.filter((f) => !parNom.has(f.nom)).map((f) => f.nom);
  expect(manquants, 'fichiers jamais arrivés').toEqual([]);

  // Chacun rangé dans sa famille : une vidéo parmi les rushes, un son parmi
  // les sons, une photo parmi les images, un script parmi les textes.
  const malRanges = fichiers
    .filter((f) => parNom.get(f.nom).type !== f.famille)
    .map((f) => `${f.nom} : ${parNom.get(f.nom).type} au lieu de ${f.famille}`);
  expect(malRanges).toEqual([]);

  // L'espace du correspondant le confirme, sans erreur à l'écran.
  await expect(page.getByText(/n’a pas pu partir|a échoué|Échec/i)).toHaveCount(0);
  expect(erreurs()).toEqual([]);
});

test('le serveur mesure la durée de chaque vidéo et de chaque son', async ({ request }) => {
  test.setTimeout(150_000);
  const medias = fichiers.filter((f) => f.famille === 'video' || f.famille === 'audio');
  const sansDuree = await restantsApres(async () => {
    const parNom = new Map((await fichiersRecus(request, semaine, PAYS)).map((f) => [f.name, f]));
    return medias.filter((f) => !(Number(parNom.get(f.nom)?.duree) > 1)).map((f) => f.nom);
  }, { delai: 120_000 });
  expect(sansDuree, 'médias dont la durée reste inconnue').toEqual([]);
});

test('le serveur fabrique l’aperçu léger de chaque vidéo, lisible dans le navigateur', async ({ request, page }) => {
  test.setTimeout(240_000);
  const videos = fichiers.filter((f) => f.famille === 'video');
  const sansApercu = await restantsApres(async () => {
    const parNom = new Map((await fichiersRecus(request, semaine, PAYS)).map((f) => [f.name, f]));
    return videos.filter((f) => !parNom.get(f.nom)?.proxyFilename).map((f) => f.nom);
  }, { delai: 200_000, pas: 2000 });
  expect(sansApercu, 'vidéos sans aperçu').toEqual([]);

  // Chaque aperçu se lit réellement dans Chromium : WMV, AVI, MTS ou 3GP
  // ne se liraient pas tels quels, leur aperçu MP4 si.
  await page.goto('/journalistes');
  const liste = await fichiersRecus(request, semaine, PAYS);
  const illisibles = [];
  for (const f of videos) {
    const fichier = liste.find((x) => x.name === f.nom);
    const lu = await page.evaluate(async (url) => new Promise((resolve) => {
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'auto';
      v.onloadeddata = () => resolve(v.videoWidth > 0 && v.duration > 1);
      v.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 10_000);
      v.src = url;
    }), `/uploads/${encodeURIComponent(fichier.proxyFilename)}`);
    if (!lu) illisibles.push(f.nom);
  }
  expect(illisibles, 'aperçus illisibles').toEqual([]);
});

test('le montage peut écouter chaque son et voir chaque photo reçus', async ({ request, page }) => {
  await page.goto('/journalistes');
  const liste = await fichiersRecus(request, semaine, PAYS);
  const echecs = [];
  for (const f of fichiers.filter((x) => x.famille === 'audio' || x.famille === 'image')) {
    const recu = liste.find((x) => x.name === f.nom);
    // Ce que la visionneuse et la carte chargent : l'aperçu s'il existe, sinon l'original.
    const nom = recu.proxyFilename || recu.filename;
    const ok = await page.evaluate(async ({ url, famille }) => new Promise((resolve) => {
      const fin = setTimeout(() => resolve(false), 10_000);
      if (famille === 'image') {
        const img = new Image();
        img.onload = () => { clearTimeout(fin); resolve(img.naturalWidth > 0); };
        img.onerror = () => { clearTimeout(fin); resolve(false); };
        img.src = url;
      } else {
        const a = new Audio();
        a.preload = 'auto';
        a.oncanplay = () => { clearTimeout(fin); resolve(a.duration > 1); };
        a.onerror = () => { clearTimeout(fin); resolve(false); };
        a.src = url;
      }
    }), { url: `/uploads/${encodeURIComponent(nom)}`, famille: f.famille });
    if (!ok) echecs.push(f.nom);
  }
  expect(echecs, 'illisibles dans le navigateur du montage').toEqual([]);
});

test('le montage voit chaque fichier reçu, et la visionneuse ouvre chaque famille', async ({ page, request }) => {
  test.setTimeout(180_000);
  const erreurs = surveillerErreurs(page);
  // Les aperçus des sons et des photos illisibles doivent être prêts.
  const aConvertir = ['windows.wma', 'mac.aif', 'mac.aiff', 'iphone.caf', 'cinema.ac3', 'dictaphone.amr', 'scan.tif', 'scan.tiff', 'photo-iphone.heic', 'photo-iphone.heif'];
  const sansApercu = await restantsApres(async () => {
    const parNom = new Map((await fichiersRecus(request, semaine, PAYS)).map((f) => [f.name, f]));
    return aConvertir.filter((n) => !parNom.get(n)?.proxyFilename);
  }, { delai: 60_000 });
  expect(sansApercu, 'sons et photos sans copie lisible').toEqual([]);

  await deverrouillerMontage(page);
  await page.locator('aside button', { hasText: 'Cameroun' }).first().click();
  for (const f of fichiers) await expect(page.locator(`[data-fichier="${f.nom}"]`), f.nom).toHaveCount(1);

  // Chaque vidéo montre une image sur sa carte, y compris WMV, AVI, MTS ou 3GP.
  const sansVignette = [];
  for (const f of fichiers.filter((x) => x.famille === 'video')) {
    const video = page.locator(`[data-fichier="${f.nom}"] [data-vignette] video`);
    await video.scrollIntoViewIfNeeded();
    const ok = await video.evaluate((v) => new Promise((resolve) => {
      if (v.readyState >= 2 && v.videoWidth > 0) return resolve(true);
      const fin = setTimeout(() => resolve(false), 8000);
      v.addEventListener('loadeddata', () => { clearTimeout(fin); resolve(v.videoWidth > 0); }, { once: true });
      v.addEventListener('error', () => { clearTimeout(fin); resolve(false); }, { once: true });
    }));
    if (!ok) sansVignette.push(f.nom);
  }
  expect(sansVignette, 'vidéos sans image sur leur carte').toEqual([]);

  const ouvrir = async (nom) => {
    const vignette = page.locator(`[data-fichier="${nom}"] [data-vignette]`);
    await vignette.scrollIntoViewIfNeeded();
    await vignette.click();
    return page.getByRole('dialog');
  };
  const fermer = async () => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  };

  // Une vidéo d'un vieux PC Windows se lit.
  let boite = await ouvrir('windows.wmv');
  await expect.poll(() => boite.locator('video').evaluate((v) => v.readyState >= 2 && v.videoWidth > 0)).toBe(true);
  await fermer();

  // Le dictaphone d'un Android et un son Windows s'écoutent.
  for (const nom of ['dictaphone.amr', 'windows.wma', 'interview.mp3']) {
    boite = await ouvrir(nom);
    await expect.poll(() => boite.locator('audio').evaluate((a) => a.readyState >= 1 && a.duration > 1), { message: nom }).toBe(true);
    await fermer();
  }

  // La photo d'un iPhone et le scan d'un bureau se voient.
  for (const nom of ['photo-iphone.heic', 'scan.tif', 'photo.jpg']) {
    boite = await ouvrir(nom);
    await expect.poll(() => boite.locator('img').evaluate((i) => i.complete && i.naturalWidth > 0), { message: nom }).toBe(true);
    await fermer();
  }

  // Un script se lit ; un PDF se télécharge.
  boite = await ouvrir('script.txt');
  await expect(boite.getByText('Lancement : le marché de Mokolo rouvre ce lundi.')).toBeVisible();
  await fermer();
  boite = await ouvrir('conducteur.pdf');
  await expect(boite.getByRole('link', { name: /Télécharger/ })).toBeVisible();
  await fermer();

  expect(erreurs()).toEqual([]);
});

test('refuse ce qui n’est pas un média, et le dit clairement au correspondant', async ({ page, request }, testInfo) => {
  const pays = 'tg';
  // Les refus provoqués ici sont attendus : on vérifie qu'ils sont expliqués.
  const erreurs = surveillerErreurs(page, { toleres: ['/api/tus'] });
  await entrerCommeCorrespondant(page, pays, { numero: '90112233' });
  // Un dossier au nom simple : celui du test porte une apostrophe
  // typographique, et Chromium lit les fichiers choisis par leur chemin.
  const dossier = join(DOSSIER_FICHIERS, '..', 'pieges', `${testInfo.workerIndex}-${testInfo.repeatEachIndex}-${Date.now()}`);
  const { mkdirSync, writeFileSync } = await import('fs');
  mkdirSync(dossier, { recursive: true });
  const deguise = join(dossier, 'reportage.mp4');
  writeFileSync(deguise, '<!doctype html><html><script>alert(1)</script></html>');
  const programme = join(dossier, 'lecteur.exe');
  writeFileSync(programme, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]));

  const selecteur = page.locator('#tour-dropzone input[type=file]:not([webkitdirectory])').first();
  await selecteur.setInputFiles([deguise, programme]);

  // L'écran nomme chaque fichier refusé et dit pourquoi, en français…
  for (const nom of ['reportage.mp4', 'lecteur.exe']) {
    await expect(page.getByText(new RegExp(`${nom.replace('.', '\\.')} : Ce type de fichier n’est pas accepté`)).first(), nom).toBeVisible();
  }
  // …rien n'entre sur le serveur, et on ne propose pas de « reprendre » un
  // envoi qui ne passera jamais.
  expect(await fichiersRecus(request, semaine, pays)).toEqual([]);
  await expect(page.getByRole('button', { name: /Reprendre l’envoi/ })).toHaveCount(0);
  await expect(page.locator('#tour-uploader-accordion').getByText('Rien n’est parti')).toBeVisible();
  await expect(page.getByRole('button', { name: /Réessayer/ })).toHaveCount(0);
  const texte = await page.locator('body').innerText();
  expect(texte).not.toMatch(/\btus\b|HTTP|status code|Error:|undefined|NaN/i);
  expect(erreurs().filter((e) => !/^console : .*(415|tus)/i.test(e))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('refus.png'), fullPage: true });
});

test('chaque format de son devient une voix off MP3, lisible partout', async ({ request, page }) => {
  test.setTimeout(180_000);
  // Le circuit de la voix off est à part : le serveur nettoie le son et le
  // convertit en MP3. Un mémo AMR, une note Opus, un WMA : tout doit passer.
  const { readFileSync } = await import('fs');
  const echecs = [];
  const voix = [];
  for (const f of fichiers.filter((x) => x.famille === 'audio')) {
    const r = await request.post(`${URL_API}/api/uploads/voiceover/${semaine}/${PAYS}`, {
      multipart: {
        audio: { name: f.nom, mimeType: f.type, buffer: readFileSync(f.chemin) },
        reportageTitle: `Voix ${f.nom}`,
        script: '',
      },
    });
    if (r.status() !== 201) { echecs.push(`${f.nom} : ${r.status()} ${(await r.text()).slice(0, 120)}`); continue; }
    voix.push({ nom: f.nom, fichier: (await r.json()).audio.filename });
  }
  expect(echecs, 'voix off refusées').toEqual([]);

  await page.goto('/journalistes');
  const illisibles = [];
  for (const v of voix) {
    const duree = await page.evaluate((url) => new Promise((resolve) => {
      const a = new Audio(url);
      a.onloadedmetadata = () => resolve(a.duration);
      a.onerror = () => resolve(0);
      setTimeout(() => resolve(0), 10_000);
    }), `/uploads/${encodeURIComponent(v.fichier)}`);
    if (!(duree > 1)) illisibles.push(`${v.nom} (${duree} s)`);
  }
  expect(illisibles, 'voix off illisibles').toEqual([]);
});
