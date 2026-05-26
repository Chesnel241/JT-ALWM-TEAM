import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import os from 'os';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { uploadsDir } from '../lib/upload.js';
import { HAS_R2, getR2ReadStream, uploadToR2, getR2PresignedUrl } from '../lib/s3.js';
import logger from '../logger/index.js';
import { getTemplate } from '../data/overlayTemplates.js';
import { setProgress } from './editorProgress.js';

let isRendering = false;

const checkAudio = (filePath) => new Promise((resolve) => {
  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err || !metadata || !metadata.streams) return resolve(false);
    resolve(metadata.streams.some(s => s.codec_type === 'audio'));
  });
});

// Enregistre le binaire ffmpeg fourni par @ffmpeg-installer (sinon
// fluent-ffmpeg ne trouve pas ffmpeg sur Render → crash "Cannot find ffmpeg").
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use bundled ffmpeg binary — works locally and on Render without system install
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
logger.info(`FFmpeg binary path: ${ffmpegInstaller.path}`);

// Bundled font — used for all drawtext overlays.
const FONT_PATH = path.join(__dirname, '../../fonts/Inter.ttf')
  .replace(/\\/g, '/'); // FFmpeg always wants forward slashes
const HAS_FONT = fs.existsSync(FONT_PATH);

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

    // Mode R2 : push le rendu sur R2 + URL présignée 24h.
    if (HAS_R2) {
      const r2Key = `exports/${outputFilename}`;
      await uploadToR2(outputPath, r2Key, 'video/mp4');
      const url = await getR2PresignedUrl(r2Key, 60 * 60 * 24);
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

    await new Promise((resolve, reject) => {
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
        'fps=30'
      );

      // Overlays
      if (HAS_FONT) {
        for (const overlay of overlays) {
          const template = getTemplate(overlay.templateId);
          if (!template) continue;
          try {
            const drawtextFilters = template.build(overlay.fields || {}, FONT_PATH);
            const startSec = overlay.startTime ?? 0;
            const durSec = overlay.duration ?? null;
            for (const filter of drawtextFilters) {
              if (durSec != null) {
                const filterName = filter.split('=')[0];
                const rest = filter.slice(filterName.length + 1);
                videoFilters.push(`${filterName}=enable='between(t,${startSec},${startSec + durSec})':${rest}`);
              } else {
                videoFilters.push(filter);
              }
            }
          } catch (err) {
             logger.warn(`Overlay skipped: ${err.message}`);
          }
        }
      } else if (overlays.length > 0) {
        logger.warn('Overlays ignorés : police Inter.ttf introuvable');
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
      } else {
        command.input('anullsrc=r=48000:cl=stereo').inputFormat('lavfi');
        command.outputOptions([
          '-map 0:v:0',
          '-map 1:a:0',
          '-shortest'
        ]);
      }
      
      command.outputOptions([
        '-c:v libx264',
        '-crf 23',
        '-preset ultrafast',
        '-c:a aac',
        '-b:a 192k',
        '-movflags +faststart',
        '-threads 1', // Memory footprint ultra minimal par clip
        '-max_muxing_queue_size 1024'
      ]);
      
      command
        .on('start', (cmd) => logger.info(`Normalisation du clip ${i + 1}/${normalizedClips.length}`, { command: cmd }))
        .on('progress', (p) => {
           // On répartit la progression sur 90% (Pass 1)
           const baseProgress = (i / normalizedClips.length) * 90;
           const clipProgress = (Math.max(0, Math.min(100, p.percent || 0)) / 100) * (90 / normalizedClips.length);
           if (typeof onProgress === 'function') {
             onProgress(baseProgress + clipProgress);
           }
        })
        .on('end', resolve)
        .on('error', reject)
        .save(normPath);
    });
  }

  // Phase 2 : Concaténation rapide (0 RAM, juste de la copie de flux)
  logger.info('Assemblage final avec le concat demuxer...');
  const listPath = path.join(workDir, 'list.txt');
  const listContent = normPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listContent);

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .on('start', (cmd) => logger.info('Démarrage concat rapide', { command: cmd }))
      .on('end', () => {
        if (typeof onProgress === 'function') onProgress(100);
        logger.info('Concaténation vidéo terminée avec succès');
        resolve();
      })
      .on('error', (err) => {
        logger.error('Erreur lors de la concat rapide FFmpeg', { error: err.message });
        reject(err);
      })
      .save(outputPath);
  });
}
