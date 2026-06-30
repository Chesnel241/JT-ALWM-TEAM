// Transcription audio → sous-titres, 100% navigateur (Whisper base via
// Transformers.js). Aucune charge serveur, aucune API payante. Import dynamique
// pour ne pas alourdir le bundle initial (chunk séparé chargé à la demande).

let _pipe = null;

async function getTranscriber(onModelProgress) {
  if (_pipe) return _pipe;
  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = false; // modèles depuis le CDN Hugging Face
  _pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
    progress_callback: (p) => {
      if (p?.status === 'progress' && typeof p.progress === 'number') onModelProgress?.(p.progress / 100);
    },
  });
  return _pipe;
}

// Décode un média en Float32 mono ~16 kHz (rééchantillonné par l'AudioContext).
async function decodeAudio(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Impossible de charger l\'audio du clip.');
  const buf = await res.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC({ sampleRate: 16000 });
  const decoded = await ctx.decodeAudioData(buf);
  try { ctx.close(); } catch { /* ignore */ }
  if (decoded.numberOfChannels > 1) {
    const a = decoded.getChannelData(0);
    const b = decoded.getChannelData(1);
    const mono = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) mono[i] = (a[i] + b[i]) / 2;
    return mono;
  }
  return decoded.getChannelData(0);
}

/**
 * Transcrit l'audio d'un média (URL) en segments { start, end, text } (s).
 * onStatus(string), onProgress(0..1) pour l'UI.
 */
export async function transcribe(url, { onStatus, onProgress } = {}) {
  onStatus?.('Chargement du modèle (1re fois ~240 Mo)…');
  const transcriber = await getTranscriber((p) => onProgress?.(p));
  onStatus?.('Décodage de l\'audio…');
  const audio = await decodeAudio(url);
  onStatus?.('Transcription en cours…');
  const out = await transcriber(audio, {
    return_timestamps: true,
    language: 'french',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const chunks = out?.chunks || [];
  return chunks
    .map((c) => ({
      start: Array.isArray(c.timestamp) ? (c.timestamp[0] ?? 0) : 0,
      end: Array.isArray(c.timestamp) ? (c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 2) : 2,
      text: (c.text || '').trim(),
    }))
    .filter((s) => s.text);
}
