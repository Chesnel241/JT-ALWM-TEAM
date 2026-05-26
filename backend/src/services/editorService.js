import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { uploadsDir } from '../lib/upload.js';
import { HAS_R2, getR2ReadStream, uploadToR2, getR2PresignedUrl } from '../lib/s3.js';
import logger from '../logger/index.js';
import { getTemplate } from '../data/overlayTemplates.js';

// Enregistre le binaire ffmpeg fourni par @ffmpeg-installer (sinon
// fluent-ffmpeg ne trouve pas ffmpeg sur Render → crash "Cannot find ffmpeg").
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Bundled font — used for all drawtext overlays.
const FONT_PATH = path.join(__dirname, '../../fonts/Inter.ttf')
  .replace(/\\/g, '/'); // FFmpeg always wants forward slashes
const HAS_FONT = fs.existsSync(FONT_PATH);

// Télécharge un fichier R2 vers un chemin local. Retourne destPath.
async function downloadFromR2(r2Key, destPath) {
  const stream = await getR2ReadStream(r2Key);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    stream.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    stream.pipe(out);
  });
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
export async function concatenateVideos(clips) {
  if (!clips || clips.length === 0) {
    throw new Error('Aucune vidéo fournie pour le montage.');
  }

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
    // Télécharge/résout tous les clips AVANT de lancer ffmpeg.
    const localPaths = [];
    for (const clip of normalizedClips) {
      localPaths.push(await resolveClipPath(clip.filename, workDir));
    }

    await runFfmpeg(normalizedClips, localPaths, outputPath);

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
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Lance ffmpeg : trim + scale/letterbox + overlays + concat.
 */
function runFfmpeg(normalizedClips, localPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    const filterGraph = [];
    let concatInputs = '';

    for (let i = 0; i < normalizedClips.length; i++) {
      const { inPoint, outPoint, overlays = [] } = normalizedClips[i];
      command.input(localPaths[i]);

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

      // Overlays drawtext/drawbox — seulement si la police est présente.
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
            logger.warn(`Overlay skipped (template error): ${err.message}`);
          }
        }
      } else if (overlays.length > 0) {
        logger.warn('Overlays ignorés : police Inter.ttf introuvable');
      }

      filterGraph.push(`[${i}:v]${videoFilters.join(',')}[v${i}]`);

      const audioFilters = [];
      if (inPoint != null || outPoint != null) {
        const trimIn = inPoint != null ? inPoint : 0;
        const trimOut = outPoint != null ? outPoint : 9999999;
        audioFilters.push(`atrim=${trimIn}:${trimOut},asetpts=PTS-STARTPTS`);
      }
      audioFilters.push(
        'aresample=48000',
        'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'
      );
      filterGraph.push(`[${i}:a]${audioFilters.join(',')}[a${i}]`);

      concatInputs += `[v${i}][a${i}]`;
    }

    filterGraph.push(
      `${concatInputs}concat=n=${normalizedClips.length}:v=1:a=1[outv][outa]`
    );

    command
      .complexFilter(filterGraph, ['outv', 'outa'])
      .outputOptions([
        '-c:v libx264',
        '-crf 23',
        '-preset fast',
        '-c:a aac',
        '-b:a 192k',
        '-movflags +faststart',
      ])
      .on('start', (cmd) => logger.info('Démarrage de la concaténation vidéo', { command: cmd }))
      .on('progress', (p) => logger.debug("Progression de l'export...", { percent: p.percent }))
      .on('end', () => {
        logger.info('Concaténation vidéo terminée avec succès');
        resolve();
      })
      .on('error', (err) => {
        logger.error('Erreur lors de la concaténation FFmpeg', { error: err.message });
        reject(err);
      })
      .save(outputPath);
  });
}
