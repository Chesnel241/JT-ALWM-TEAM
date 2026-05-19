/**
 * File Validator Middleware
 * Validation stricte des fichiers uploadés
 */

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.mp3', '.wav', '.txt', '.docx'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB en bytes
const SUSPICIOUS_PATTERNS = /[<>:"|?*\x00-\x1f]/g;

/**
 * Valide un fichier uploadé
 * @param {Object} file - Objet fichier de multer
 * @returns {Object} - {valid: boolean, error?: string}
 */
export function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'Aucun fichier fourni' };
  }

  // Vérifier la présence des propriétés requises
  if (!file.originalname || !file.size || !file.mimetype) {
    return { valid: false, error: 'Fichier invalide ou corrompu' };
  }

  // Vérifier la taille
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `Fichier trop volumineux. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
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
