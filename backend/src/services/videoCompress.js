import ffmpeg from '../lib/ffmpeg.js';
import fs from 'fs';
import path from 'path';
import logger from '../logger/index.js';
import { VIDEO_EXTENSIONS } from '../lib/upload.js';

// Toutes les extensions vidéo acceptées à l'envoi, pas seulement trois.
// Avant, un .mkv ou un .mts traversait la fabrication de proxy sans rien
// produire : le monteur travaillait alors sur le master selon le téléphone
// du correspondant, sans que rien ne le signale.
const VIDEO_EXTS = new Set(VIDEO_EXTENSIONS);

/**
 * Délai au-delà duquel on considère qu'ffmpeg ne reviendra pas.
 *
 * Sans lui, la promesse d'encodage ne se règle jamais quand ffmpeg reste
 * bloqué — un fichier tronqué par un envoi interrompu, un flux qu'il ne sait
 * pas démuxer — et la file sérielle ne repart plus. Un dimanche soir, le
 * premier fichier pathologique privait de copie légère TOUS les envois
 * suivants, sans rien signaler : les masters restaient saufs, le montage
 * restait possible, et personne ne voyait que le studio était devenu lourd.
 */
const DELAI_MAX_MS = parseInt(process.env.PROXY_TIMEOUT_MS || 30 * 60 * 1000, 10);

/** Nom du proxy associé à un fichier : `<uuid>.proxy.mp4`. */
export function proxyNameFor(filename) {
  const base = path.basename(String(filename || ''));
  const dot = base.lastIndexOf('.');
  return `${dot > 0 ? base.slice(0, dot) : base}.proxy.mp4`;
}

/**
 * Fabrique une copie 720p À CÔTÉ du master, pour l'aperçu et le montage.
 *
 * Le master n'est jamais touché. La version précédente renommait le
 * réencodage par-dessus l'original : un rush 1080p devenait définitivement
 * 720p, et l'export — qui rend en 1080p — repartait de ce 720p, donc
 * l'agrandissait. Ici le master reste intact pour le rendu final, et seul
 * l'aperçu consomme la copie légère, ce qui garde le studio fluide sur une
 * machine modeste et sur une connexion faible.
 *
 * Retourne { compressed, proxyName, newSize } — `newSize` étant la taille du
 * proxy quand il existe, sinon celle du master. Une erreur ffmpeg n'est pas
 * fatale : on repart simplement sans proxy.
 *
 * @param {string} filePath  chemin local du master
 * @param {string} ext       extension du master
 */
export async function compressTo720(filePath, ext) {
  if (!VIDEO_EXTS.has(String(ext).toLowerCase())) {
    return { compressed: false, proxyName: '', newSize: fs.statSync(filePath).size };
  }

  const dir = path.dirname(filePath);
  const proxyName = proxyNameFor(filePath);
  const tmpOut = path.join(dir, `c_${path.basename(filePath)}.mp4`);

  try {
    await new Promise((resolve, reject) => {
      const commande = ffmpeg(filePath)
        // Downscale seulement si hauteur > 720 ; largeur paire (-2).
        // Sinon garde la résolution native.
        .videoFilters("scale='if(gt(ih,720),-2,iw)':'if(gt(ih,720),720,ih)'")
        .outputOptions([
          '-c:v libx264',
          '-crf 28',
          '-preset veryfast',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart',
          '-threads 2',
          '-max_muxing_queue_size 1024'
        ])
        .on('start', () => logger.info(`Compression 720p: ${path.basename(filePath)}`))
        .on('progress', (p) => logger.debug('Compression…', { percent: p.percent }));

      const minuteur = setTimeout(() => {
        logger.warn('Encodage interrompu : délai dépassé', {
          context: { fichier: path.basename(filePath), delaiMs: DELAI_MAX_MS },
        });
        try { commande.kill('SIGKILL'); } catch { /* déjà mort */ }
        reject(new Error(`Encodage interrompu après ${Math.round(DELAI_MAX_MS / 60000)} min`));
      }, DELAI_MAX_MS);
      // `unref` : ce minuteur ne doit pas à lui seul retenir le processus.
      minuteur.unref?.();

      commande
        .on('end', () => { clearTimeout(minuteur); resolve(); })
        .on('error', (err) => { clearTimeout(minuteur); reject(err); })
        .save(tmpOut);
    });

    const origSize = fs.statSync(filePath).size;
    const newSize = fs.statSync(tmpOut).size;

    // Un proxy plus lourd que le master n'apporte rien : on le jette et le
    // montage lira le master, comme avant.
    if (newSize < origSize) {
      fs.renameSync(tmpOut, path.join(dir, proxyName));
      logger.info(`Proxy 720p: ${(origSize / 1e6).toFixed(1)}→${(newSize / 1e6).toFixed(1)} MB (master conservé)`);
      return { compressed: true, proxyName, newSize };
    }
    fs.unlinkSync(tmpOut);
    return { compressed: false, proxyName: '', newSize: origSize };
  } catch (err) {
    logger.warn(`Proxy non fabriqué, le montage lira le master: ${err.message}`);
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch { /* ignore */ }
    return { compressed: false, proxyName: '', newSize: fs.statSync(filePath).size };
  }
}

/**
 * File d'attente sérielle des compressions.
 *
 * ffmpeg sature un cœur par encodage. Vingt correspondants qui envoient leur
 * rush le dimanche soir lanceraient autant d'encodages simultanés et le VPS
 * ne répondrait plus. Les compressions s'exécutent donc une par une, en
 * arrière-plan : le correspondant a déjà reçu sa confirmation, et le monteur
 * voit le fichier apparaître immédiatement.
 */
let queue = Promise.resolve();
let pending = 0;
let debutTacheCourante = null;

/**
 * Enchaîne une tâche derrière les précédentes. Exporté pour être testable
 * sans invoquer ffmpeg : c'est la sérialisation qui compte ici, pas
 * l'encodage.
 */
export function runSerially(task) {
  pending += 1;
  queue = queue
    .then(() => { debutTacheCourante = Date.now(); return task(); })
    .catch((err) => {
      // Une compression ratée ne doit jamais bloquer les suivantes : le
      // fichier original est conservé, c'est le comportement voulu.
      logger.warn(`Compression ignorée: ${err.message}`);
    })
    .finally(() => {
      pending -= 1;
      if (pending === 0) debutTacheCourante = null;
    });
  return queue;
}

export function queueCompression(filePath, ext, onDone) {
  return runSerially(async () => {
    const result = await compressTo720(filePath, ext);
    if (typeof onDone === 'function') {
      try {
        await onDone(result);
      } catch (err) {
        logger.warn(`Suivi de compression échoué: ${err.message}`);
      }
    }
  });
}

/** Nombre de compressions en attente ou en cours (diagnostic). */
export function pendingCompressions() {
  return pending;
}

/**
 * État de la file, pour /health. Une file qui grossit ou une tâche dont
 * l'âge dépasse le délai maximum est le premier signe d'un fichier
 * pathologique — c'est ce qu'on veut voir avant que le studio ne rame.
 */
export function etatFileCompression() {
  return {
    enAttente: pending,
    ageTacheCouranteMs: debutTacheCourante ? Date.now() - debutTacheCourante : 0,
    delaiMaxMs: DELAI_MAX_MS,
  };
}
