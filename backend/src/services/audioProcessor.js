import ffmpeg from '../lib/ffmpeg.js';
import path from 'path';
import fs from 'fs';

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
    // 1. Reset timestamps to start at zero (crucial for MediaRecorder WebM files)
    // 2. Resample and fix any timestamp gaps (async=1)
    // 3. Remove background hum/hiss
    // 4. Remove low-end rumble
    // 5. Noise gate to silence breaths/room noise in pauses
    // 6. Smooth out dynamics (fast attack, moderate release, 4:1 ratio)
    // 7. Mild EQ boost for presence/crispness (Radio announcer EQ)
    // 8. EBU R128 loudness normalization
    const filterChain = [
      "asetpts=PTS-STARTPTS",
      "aresample=async=1",
      "highpass=f=80",
      "acompressor=threshold=0.1:ratio=4:attack=5:release=100",
      "treble=g=2:f=4000",
      "loudnorm=I=-14:TP=-1.5:LRA=11"
    ].join(',');

    ffmpeg(inputPath)
      .inputOptions([
        '-fflags +genpts', // Generate missing PTS timestamps for WebM streams
        '-analyzeduration 100M', // Probe deeper to find stream info
        '-probesize 100M'
      ])
      .noVideo() // Ensure ffmpeg ignores any empty video streams from MediaRecorder
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
