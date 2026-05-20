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

export const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || 209715200, 10); // 200MB
export const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.mp3', '.wav', '.txt', '.docx']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const fileUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Type de fichier non autorisé'));
    }
    return cb(null, true);
  },
});
