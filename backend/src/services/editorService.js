import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadsDir } from '../lib/upload.js';
import logger from '../logger/index.js';

export async function concatenateVideos(videoFilenames) {
  return new Promise((resolve, reject) => {
    if (!videoFilenames || videoFilenames.length === 0) {
      return reject(new Error('Aucune vidéo fournie pour le montage.'));
    }

    const exportsDir = path.join(uploadsDir, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const outputFilename = `export_${uuidv4()}.mp4`;
    const outputPath = path.join(exportsDir, outputFilename);

    const command = ffmpeg();
    const filterGraph = [];
    let concatInputs = '';

    videoFilenames.forEach((filename, i) => {
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`Le fichier ${filename} n'existe pas sur le serveur.`));
      }
      
      command.input(filePath);

      // Force 1920x1080 30fps with black padding for vertical/odd videos
      filterGraph.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`);
      
      // Standardize audio to 48kHz stereo to avoid concat errors
      filterGraph.push(`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`);
      
      concatInputs += `[v${i}][a${i}]`;
    });

    filterGraph.push(`${concatInputs}concat=n=${videoFilenames.length}:v=1:a=1[outv][outa]`);

    command
      .complexFilter(filterGraph, ['outv', 'outa'])
      .outputOptions([
        '-c:v libx264',
        '-crf 23',
        '-preset fast', // 'fast' for quicker rendering
        '-c:a aac',
        '-b:a 192k',
        '-movflags +faststart'
      ])
      .on('start', (cmd) => {
        logger.info('Démarrage de la concaténation vidéo', { command: cmd });
      })
      .on('progress', (progress) => {
        // En conditions réelles, on pourrait émettre cela via WebSocket ou SSE.
        // Ici, on le log simplement.
        logger.debug('Progression de l\'export...', { percent: progress.percent });
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
