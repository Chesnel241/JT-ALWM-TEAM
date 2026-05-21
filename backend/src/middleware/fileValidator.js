/**
 * File Validator Middleware
 * Validation stricte des fichiers uploadés.
 */

import { openSync, readSync, closeSync } from 'fs';

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.mp3', '.wav', '.txt', '.docx'];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || 209715200, 10); // 200MB par défaut
const SUSPICIOUS_PATTERNS = /[<>:"|?*\x00-\x1f/\\]/;

// Signatures (magic numbers) des formats acceptés. `.txt` et `.docx` ne
// sont pas vérifiés ici : le txt n'a pas de signature, le docx est un
// ZIP générique (signature PK) déjà couverte par les autres outils.
const MAGIC_SIGNATURES = {
  '.mp4': [
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // 'ftyp' à l'offset 4
  ],
  '.mov': [
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // mov = QuickTime, même boîte ftyp
    { offset: 4, bytes: [0x6d, 0x6f, 0x6f, 0x76] }, // 'moov'
  ],
  '.mp3': [
    { offset: 0, bytes: [0x49, 0x44, 0x33] },       // 'ID3'
    { offset: 0, bytes: [0xff, 0xfb] },             // frame MPEG
    { offset: 0, bytes: [0xff, 0xf3] },
    { offset: 0, bytes: [0xff, 0xf2] },
  ],
  '.wav': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // 'RIFF'
  ],
  '.docx': [
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }, // ZIP local header
    { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] }, // empty archive
  ],
};

function matchesSignature(buf, signature) {
  return signature.bytes.every((b, i) => buf[signature.offset + i] === b);
}

export function validateMagicNumber(filePath, ext) {
  const signatures = MAGIC_SIGNATURES[ext.toLowerCase()];
  if (!signatures) return { valid: true }; // ex: .txt — pas de check
  let fd;
  try {
    fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    readSync(fd, buf, 0, 16, 0);
    const ok = signatures.some((sig) => matchesSignature(buf, sig));
    if (!ok) {
      return {
        valid: false,
        error: `Contenu du fichier ne correspond pas à l'extension ${ext}`,
      };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Lecture du fichier échouée: ${err.message}` };
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }
}

/**
 * Valide un fichier uploadé.
 * @param {Object} file - Objet fichier de multer
 * @param {Object} [opts]
 * @param {number} [opts.maxSize] - Taille max en octets (défaut MAX_FILE_SIZE).
 *   Permet aux routes de spécifier une limite contextuelle (rushes 200 Mo,
 *   delivery 400 Mo, etc.). multer applique déjà sa propre limite avant
 *   d'arriver ici, ce check sert de défense en profondeur.
 * @returns {Object} - {valid: boolean, error?: string}
 */
export function validateFile(file, { maxSize = MAX_FILE_SIZE } = {}) {
  if (!file) {
    return { valid: false, error: 'Aucun fichier fourni' };
  }

  if (!file.originalname || !file.size || !file.mimetype) {
    return { valid: false, error: 'Fichier invalide ou corrompu' };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Fichier trop volumineux. Maximum: ${Math.round(maxSize / (1024 * 1024))}MB`,
    };
  }

  // Vérifier l'extension
  const ext = getFileExtension(file.originalname);
  if (!ALLOWED_EXTENSIONS.includes(ext.toLowerCase())) {
    return { 
      valid: false, 
      error: `Extension non autorisée: ${ext}. Autorisées: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  // Vérifier le MIME type (validation basique)
  const allowedMimes = [
    'video/mp4', 'video/quicktime',
    'audio/mpeg', 'audio/wav',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (!allowedMimes.includes(file.mimetype)) {
    return { 
      valid: false, 
      error: `Type MIME non autorisé: ${file.mimetype}`
    };
  }

  // Vérifier que le nom de fichier ne contient pas de caractères suspects
  if (SUSPICIOUS_PATTERNS.test(file.originalname)) {
    return { 
      valid: false, 
      error: 'Nom de fichier contient des caractères non autorisés'
    };
  }

  return { valid: true };
}

/**
 * Extrait l'extension d'un nom de fichier
 */
function getFileExtension(filename) {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.substring(dot) : '';
}

/**
 * Middleware Express pour validation de fichiers
 */
export function fileValidatorMiddleware(req, res, next) {
  if (!req.file) {
    return next(); // Pas de fichier, laisser passer
  }

  const validation = validateFile(req.file);
  
  if (!validation.valid) {
    return res.status(400).json({
      code: 'INVALID_FILE',
      message: validation.error,
      details: { file: req.file.originalname }
    });
  }

  next();
}

export default fileValidatorMiddleware;
