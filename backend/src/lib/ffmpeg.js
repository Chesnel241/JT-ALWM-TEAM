import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { existsSync } from 'fs';
import logger from '../logger/index.js';

/**
 * Configuration ffmpeg centralisée. setFfmpegPath/setFfprobePath sont GLOBAUX
 * dans fluent-ffmpeg : tous les services doivent importer ce module pour
 * garantir le même binaire (sinon le dernier import gagne).
 *
 * Sélection du binaire (par ordre de priorité) :
 *   1. FFMPEG_PATH / FFPROBE_PATH d'environnement (override explicite)
 *   2. ffmpeg/ffprobe SYSTÈME (/usr/bin/...) s'il existe — INDISPENSABLE en
 *      conteneur alpine/musl où le binaire glibc de `ffmpeg-static` refuse de
 *      s'exécuter ("Exec format error" / ENOENT). On installe `ffmpeg` via le
 *      gestionnaire de paquets de l'image.
 *   3. `ffmpeg-static` (ffmpeg 7.x, glibc) + `@ffprobe-installer` en fallback
 *      (Render/Debian où le binaire bundlé fonctionne).
 *
 * Les transitions `xfade` exigent ffmpeg ≥ 4.3 : ffmpeg-static (7.x) et les
 * paquets système récents conviennent.
 */
function pickBinary(envVar, systemPaths, bundled) {
  const fromEnv = process.env[envVar];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const p of systemPaths) {
    if (existsSync(p)) return p;
  }
  return bundled;
}

const FFMPEG = pickBinary('FFMPEG_PATH', ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'], ffmpegStatic);
const FFPROBE = pickBinary('FFPROBE_PATH', ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe'], ffprobeInstaller.path);

ffmpeg.setFfmpegPath(FFMPEG);
ffmpeg.setFfprobePath(FFPROBE);

logger.info(`FFmpeg: ${FFMPEG} | FFprobe: ${FFPROBE}`);

export const FFMPEG_PATH = FFMPEG;
export const FFPROBE_PATH = FFPROBE;
export default ffmpeg;
