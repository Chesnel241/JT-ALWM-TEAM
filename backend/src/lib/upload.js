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

// Source de vérité des formats acceptés, partagée par multer, TUS et le
// validateur. Volontairement large : les correspondants filment et
// enregistrent avec ce qu'ils ont — HEIC sur iPhone, 3GP et AMR sur des
// Android d'entrée de gamme, MTS depuis un caméscope. Un format refusé, c'est
// un reportage perdu pour la semaine.
export const VIDEO_EXTENSIONS = [
  '.mp4', '.m4v', '.mov', '.avi', '.mkv', '.webm', '.mpg', '.mpeg', '.mpe',
  '.3gp', '.3g2', '.wmv', '.flv', '.f4v', '.ts', '.mts', '.m2ts', '.ogv',
  '.vob', '.asf', '.divx',
];

export const AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.wave', '.ogg', '.oga', '.m4a', '.m4b', '.aac', '.flac',
  '.opus', '.wma', '.amr', '.3ga', '.aif', '.aiff', '.caf', '.ac3',
];

export const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff',
  '.heic', '.heif', '.avif',
];

export const DOCUMENT_EXTENSIONS = [
  '.txt', '.rtf', '.md', '.doc', '.docx', '.odt', '.pdf', '.zip',
];

export const ALLOWED_EXTENSIONS = new Set([
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
]);

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

/**
 * Famille d'un fichier reçu : 'video' | 'image' | 'audio' | 'script'.
 *
 * L'extension d'abord, le type MIME seulement en secours. Les téléphones et
 * les clients d'upload annoncent très souvent application/octet-stream : en
 * se fiant au MIME, un .wav ou un .mp3 était enregistré comme une vidéo, et
 * l'équipe montage le retrouvait rangé avec les rushes.
 */
export function classifyUpload(originalName, mimetype = '') {
  const name = String(originalName || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';

  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (DOCUMENT_EXTENSIONS.includes(ext)) return 'script';

  const mime = String(mimetype || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';

  // Inconnu : un document, pas une vidéo. Le classement par défaut vers
  // 'video' envoyait n'importe quel fichier douteux dans les rushes.
  return 'script';
}
