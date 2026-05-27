import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import os from 'os';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { uploadsDir } from '../lib/upload.js';
import { HAS_R2, getR2ReadStream, uploadToR2, getR2PresignedUrl } from '../lib/s3.js';
import logger from '../logger/index.js';
import { generateAssFile } from '../data/overlayTemplates.js';
import { setProgress } from './editorProgress.js';

let isRendering = false;

// Binaires fournis par les packages installer (Render n'a pas ffmpeg/ffprobe
// système). setFfprobePath est CRITIQUE : sans lui, checkAudio échoue ET
// fluent-ffmpeg ne peut pas calculer la durée → l'event `progress` n'émet
// jamais de `percent` → la jauge reste figée.
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);
logger.info(`FFmpeg: ${ffmpegInstaller.path} | FFprobe: ${ffprobeInstaller.path}`);

const checkAudio = (filePath) => new Promise((resolve) => {
  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err || !metadata || !metadata.streams) return resolve(false);
    resolve(metadata.streams.some(s => s.codec_type === 'audio'));
  });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dossier des polices bundlées (Inter, Bebas Neue, Anton, Archivo Black,
// Barlow). Passé au filtre `ass` via fontsdir — INDISPENSABLE sur Render
// (conteneur sans polices système : sans ça libass substitue la police et
// le texte n'apparaît pas). FFmpeg veut des slashes avant.
const FONTS_DIR = path.join(__dirname, '../../fonts').replace(/\\/g, '/');
const HAS_FONTS = fs.existsSync(FONTS_DIR);

// Garde-fous anti-blocage. Si ffmpeg cale (aucune progression) ou dépasse la
// limite absolue, on tue le process : sinon la promesse ne se résout jamais,
// le bloc finally ne s'exécute pas et le verrou isRendering reste bloqué à
// true jusqu'au redémarrage de Render (éditeur HS pour tout le monde).
const STEP_STALL_MS = Number(process.env.EDITOR_STALL_MS) || 4 * 60 * 1000;
const STEP_MAX_MS = Number(process.env.EDITOR_STEP_MAX_MS) || 12 * 60 * 1000;
const IO_TIMEOUT_MS = Number(process.env.EDITOR_IO_TIMEOUT_MS) || 5 * 60 * 1000;

// Rejette si `promise` ne se règle pas dans `ms` (protège les I/O R2 qui
// peuvent pendre indéfiniment sur coupure réseau).
function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} : délai dépassé (${Math.round(ms / 1000)}s)`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

// Exécute une commande fluent-ffmpeg avec watchdog : surveille la progression
// et tue le process s'il cale ou dépasse la limite. `wire` reçoit la commande
// et les handlers à brancher (start/progress) ; on gère end/error/timeout ici.
function runFfmpegStep(command, label, { onStart, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    let stall;
    let hardCap;
    let settled = false;

    const clearTimers = () => { clearTimeout(stall); clearTimeout(hardCap); };
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimers();
      fn(arg);
    };
    const fail = (msg) => {
      logger.error(`Montage interrompu : ${msg}`);
      try { command.kill('SIGKILL'); } catch { /* déjà mort */ }
      finish(reject, new Error(msg));
    };
    const armStall = () => {
      clearTimeout(stall);
      stall = setTimeout(() => fail(`${label} bloqué (aucune progression depuis ${Math.round(STEP_STALL_MS / 1000)}s)`), STEP_STALL_MS);
    };

    hardCap = setTimeout(() => fail(`${label} dépasse la durée max (${Math.round(STEP_MAX_MS / 1000)}s)`), STEP_MAX_MS);

    command
      .on('start', (cmd) => { armStall(); onStart?.(cmd); })
      .on('progress', (p) => { armStall(); onProgress?.(p); })
      .on('end', () => finish(resolve))
      .on('error', (err) => finish(reject, err));
  });
}

// Télécharge un fichier R2 vers un chemin local. Retourne destPath.
async function downloadFromR2(r2Key, destPath) {
  const stream = await getR2ReadStream(r2Key);
  const out = fs.createWriteStream(destPath);
  await pipeline(stream, out);
  return destPath;
}

/**
 * Résout le chemin local d'un clip. En mode R2, télécharge le fichier
 * dans workDir et retourne ce chemin temporaire. Sinon, retourne le
 * chemin local sous uploadsDir.
 */
async function resolveClipPath(filename, workDir) {
  if (HAS_R2) {
    const dest = path.join(workDir, filename);
    await downloadFromR2(`uploads/${filename}`, dest);
    return dest;
  }
  const local = path.join(uploadsDir, filename);
  if (!fs.existsSync(local)) {
    throw new Error(`Le fichier "${filename}" n'existe pas sur le serveur.`);
  }
  return local;
}

