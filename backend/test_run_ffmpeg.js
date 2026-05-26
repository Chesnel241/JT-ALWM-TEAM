import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  const normalizedClips = [
    { inPoint: 0, outPoint: 2, overlays: [] }
  ];
  const localPaths = [path.join(__dirname, 'test_dummy.mp4')];
  const outputPath = path.join(__dirname, 'export_test.mp4');

  // create dummy video
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input('color=c=black:s=1920x1080')
      .inputFormat('lavfi')
      .outputOptions(['-t 2'])
      .save(localPaths[0])
      .on('end', resolve).on('error', reject);
  });

  console.log('Dummy video created.');

  const { concatenateVideos } = await import('./src/services/editorService.js');
  try {
    const res = await concatenateVideos([{ filename: 'test_dummy.mp4' }], 'job-123');
    console.log('SUCCESS:', res);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

runTest();
