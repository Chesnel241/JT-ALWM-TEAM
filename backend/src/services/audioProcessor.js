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
    // 1. Remove background hum/hiss
    // 2. Remove low-end rumble
    // 3. Noise gate to silence breaths/room noise in pauses
    // 4. Smooth out dynamics (fast attack, moderate release, 4:1 ratio)
    // 5. Mild EQ boost for presence/crispness (Radio announcer EQ)
    // 6. EBU R128 loudness normalization
    const filterChain = [
      "afftdn=nf=-25",
      "highpass=f=80",
      "agate=threshold=0.04:ratio=4:attack=2:release=100",
      "acompressor=threshold=0.1:ratio=4:attack=5:release=100",
      "treble=g=2:f=4000:w=0.5t",
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
