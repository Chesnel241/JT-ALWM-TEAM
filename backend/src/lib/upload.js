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

// Limites séparées : les rushes restent à 200 Mo (volume × pays × jours),
// les deliveries (montage final) peuvent monter à 400 Mo car c'est un
// fichier unique par semaine et la qualité finale pèse plus lourd.
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || 209715200, 10);            // 200 MB
export const DELIVERY_MAX_FILE_SIZE = parseInt(process.env.DELIVERY_MAX_FILE_SIZE || 419430400, 10); // 400 MB

export const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.mp3', '.wav', '.txt', '.docx', '.zip', '.jpg', '.jpeg', '.png']);

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
        return cb(new Error('Type de fichier non autorisé'));
      }
      return cb(null, true);
    },
  });
}

export const fileUpload = buildUploader(MAX_FILE_SIZE);
export const deliveryUpload = buildUploader(DELIVERY_MAX_FILE_SIZE);
