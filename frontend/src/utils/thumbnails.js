// Génération de filmstrips (miniatures) pour la timeline.
//
// Deux garde-fous PROD critiques (clips sources de plusieurs Go) :
//  1) Concurrence bornée : au montage d'un JT de 30 min composé de N clips,
//     on N'OUVRE PAS N <video> multi-Go simultanément (pic mémoire / gel /
//     OOM onglet). Une petite file limite à MAX_CONCURRENT à la fois.
//  2) Annulation réelle : chaque tâche accepte un AbortSignal ; à l'annulation
//     (démontage du clip, ou drag de trim qui relance) on stoppe le <video>,
//     on vide sa source et on le retire du DOM immédiatement — sinon il
//     continue de télécharger/seeker en arrière-plan.

const MAX_CONCURRENT = 2;
let active = 0;
const queue = [];

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const task = queue.shift();
    active++;
    task().finally(() => {
      active--;
      pump();
    });
  }
}

/**
 * @param {string} videoUrl
 * @param {number} durationSec
 * @param {number} [thumbnailCount=10]
 * @param {{ signal?: AbortSignal, startTime?: number }} [opts]
 * @returns {Promise<string[]>}
 */
export async function generateThumbnails(videoUrl, durationSec, thumbnailCount = 10, opts = {}) {
  if (!durationSec || durationSec <= 0) return [];
  const { signal, startTime = 0 } = opts;
  if (signal?.aborted) return [];

  return new Promise((resolve) => {
    // Mise en file : la vraie génération ne démarre que lorsqu'un slot se
    // libère (évite d'ouvrir tous les <video> d'un coup).
    queue.push(() => runOne(videoUrl, durationSec, thumbnailCount, signal, resolve, startTime));
    pump();
  });
}

function runOne(videoUrl, durationSec, thumbnailCount, signal, resolveOuter, startTime = 0) {
  return new Promise((done) => {
    if (signal?.aborted) { resolveOuter([]); return done(); }

    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.style.display = 'none';
    document.body.appendChild(video);

    const thumbnails = [];
    const safeStart = Math.max(0, Number(startTime) || 0);
    const interval = durationSec / thumbnailCount;
    let currentTime = safeStart + Math.min(0.5, Math.max(0.05, durationSec / 2));
    let finished = false;

    let onAbort;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (onAbort && signal) signal.removeEventListener('abort', onAbort);
      try {
        video.pause();
        video.removeAttribute('src');
        video.load(); // relâche le buffer réseau immédiatement
      } catch { /* ignore */ }
      if (document.body.contains(video)) document.body.removeChild(video);
    };
    const finish = (result) => {
      cleanup();
      resolveOuter(result);
      done();
    };

    onAbort = () => finish([]);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    // Filet global : ne jamais bloquer un slot de la file plus de 15 s.
    const globalTimeout = setTimeout(() => finish(thumbnails), 15000);

    video.addEventListener('loadeddata', async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 160;
      canvas.height = 90;

      for (let i = 0; i < thumbnailCount; i++) {
        if (finished || signal?.aborted) break;
        video.currentTime = Math.max(safeStart, Math.min(currentTime, safeStart + durationSec - 0.05));
        try {
          await new Promise((res, rej) => {
            const t = setTimeout(() => rej(new Error('Seek timeout')), 3000);
            video.addEventListener('seeked', () => { clearTimeout(t); res(); }, { once: true });
            video.addEventListener('error', (e) => { clearTimeout(t); rej(e); }, { once: true });
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbnails.push(canvas.toDataURL('image/jpeg', 0.5));
        } catch {
          thumbnails.push('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        }
        currentTime += interval;
      }
      clearTimeout(globalTimeout);
      finish(thumbnails);
    });

    video.addEventListener('error', () => {
      clearTimeout(globalTimeout);
      finish([]);
    });

    video.load();
  });
}
