import ffmpeg from '../lib/ffmpeg.js';
import fs from 'fs';
import path from 'path';
import logger from '../logger/index.js';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);

/**
 * Compresse une vidéo à 720p max si elle dépasse cette hauteur.
 * - N'upscale jamais (expression scale conditionnelle).
 * - Réencode H.264 CRF 28 preset veryfast → poids fortement réduit,
 *   crucial quand 20-30 rushes s'accumulent (budget disque/R2/RAM).
 * - Remplace le fichier d'origine sur place (même filename).
 *
 * Retourne { compressed: boolean, newSize: number } (taille en octets).
 * En cas d'erreur ffmpeg, conserve l'original et retourne compressed:false.
 *
 * @param {string} filePath  chemin local du fichier
 * @param {string} ext       extension (.mp4, .mov, .webm)
 */
export async function compressTo720(filePath, ext) {
  if (!VIDEO_EXTS.has(ext.toLowerCase())) {
    return { compressed: false, newSize: fs.statSync(filePath).size };
  }

  const dir = path.dirname(filePath);
  const tmpOut = path.join(dir, `c_${path.basename(filePath)}`);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
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
        .on('progress', (p) => logger.debug('Compression…', { percent: p.percent }))
        .on('end', resolve)
        .on('error', reject)
        .save(tmpOut);
    });

    const origSize = fs.statSync(filePath).size;
    const newSize = fs.statSync(tmpOut).size;

    // Ne garde le réencodage que s'il est plus petit (sinon inutile).
    if (newSize < origSize) {
      fs.renameSync(tmpOut, filePath);
      logger.info(`Compression OK: ${(origSize / 1e6).toFixed(1)}→${(newSize / 1e6).toFixed(1)} MB`);
      return { compressed: true, newSize };
    }
    fs.unlinkSync(tmpOut);
    return { compressed: false, newSize: origSize };
  } catch (err) {
    logger.warn(`Compression échouée, fichier original conservé: ${err.message}`);
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch { /* ignore */ }
    return { compressed: false, newSize: fs.statSync(filePath).size };
  }
}
