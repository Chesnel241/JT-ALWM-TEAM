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

  // Listener nommé + off() en finally : ffmpeg est un singleton, sans
  // retrait les callbacks de progress des uploads précédents s'accumulent
  // et continuent de tirer sur des barres de progression mortes.
  const handleProgress = ({ progress }) => {
    if (onProgress) {
      onProgress(progress * 100);
    }
  };
  ffmpeg.on('progress', handleProgress);

  const inputName = `input-${Date.now()}.${file.name.split('.').pop() || 'mp4'}`;
  const outputName = `output-${Date.now()}.mp4`;

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // faststart enables immediate streaming (like HLS)
    // -crf 28 is a good compression ratio for 720p web delivery
    // scale préserve le ratio (les vidéos verticales smartphone ne sont
    // plus écrasées en 16:9) et garde des dimensions paires pour yuv420p.
    await ffmpeg.exec([
      '-i', inputName,
      '-vcodec', 'libx264',
      '-crf', '28',
      '-preset', 'ultrafast',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-acodec', 'aac',
      '-movflags', '+faststart',
      outputName
    ]);

    const data = await ffmpeg.readFile(outputName);

    return new File([data.buffer], `compressed_${file.name}`, {
      type: 'video/mp4',
      lastModified: Date.now(),
    });
  } finally {
    ffmpeg.off('progress', handleProgress);
    // Cleanup to free wasm memory, même si exec a échoué.
    try { await ffmpeg.deleteFile(inputName); } catch { /* absent */ }
    try { await ffmpeg.deleteFile(outputName); } catch { /* absent */ }
  }
};
