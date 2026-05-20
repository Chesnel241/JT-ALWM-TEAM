/**
 * Input Sanitizer Middleware
 * Sanitization des inputs utilisateur
 */

import { v4 as uuidv4, validate as validateUUID } from 'uuid';

const FILENAME_SANITIZER = /[^a-zA-Z0-9._-]/g;
const WHITESPACE_NORMALIZER = /\s+/g;

/**
 * Sanitize un nom de fichier
 * @param {string} filename - Nom de fichier original
 * @returns {string} - Nom sanitisé
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return `upload_${Date.now()}`;
  }

  // Remplacer les caractères spéciaux par des underscores
  let sanitized = filename.replace(FILENAME_SANITIZER, '_');
  
  // Normaliser les espaces
  sanitized = sanitized.replace(WHITESPACE_NORMALIZER, '_');
  
  // Limiter la longueur et éviter les doublons de caractères spéciaux
  sanitized = sanitized.replace(/_+/g, '_');
  sanitized = sanitized.substring(0, 255);
  
  return sanitized;
}

/**
 * Valide qu'un ID est en format UUID valide
 * @param {string} id - ID à valider
 * @returns {boolean} - true si valide, false sinon
 */
export function isValidUUID(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return validateUUID(id);
}

/**
 * Valide un paramètre UUID dans une route
 * Utilisé comme middleware pour la validation stricte
 * @param {string} paramName - Nom du paramètre (ex: 'fileId')
 * @returns {Function} - Middleware Express
 */
export function validateUUIDParam(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!isValidUUID(value)) {
      return res.status(400).json({
        code: 'INVALID_UUID',
        message: `Paramètre '${paramName}' doit être un UUID valide`,
        details: { paramName, value: value || 'missing' },
      });
    }
    next();
  };
}

/**
 * Sanitize les paramètres de requête
 * Protège contre les injections
 * @param {Object} params - Paramètres à sanitizer
 * @returns {Object} - Paramètres sanitisés
 */
export function sanitizeParams(params) {
  if (!params || typeof params !== 'object') {
    return {};
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(params)) {
    // Rejeter les clés suspectes
    if (key.includes('__') || key.includes('$')) {
      continue;
    }

    if (typeof value === 'string') {
      // Trim et limiter la longueur (50k pour autoriser les scripts longs)
      sanitized[key] = value.trim().substring(0, 50000);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
    // Ignorer les autres types
  }

  return sanitized;
}

/**
 * Middleware Express pour sanitization des inputs
 */
export function sanitizerMiddleware(req, res, next) {
  // Sanitizer les paramètres de query
  if (req.query) {
    req.query = sanitizeParams(req.query);
  }

  // Sanitizer les paramètres de route
  if (req.params) {
    req.params = sanitizeParams(req.params);
  }

  // Sanitizer le body si présent
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeParams(req.body);
  }

  // Sanitizer le nom de fichier si présent
  if (req.file && req.file.originalname) {
    req.file.sanitizedName = sanitizeFilename(req.file.originalname);
  }

  next();
}

/**
 * Middleware pour valider les UUIDs en paramètres
 */
