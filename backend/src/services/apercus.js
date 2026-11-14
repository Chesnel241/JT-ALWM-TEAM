/**
 * Les aperçus des sons et des photos que les navigateurs ne savent pas lire.
 *
 * L'INCIDENT (tests de bout en bout, e2e/formats.spec.js) : la plateforme
 * accepte, comme promis, le WMA d'un PC Windows, l'AMR du dictaphone d'un
 * Android d'entrée de gamme, l'AIFF ou le CAF d'un Mac, l'AC3, le TIFF d'un
 * scanner et le HEIC des iPhone. Mais une fois arrivés, le montage ne pouvait
 * ni les écouter ni les voir : Chromium n'en lit aucun. La carte restait vide,
 * la visionneuse muette, et une photo HEIC placée dans le JT faisait échouer
 * le rendu, qui passe par le même moteur.
 *
 * Comme pour les vidéos (videoCompress.js), le serveur fabrique donc une
 * copie lisible À CÔTÉ de l'original, qui n'est jamais touché :
 *
 * - un son → `<uuid>.proxy.m4a` (AAC 192 kb/s, lu partout) ;
 * - une photo → `<uuid>.proxy.jpg` (2048 px de large au plus).
 *
 * Elle est référencée par `proxyFilename`, comme l'aperçu d'une vidéo : la
 * visionneuse, la carte et le studio la préfèrent déjà (lib/mediaSource.js),
 * la suppression et le nettoyage l'emportent avec l'original.
 *
 * Le HEIC des iPhone récents est découpé en tuiles ; le ffmpeg du système ne
 * sait pas toujours le recomposer. On essaie alors celui que le serveur
 * embarque (ffmpeg-static, plus récent). Si aucun n'y parvient, il n'y a pas
 * d'aperçu, et l'écran le dit au lieu d'afficher une image cassée.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';
import { FFMPEG_PATH } from '../lib/ffmpeg.js';
import logger from '../logger/index.js';

/** Les sons que Chromium refuse de lire (vérifié par e2e/formats.spec.js). */
export const SONS_SANS_LECTEUR = new Set(['.wma', '.aif', '.aiff', '.caf', '.ac3', '.amr']);
/** Les photos que Chromium refuse d'afficher. */
export const IMAGES_SANS_LECTEUR = new Set(['.tif', '.tiff', '.heic', '.heif']);

const DELAI_MAX_MS = parseInt(process.env.APERCU_TIMEOUT_MS || 5 * 60 * 1000, 10);

/** 'son', 'image', ou null quand le navigateur lit déjà l'original. */
export function sorteApercu(ext) {
  const e = String(ext || '').toLowerCase();
  if (SONS_SANS_LECTEUR.has(e)) return 'son';
  if (IMAGES_SANS_LECTEUR.has(e)) return 'image';
  return null;
}

/** `<uuid>.proxy.m4a` ou `<uuid>.proxy.jpg`, à côté de l'original. */
export function nomApercu(filename, sorte) {
  const base = path.basename(String(filename || ''));
  const point = base.lastIndexOf('.');
  return `${point > 0 ? base.slice(0, point) : base}.proxy.${sorte === 'son' ? 'm4a' : 'jpg'}`;
}

/** Les arguments ffmpeg de la conversion, écrite dans `sortie`. */
export function argumentsApercu(entree, sortie, sorte) {
  const debut = ['-hide_banner', '-loglevel', 'error', '-y', '-i', entree];
  if (sorte === 'son') {
    return [...debut, '-vn', '-map', '0:a:0', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-f', 'ipod', sortie];
  }
  return [
    ...debut,
    '-frames:v', '1',
    '-vf', "scale='trunc(min(2048,iw)/2)*2':-2:flags=lanczos",
    '-pix_fmt', 'yuvj420p',
    '-q:v', '3',
    '-c:v', 'mjpeg',
    '-f', 'image2',
    sortie,
  ];
}

function lancer(binaire, args) {
  return new Promise((resolve) => {
    let fini = false;
    const p = spawn(binaire, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let erreur = '';
    p.stderr.on('data', (d) => { if (erreur.length < 2000) erreur += d; });
    const minuteur = setTimeout(() => { if (!fini) p.kill('SIGKILL'); }, DELAI_MAX_MS);
    const finir = (ok) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      resolve({ ok, erreur: erreur.trim().slice(0, 300) });
    };
    p.on('error', (e) => { erreur = e.message; finir(false); });
    p.on('close', (code) => finir(code === 0));
  });
}

/**
 * Fabrique l'aperçu d'un fichier, s'il en a besoin. Rend `{ nom, taille }`,
 * ou `null` (pas besoin, ou aucun ffmpeg n'a su le lire). Ne lève jamais :
 * un aperçu manqué ne doit coûter ni l'original ni l'envoi.
 *
 * `binaires` : pour les tests ; par défaut celui du serveur, puis, pour une
 * photo, ffmpeg-static s'il est différent.
 */
export async function fabriquerApercu(chemin, ext, { binaires } = {}) {
  const sorte = sorteApercu(ext);
  if (!sorte) return null;
  const nom = nomApercu(chemin, sorte);
  const sortie = path.join(path.dirname(chemin), nom);
  const temporaire = `${sortie}.part`;
  const candidats = binaires || [
    FFMPEG_PATH,
    ...(sorte === 'image' && ffmpegStatic && ffmpegStatic !== FFMPEG_PATH ? [ffmpegStatic] : []),
  ];
  let derniere = '';
  for (const binaire of candidats) {
    try {
      const { ok, erreur } = await lancer(binaire, argumentsApercu(chemin, temporaire, sorte));
      if (ok && fs.existsSync(temporaire) && fs.statSync(temporaire).size > 0) {
        fs.renameSync(temporaire, sortie);
        return { nom, taille: fs.statSync(sortie).size };
      }
      derniere = erreur;
    } catch (err) {
      derniere = err.message;
    }
  }
  try { fs.rmSync(temporaire, { force: true }); } catch { /* rien à nettoyer */ }
  logger.warn('Aperçu impossible', { context: { fichier: path.basename(chemin), sorte, erreur: derniere } });
  return null;
}

// Une conversion à la fois : un lot de cinquante photos d'un correspondant ne
// doit pas saturer le serveur pendant que d'autres envoient.
let file = Promise.resolve();
let enAttente = 0;

/**
 * Met l'aperçu en file. `surFin({ nom, taille })` est appelé quand il est
 * prêt. Rend `false` quand le fichier n'en a pas besoin.
 */
export function planifierApercu(chemin, ext, surFin) {
  if (!sorteApercu(ext)) return false;
  enAttente += 1;
  file = file
    .then(async () => {
      const resultat = await fabriquerApercu(chemin, ext);
      if (resultat) await surFin?.(resultat);
    })
    .catch((err) => logger.warn(`Suivi d'aperçu échoué: ${err.message}`))
    .finally(() => { enAttente -= 1; });
  return true;
}

/** L'état de la file, pour /health. */
export function etatFileApercus() {
  return { enAttente };
}
