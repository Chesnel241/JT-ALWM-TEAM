export async function generateThumbnails(videoUrl, durationSec, thumbnailCount = 10) {
  if (!durationSec || durationSec <= 0) return [];
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    
    // On cache la vidéo
    video.style.display = 'none';
    document.body.appendChild(video);

    const thumbnails = [];
    const interval = durationSec / thumbnailCount;
    let currentTime = 0.5; // Commence un peu après 0 pour éviter un écran noir initial

    let cleanup = () => {
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
    };

    video.addEventListener('loadeddata', async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // On fixe une petite taille pour les miniatures (ex: 160x90)
      canvas.width = 160;
      canvas.height = 90;

      for (let i = 0; i < thumbnailCount; i++) {
        video.currentTime = Math.min(currentTime, durationSec - 0.1);
        try {
          await new Promise((res, rej) => {
            const timeout = setTimeout(() => rej(new Error('Seek timeout')), 3000);
            video.addEventListener('seeked', () => {
              clearTimeout(timeout);
              res();
            }, { once: true });
            video.addEventListener('error', (e) => {
              clearTimeout(timeout);
              rej(e);
            }, { once: true });
          });
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbnails.push(canvas.toDataURL('image/jpeg', 0.5));
        } catch (err) {
          console.warn("Erreur miniature:", err);
          // Continuer quand même pour éviter un crash total
          thumbnails.push('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'); // Pixel transparent
        }
        
        currentTime += interval;
      }

      cleanup();
      resolve(thumbnails);
    });

    video.addEventListener('error', (e) => {
      cleanup();
      // On resolve avec tableau vide au lieu de rejecter pour ne pas casser l'UI
      console.warn("Impossible de charger la vidéo pour les miniatures", e);
      resolve([]);
    });

    // Timeout global
    setTimeout(() => {
      cleanup();
      resolve(thumbnails);
    }, 15000);

    video.load();
  });
}
