import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { uploadsDir } from '../lib/upload.js';
import logger from '../logger/index.js';
import { getTemplate } from '../data/overlayTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use bundled ffmpeg binary — works locally and on Render without system install
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
logger.info(`FFmpeg binary path: ${ffmpegInstaller.path}`);

// Bundled font — used for all drawtext overlays.
const FONT_PATH = path.join(__dirname, '../../fonts/Inter.ttf')
  .replace(/\\/g, '/'); // FFmpeg always wants forward slashes

/**
 * Concatenate and optionally trim a list of video clips.
 * @param {Array<{filename: string, inPoint?: number, outPoint?: number}>} clips
 *   - filename: the file stored in uploadsDir
 *   - inPoint:  start trim in seconds (default: 0 = keep from beginning)
 *   - outPoint: end trim in seconds (default: null = keep until end)
 */
export async function concatenateVideos(clips) {
  return new Promise((resolve, reject) => {
    if (!clips || clips.length === 0) {
      return reject(new Error('Aucune vidéo fournie pour le montage.'));
    }

    // Support legacy API: if clips is an array of strings, convert to objects.
    const normalizedClips = clips.map((c) =>
      typeof c === 'string' ? { filename: c } : c
    );

    const exportsDir = path.join(uploadsDir, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const outputFilename = `export_${uuidv4()}.mp4`;
    const outputPath = path.join(exportsDir, outputFilename);

    const command = ffmpeg();
    const filterGraph = [];
    let concatInputs = '';

    for (let i = 0; i < normalizedClips.length; i++) {
      const { filename, inPoint, outPoint, overlays = [] } = normalizedClips[i];
      const filePath = path.join(uploadsDir, filename);

      if (!fs.existsSync(filePath)) {
        return reject(new Error(`Le fichier "${filename}" n'existe pas sur le serveur.`));
      }

      command.input(filePath);

      // Build video filter chain for this clip
      const videoFilters = [];

      // 1. Apply trim if requested
      if (inPoint != null || outPoint != null) {
        const trimIn  = inPoint  != null ? inPoint  : 0;
        const trimOut = outPoint != null ? outPoint : 9999999;
        videoFilters.push(`trim=${trimIn}:${trimOut},setpts=PTS-STARTPTS`);
      }

      // 2. Scale to 1920x1080 with black bars (letterbox) to handle any format
      videoFilters.push(
        'scale=1920:1080:force_original_aspect_ratio=decrease',
        'pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
        'setsar=1',
        'fps=30'
      );

      // 3. Apply text overlays (drawtext + drawbox) for each annotation
      for (const overlay of overlays) {
        const template = getTemplate(overlay.templateId);
        if (!template) continue;
        try {
          const drawtextFilters = template.build(overlay.fields || {}, FONT_PATH);
          // Enable/disable overlay based on timing (if specified)
          const startSec = overlay.startTime ?? 0;
          const durSec   = overlay.duration  ?? null;
          
          for (const filter of drawtextFilters) {
            // Wrap filter with enable expression if timing is set
            if (durSec != null) {
              const filterName = filter.split('=')[0]; // drawtext or drawbox
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

      filterGraph.push(`[${i}:v]${videoFilters.join(',')}[v${i}]`);

      // Build audio filter chain for this clip
      const audioFilters = [];

      if (inPoint != null || outPoint != null) {
        const trimIn  = inPoint  != null ? inPoint  : 0;
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
      .on('start', (cmd) => {
        logger.info('Démarrage de la concaténation vidéo', { command: cmd });
      })
      .on('progress', (progress) => {
        logger.debug("Progression de l'export...", { percent: progress.percent });
      })
      .on('end', () => {
        logger.info('Concaténation vidéo terminée avec succès', { outputFilename });
        resolve(`exports/${outputFilename}`);
      })
      .on('error', (err) => {
        logger.error('Erreur lors de la concaténation FFmpeg', { error: err.message });
        reject(err);
      })
      .save(outputPath);
  });
}

