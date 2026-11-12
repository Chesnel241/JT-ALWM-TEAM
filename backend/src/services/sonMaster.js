import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { FFMPEG_PATH } from '../lib/ffmpeg.js';
import logger from '../logger/index.js';
// Partagé avec le moteur de rendu : la même norme, les mêmes calculs. Le
// Dockerfile du serveur copie ce seul fichier (il ne dépend de rien).
import { argsMesure, lireMesure, filtreCorrection, lireResultat, dansLaNorme } from '../../../worker/src/sonorite.js';

/** On ne garde que la fin de la sortie de ffmpeg : le JSON y est imprimé. */
const FIN_SORTIE = 64 * 1024;

/** Lance ffmpeg et rend son code de sortie et la fin de sa sortie d'erreur. */
export function lancerFfmpeg(args) {
  return new Promise((resolve) => {
    let stderr = '';
    let enfant;
    try {
      enfant = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      resolve({ code: -1, stderr: String(err.message || err) });
      return;
    }
    enfant.stderr.on('data', (morceau) => {
      stderr = (stderr + morceau.toString('utf8')).slice(-FIN_SORTIE);
    });
    enfant.on('error', (err) => resolve({ code: -1, stderr: String(err.message || err) }));
    enfant.on('close', (code) => resolve({ code, stderr }));
  });
}

/**
 * Met le son d'un master à la norme de diffusion (voir worker/src/sonorite.js),
 * en place, sans réencoder l'image.
 *
 * Ne lève jamais : un problème de son ne doit pas faire perdre un rendu. Rend
 * le bilan `{ avant, apres, crete, mode, norme }`, ou `null` si le master est
 * resté à son niveau d'origine (muet, mesure illisible, échec).
 */
export async function normaliserSonMaster(chemin, { executer = lancerFfmpeg } = {}) {
  const temporaire = `${chemin}.son.mp4`;
  try {
    const mesure1 = await executer(argsMesure(chemin));
    const mesure = mesure1.code === 0 ? lireMesure(mesure1.stderr) : null;
    if (!mesure) return null;

    const correction = await executer([
      '-hide_banner', '-nostats', '-y', '-i', chemin,
      '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
      '-af', filtreCorrection(mesure),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-movflags', '+faststart',
      temporaire,
    ]);
    if (correction.code !== 0 || !fs.existsSync(temporaire) || fs.statSync(temporaire).size < 1024) {
      logger.warn('Correction du son du master échouée, niveau d’origine conservé', { code: correction.code });
      return null;
    }
    const resultat = lireResultat(correction.stderr);
    await fs.promises.rename(temporaire, chemin);
    if (!resultat) return null;
    return {
      avant: mesure.integre,
      apres: resultat.integre,
      crete: resultat.crete,
      mode: resultat.mode,
      norme: dansLaNorme(resultat.integre),
    };
  } catch (err) {
    logger.warn('Normalisation du son du master impossible', { error: String(err?.message || err).slice(0, 300) });
    return null;
  } finally {
    try { fs.rmSync(temporaire, { force: true }); } catch { /* déjà renommé ou absent */ }
  }
}
