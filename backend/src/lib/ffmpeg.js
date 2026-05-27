import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import logger from '../logger/index.js';

/**
 * Configuration ffmpeg centralisée. setFfmpegPath/setFfprobePath sont GLOBAUX
 * dans fluent-ffmpeg : tous les services doivent importer ce module pour
 * garantir le même binaire (sinon le dernier import gagne).
 *
 * On utilise `ffmpeg-static` (ffmpeg 7.x) au lieu de `@ffmpeg-installer/ffmpeg`
 * (build 2018) car les transitions `xfade` exigent ffmpeg ≥ 4.3. ffprobe vient
 * de `@ffprobe-installer` (ffmpeg-static ne fournit pas ffprobe).
 */
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

logger.info(`FFmpeg: ${ffmpegStatic} | FFprobe: ${ffprobeInstaller.path}`);

export const FFMPEG_PATH = ffmpegStatic;
export const FFPROBE_PATH = ffprobeInstaller.path;
export default ffmpeg;
