export async function generateThumbnails(videoUrl, durationSec, thumbnailCount = 10) {
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

    video.addEventListener('loadeddata', async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // On fixe une petite taille pour les miniatures (ex: 160x90)
      canvas.width = 160;
      canvas.height = 90;

      for (let i = 0; i < thumbnailCount; i++) {
        video.currentTime = Math.min(currentTime, durationSec - 0.1);
        await new Promise((res) => {
          video.addEventListener('seeked', res, { once: true });
        });
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnails.push(canvas.toDataURL('image/jpeg', 0.5));
        
        currentTime += interval;
      }

      document.body.removeChild(video);
      resolve(thumbnails);
    });

    video.addEventListener('error', (e) => {
      document.body.removeChild(video);
      reject(e);
    });

    video.load();
  });
}
