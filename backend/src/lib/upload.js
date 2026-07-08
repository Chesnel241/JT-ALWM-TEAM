/**
 * Configuration multer partagée entre les routes /uploads et /deliveries.
 *
 * Stockage disque sur le path absolu UPLOADS_DIR (disque persistant
 * Render en prod). Validation extension + taille — la vérif magic
 * number se fait au niveau de la route (après écriture sur disque).
 */

import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { uploadsDir as resolveUploadsDir } from './paths.js';

export const uploadsDir = resolveUploadsDir();

// Limites dimensionnées pour la prod VPS : les masters/rushes réels pèsent
// jusqu'à 20 Go (montages de 30 min). TUS (chunks 5 Mo + reprise) tient cette
// taille ; la saturation disque est surveillée par l'alerte DISK_CAPACITY_MB.
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || 21474836480, 10);            // 20 GB
export const DELIVERY_MAX_FILE_SIZE = parseInt(process.env.DELIVERY_MAX_FILE_SIZE || 21474836480, 10); // 20 GB

export const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.mp3', '.wav', '.txt', '.docx', '.zip', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.webm', '.ogg', '.aac']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

function buildUploader(maxSize) {
  return multer({
    storage,
    limits: { fileSize: maxSize, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        const err = new Error('Type de fichier non autorisé');
        err.code = 'INVALID_FILE_TYPE';
        return cb(err);
      }
      return cb(null, true);
    },
  });
}

export const fileUpload = buildUploader(MAX_FILE_SIZE);
export const deliveryUpload = buildUploader(DELIVERY_MAX_FILE_SIZE);
