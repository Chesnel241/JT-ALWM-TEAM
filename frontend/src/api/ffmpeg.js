import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;

export const loadFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();
  
  // Load standard core (no SharedArrayBuffer required for single-threaded mode in v0.12)
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
  });
  return ffmpeg;
};

export const compressVideo = async (file, onProgress) => {
  const ffmpeg = await loadFFmpeg();
  
  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) {
      onProgress(progress * 100);
    }
  });

  const inputName = `input-${Date.now()}.${file.name.split('.').pop() || 'mp4'}`;
  const outputName = `output-${Date.now()}.mp4`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // faststart enables immediate streaming (like HLS)
  // -crf 28 is a good compression ratio for 720p web delivery
  await ffmpeg.exec([
    '-i', inputName,
    '-vcodec', 'libx264',
    '-crf', '28',
    '-preset', 'ultrafast',
    '-s', '1280x720',
    '-acodec', 'aac',
    '-movflags', '+faststart',
    outputName
  ]);

  const data = await ffmpeg.readFile(outputName);
  
  // Cleanup to free memory
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return new File([data.buffer], `compressed_${file.name}`, {
    type: 'video/mp4',
    lastModified: Date.now(),
  });
};
