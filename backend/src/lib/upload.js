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

/**
 * Type MIME → extension. L'inverse de `classifyUpload`, pour le cas où le nom
 * du fichier n'a PAS d'extension.
 *
 * Ce cas est fréquent et n'a rien d'anormal : le partage Android (« Envoyer
 * vers… »), certains sélecteurs de fichiers et les blobs recollés livrent un
 * nom nu. Le refuser coûtait un reportage ; le navigateur, lui, annonce
 * presque toujours un type utilisable.
 */
const MIME_VERS_EXTENSION = new Map([
  ['video/mp4', '.mp4'], ['video/x-m4v', '.m4v'], ['video/quicktime', '.mov'],
  ['video/x-msvideo', '.avi'], ['video/avi', '.avi'], ['video/x-matroska', '.mkv'],
  ['video/webm', '.webm'], ['video/mpeg', '.mpg'], ['video/3gpp', '.3gp'],
  ['video/3gpp2', '.3g2'], ['video/x-ms-wmv', '.wmv'], ['video/x-flv', '.flv'],
  ['video/mp2t', '.ts'], ['video/ogg', '.ogv'], ['video/x-ms-asf', '.asf'],

  ['audio/mpeg', '.mp3'], ['audio/mp3', '.mp3'], ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'], ['audio/wave', '.wav'], ['audio/vnd.wave', '.wav'],
  ['audio/ogg', '.ogg'], ['audio/mp4', '.m4a'], ['audio/x-m4a', '.m4a'],
  ['audio/aac', '.aac'], ['audio/aacp', '.aac'], ['audio/flac', '.flac'],
  ['audio/x-flac', '.flac'], ['audio/opus', '.opus'], ['audio/amr', '.amr'],
  ['audio/3gpp', '.3ga'], ['audio/webm', '.webm'], ['audio/x-aiff', '.aiff'],
  ['audio/aiff', '.aiff'], ['audio/x-caf', '.caf'], ['audio/ac3', '.ac3'],

  ['image/jpeg', '.jpg'], ['image/jpg', '.jpg'], ['image/png', '.png'],
  ['image/webp', '.webp'], ['image/gif', '.gif'], ['image/bmp', '.bmp'],
  ['image/tiff', '.tif'], ['image/heic', '.heic'], ['image/heif', '.heif'],
  ['image/avif', '.avif'],

  ['text/plain', '.txt'], ['text/markdown', '.md'], ['text/rtf', '.rtf'],
  ['application/rtf', '.rtf'], ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.oasis.opendocument.text', '.odt'],
  ['application/zip', '.zip'], ['application/x-zip-compressed', '.zip'],
]);

// Dernier recours quand le type est d'une famille connue mais d'un sous-type
// qu'on ne référence pas. L'extension ne sert qu'au classement et aux indices
// de lecture : ffmpeg et le montage travaillent sur le contenu réel. Mieux
// vaut un rangement approximatif qu'un reportage refusé.
const EXTENSION_PAR_FAMILLE = { video: '.mp4', audio: '.m4a', image: '.jpg' };

/** Extension déduite d'un type MIME, ou '' si rien d'exploitable. */
export function extensionDepuisMime(mimetype) {
  const mime = String(mimetype || '').toLowerCase().split(';')[0].trim();
  if (!mime) return '';
  const exacte = MIME_VERS_EXTENSION.get(mime);
  if (exacte && ALLOWED_EXTENSIONS.has(exacte)) return exacte;
  const famille = EXTENSION_PAR_FAMILLE[mime.split('/')[0]];
  return famille && ALLOWED_EXTENSIONS.has(famille) ? famille : '';
}

/**
 * L'extension à retenir pour un envoi : celle du nom si elle est acceptée,
 * sinon celle que trahit le type MIME. Chaîne vide = rien d'exploitable, et
 * c'est seulement là qu'un refus se justifie.
 */
export function extensionEffective(originalName, mimetype = '') {
  const nom = String(originalName || '');
  const point = nom.lastIndexOf('.');
  const ext = point > 0 ? nom.slice(point).toLowerCase() : '';
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return ext;
  return extensionDepuisMime(mimetype);
}

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
 * Conteneurs qui transportent indifféremment de la vidéo ou du son seul.
 * Leur extension ne suffit donc pas à trancher.
 */
const CONTENEURS_AMBIGUS = new Set([
  '.webm', '.ogg', '.mp4', '.mov', '.m4v', '.3gp', '.3g2', '.mkv', '.asf', '.ts',
]);

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
  return classifyExtension(ext, mimetype);
}

/**
 * Même décision, à partir d'une extension déjà établie — typiquement celle
 * que les octets ont révélée, qui prime sur ce que le nom laissait croire.
 */
export function classifyExtension(extension, mimetype = '') {
  const ext = String(extension || '').toLowerCase();

  const effective = ext && ALLOWED_EXTENSIONS.has(ext) ? ext : extensionDepuisMime(mimetype);
  const famille = String(mimetype || '').toLowerCase().split('/')[0];

  // Certains conteneurs portent aussi bien de la vidéo que du son seul : un
  // enregistrement de voix off en WebM/Opus est rangé « vidéo » par sa seule
  // extension, et le monteur le retrouve parmi les rushes. Quand le
  // navigateur, lui, sait qu'il a enregistré du son, on le croit.
  if (CONTENEURS_AMBIGUS.has(effective) && (famille === 'audio' || famille === 'image')) {
    return famille;
  }

  if (VIDEO_EXTENSIONS.includes(effective)) return 'video';
  if (IMAGE_EXTENSIONS.includes(effective)) return 'image';
  if (AUDIO_EXTENSIONS.includes(effective)) return 'audio';
  if (DOCUMENT_EXTENSIONS.includes(effective)) return 'script';

  const mime = String(mimetype || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';

  // Inconnu : un document, pas une vidéo. Le classement par défaut vers
  // 'video' envoyait n'importe quel fichier douteux dans les rushes.
  return 'script';
}