/**
 * Concatène et trim une liste de clips, applique les overlays.
 * Retourne { url } : URL présignée R2 (prod) ou chemin relatif (dev).
 */
export async function concatenateVideos(clips, jobId = null) {
  if (!clips || clips.length === 0) {
    throw new Error('Aucune vidéo fournie pour le montage.');
  }

  if (isRendering) {
    const error = new Error('Le serveur est déjà en train de monter une vidéo, veuillez patienter.');
    error.status = 429;
    throw error;
  }
  isRendering = true;

  // Support legacy API: array of strings → objects.
  const normalizedClips = clips.map((c) =>
    typeof c === 'string' ? { filename: c } : c
  );

  // Répertoire de travail temporaire (toujours disque local — ffmpeg
  // ne lit pas le réseau).
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-editor-'));
  const outputFilename = `export_${uuidv4()}.mp4`;
  const outputPath = path.join(workDir, outputFilename);

  try {
    // Phase 1 (0→20%) : téléchargement/résolution des clips.
    const localPaths = [];
    for (let i = 0; i < normalizedClips.length; i++) {
      localPaths.push(await resolveClipPath(normalizedClips[i].filename, workDir));
      setProgress(jobId, ((i + 1) / normalizedClips.length) * 20, 'downloading');
    }

    // Phase 2 (20→90%) : encodage ffmpeg.
    await runFfmpeg(normalizedClips, localPaths, outputPath, (pct) => {
      setProgress(jobId, 20 + (pct / 100) * 70, 'encoding');
    });
    setProgress(jobId, 90, 'uploading');

    // Mode R2 : push le rendu sur R2 + URL présignée 24h. Timeout pour ne
    // pas pendre indéfiniment si le réseau R2 décroche (sinon isRendering
    // resterait bloqué).
    if (HAS_R2) {
      const r2Key = `exports/${outputFilename}`;
      logger.info('Upload du master vers R2', { r2Key });
      await withTimeout(uploadToR2(outputPath, r2Key, 'video/mp4'), IO_TIMEOUT_MS, 'Upload R2 du master');
      const url = await withTimeout(getR2PresignedUrl(r2Key, 60 * 60 * 24), 30 * 1000, 'URL présignée R2');
      logger.info('Master uploadé sur R2 avec succès', { r2Key });
      return { url };
    }

    // Mode local (dev) : déplace le rendu dans uploadsDir/exports.
    const exportsDir = path.join(uploadsDir, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    fs.copyFileSync(outputPath, path.join(exportsDir, outputFilename));
    return { url: `/uploads/exports/${outputFilename}` };
  } finally {
    isRendering = false;
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Lance ffmpeg : trim + scale/letterbox + overlays + concat.
 */
async function runFfmpeg(normalizedClips, localPaths, outputPath, onProgress) {
  const workDir = path.dirname(outputPath);
  const normPaths = [];
  
  // Phase 1 : Normalisation séquentielle de chaque clip
  for (let i = 0; i < normalizedClips.length; i++) {
    const { inPoint, outPoint, overlays = [] } = normalizedClips[i];
    const normPath = path.join(workDir, `norm_${i}.mp4`);
    normPaths.push(normPath);

    const hasAudio = await checkAudio(localPaths[i]);

    const command = ffmpeg(localPaths[i]);
    const videoFilters = [];

    if (inPoint != null || outPoint != null) {
      const trimIn = inPoint != null ? inPoint : 0;
      const trimOut = outPoint != null ? outPoint : 9999999;
      videoFilters.push(`trim=${trimIn}:${trimOut},setpts=PTS-STARTPTS`);
    }

    videoFilters.push(
      'scale=1920:1080:force_original_aspect_ratio=decrease',
      'pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      'setsar=1',
      'fps=30',
      'format=yuv420p'
    );

    // Overlays via libass. On passe filename + fontsdir en objet pour que
    // fluent-ffmpeg gère l'échappement, et fontsdir pour résoudre les
    // polices bundlées (sinon texte invisible en prod).
    if (overlays && overlays.length > 0) {
      try {
        const assPath = generateAssFile(overlays, workDir);
        videoFilters.push({
          filter: 'ass',
          options: HAS_FONTS
            ? { filename: assPath, fontsdir: FONTS_DIR }
            : { filename: assPath },
        });
      } catch (err) {
        logger.warn(`Overlays skipped: ${err.message}`);
      }
    }

    command.videoFilters(videoFilters);

    const audioFilters = [];
    if (hasAudio) {
      if (inPoint != null || outPoint != null) {
        const trimIn = inPoint != null ? inPoint : 0;
        const trimOut = outPoint != null ? outPoint : 9999999;
        audioFilters.push(`atrim=${trimIn}:${trimOut},asetpts=PTS-STARTPTS`);
      }
      audioFilters.push(
        'aresample=48000',
        'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'
      );
      command.audioFilters(audioFilters);
      command.outputOptions([
        '-map 0:v:0',
        '-map 0:a:0?'
      ]);
    } else {
      command.input('anullsrc=r=48000:cl=stereo').inputFormat('lavfi');
      command.outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        '-shortest'
      ]);
    }

    // veryfast bat ultrafast ici : plus rapide ET ~3x plus petit à
    // -threads 1. ref/rc-lookahead réduits = moins de RAM (Render 512 Mo).
    command.outputOptions([
      '-c:v libx264',
      '-preset veryfast',
      '-crf 23',
      '-pix_fmt yuv420p',
      '-x264-params', 'rc-lookahead=10:ref=2:sliced-threads=0',
      '-g 60',
      '-c:a aac',
      '-b:a 128k',
      '-ar 48000',
      '-movflags +faststart',
      '-threads 1', // Empreinte mémoire minimale par clip
      '-max_muxing_queue_size 1024'
    ]);

    // Watchdog branché AVANT save() pour ne manquer aucun event.
    const stepPromise = runFfmpegStep(command, `Normalisation clip ${i + 1}/${normalizedClips.length}`, {
      onStart: (cmd) => logger.info(`Normalisation du clip ${i + 1}/${normalizedClips.length}`, { command: cmd }),
      onProgress: (p) => {
        // On répartit la progression sur 90% (Pass 1)
        const baseProgress = (i / normalizedClips.length) * 90;
        const clipProgress = (Math.max(0, Math.min(100, p.percent || 0)) / 100) * (90 / normalizedClips.length);
        if (typeof onProgress === 'function') {
          onProgress(baseProgress + clipProgress);
        }
      },
    });
    command.save(normPath);
    await stepPromise;
  }

  // Phase 2 : Concaténation rapide (0 RAM, juste de la copie de flux)
  logger.info('Assemblage final avec le concat demuxer...');
  const listPath = path.join(workDir, 'list.txt');
  const listContent = normPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listContent);

  const concatCmd = ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy']);

  const concatPromise = runFfmpegStep(concatCmd, 'Concaténation finale', {
    onStart: (cmd) => logger.info('Démarrage concat rapide', { command: cmd }),
  });
  concatCmd.save(outputPath);
  await concatPromise;
  if (typeof onProgress === 'function') onProgress(100);
  logger.info('Concaténation vidéo terminée avec succès');
}
