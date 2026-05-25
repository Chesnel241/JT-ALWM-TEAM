import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';

// Configure ffmpeg to use the static binary from @ffmpeg-installer
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Process an uploaded voiceover audio file to apply "Studio TV" effects:
 * - Highpass filter (removes low rumbles)
 * - Compressor (levels out the volume, making it punchy)
 * - Loudnorm (broadcast standard loudness normalization to -14 LUFS)
 * 
 * @param {string} inputPath - Path to the raw audio file (e.g. webm from browser)
 * @param {string} outputPath - Path where the processed mp3 should be saved
 * @returns {Promise<string>} - The path to the processed file
 */
export function processVoiceover(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // We use a chain of audio filters to enhance the voice:
    // 1. highpass=f=80 (Remove rumbling/wind below 80Hz)
    // 2. acompressor=threshold=0.05:ratio=10:attack=200:release=1000 (Vocal compression)
    // 3. loudnorm=I=-14:TP=-1.5:LRA=11 (EBU R128 Loudness Normalization to -14 LUFS)
    const filterChain = [
      "highpass=f=80",
      "acompressor=threshold=0.05:ratio=10:attack=200:release=1000",
      "loudnorm=I=-14:TP=-1.5:LRA=11"
    ].join(',');

    ffmpeg(inputPath)
      .audioFilters(filterChain)
      .outputOptions('-b:a', '192k') // High quality MP3 bitrate
      .toFormat('mp3')
      .on('start', (commandLine) => {
        console.log('[AudioProcessor] Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('end', () => {
        console.log('[AudioProcessor] Processing finished successfully.');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('[AudioProcessor] Processing error:', err.message);
        reject(err);
      })
      .save(outputPath);
  });
}
