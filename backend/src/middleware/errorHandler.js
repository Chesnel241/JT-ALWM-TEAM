/**
 * Global Error Handler Middleware
 * Gestion centralisée des erreurs avec Winston logging
 */

import logger from '../logger/index.js';
import { recordError } from '../monitoring/metrics.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Uniform error response format
 */
const formatErrorResponse = (error, statusCode) => {
  // En prod, on n'expose JAMAIS error.message brut (peut leak des
  // paths, requêtes SQL, stack traces). On exige un `publicMessage`
  // explicite (les helpers `createErrors.*` en définissent un) ;
  // sinon on retombe sur un message générique selon le code HTTP.
  const isClientErr = statusCode >= 400 && statusCode < 500;
  const safeMessage = isDev
    ? (error.publicMessage || error.message)
    : (error.publicMessage
        || (isClientErr ? 'Requête invalide' : 'Erreur serveur interne'));

  return {
    success: false,
    error: isDev ? error.message : (isClientErr ? 'Bad request' : 'Internal server error'),
    code: error.code || statusCode,
    message: safeMessage,
    timestamp: new Date().toISOString(),
    ...(isDev && error.stack && { stack: error.stack }),
  };
};

/**
 * Wrapper pour les routes async
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware global d'error handling
 * IMPORTANT: Doit être le dernier middleware enregistré
 */
export function errorHandlerMiddleware(err, req, res, next) {
  // Record error in metrics
  recordError(err);

  // Déterminer le code HTTP
  let statusCode = err.statusCode || err.status || 500;
  if (statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  // Logger l'erreur
  if (statusCode >= 500) {
    logger.error(`Server error: ${err.message}`, {
      error: err.message,
      stack: err.stack,
      context: {
        method: req.method,
        path: req.path,
        url: req.originalUrl,
        statusCode,
        ip: req.ip,
      },
    });
  } else {
    logger.info(`Client error (${statusCode}): ${err.message}`, {
      context: {
        method: req.method,
        path: req.path,
        error: err.message,
        statusCode,
      },
    });
  }

  let response;

  // Erreurs multer (upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    response = formatErrorResponse(
      {
        message: 'Fichier trop volumineux',
        code: 'FILE_TOO_LARGE',
        publicMessage: 'Fichier trop volumineux'
      },
      413
    );
    statusCode = 413;
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    response = formatErrorResponse(
      {
        message: 'Trop de fichiers',
        code: 'TOO_MANY_FILES',
        publicMessage: 'Trop de fichiers'
      },
      400
    );
    statusCode = 400;
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    response = formatErrorResponse(
      {
        message: 'Champ fichier non valide',
        code: 'INVALID_FILE_FIELD',
        publicMessage: 'Champ fichier non valide'
      },
      400
    );
    statusCode = 400;
  } else if (err instanceof SyntaxError && 'body' in err) {
    response = formatErrorResponse(
      {
        message: 'JSON invalide',
        code: 'INVALID_JSON',
        publicMessage: 'Erreur de format JSON'
      },
      400
    );
    statusCode = 400;
  } else if (err.code === 'ENOSPC') {
    // Disk full
    logger.error('Disk space exhausted', {
      error: err.message,
      context: { code: 'ENOSPC', path: err.path },
    });
    response = formatErrorResponse(
      {
        message: 'Espace disque insuffisant',
        code: 'DISK_FULL',
        publicMessage: 'Espace disque insuffisant. Veuillez réessayer plus tard.'
      },
      507
    );
    statusCode = 507;
  } else if (err.code === 'EACCES') {
    // Permission denied
    logger.error('Permission denied', {
      error: err.message,
      context: { code: 'EACCES', path: err.path },
    });
    response = formatErrorResponse(
      {
        message: 'Permission refusée',
        code: 'PERMISSION_DENIED',
        publicMessage: 'Permission refusée pour cette opération'
      },
      403
    );
    statusCode = 403;
  } else {
    response = formatErrorResponse(err, statusCode);
  }

  // Envoyer la réponse
  res.status(statusCode).json(response);
}

/**
 * Classe d'erreur customisée
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, publicMessage = null) {
    super(message);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage || message;
    this.code = 'APP_ERROR';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erreurs courantes prédéfinies
 */
export const createErrors = {
  notFound: (resource) =>
    new AppError(
      `${resource} not found`,
      404,
      `${resource} introuvable`
    ),

  unauthorized: (message) =>
    new AppError(message, 401, message),

  badRequest: (message) =>
    new AppError(message, 400, message),

  validationError: (details) =>
    new AppError(
      `Validation error: ${details}`,
      422,
      `Erreur de validation: ${details}`
    ),

  fileSizeError: () =>
    new AppError(
      'File size exceeds limit',
      413,
      'Fichier trop volumineux'
    ),

  fileTypeError: () =>
    new AppError(
      'File type not allowed',
      415,
      'Type de fichier non autorisé'
    ),

  diskFullError: () =>
    new AppError(
      'Disk space exhausted',
      507,
      'Espace disque insuffisant'
    ),

  uploadTimeout: () =>
    new AppError(
      'Upload timeout',
      408,
      'Temps d\'upload dépassé (30s max)'
    ),

  internalError: (message = 'Internal server error') =>
    new AppError(message, 500, 'Erreur serveur interne'),

  rateLimitError: (retryAfter) =>
    new AppError(
      'Too many requests',
      429,
      `Trop de requêtes. Réessayez après ${retryAfter}s`
    ),
};

/**
 * Middleware 404 - Doit être enregistré après toutes les routes
 */
export function notFoundMiddleware(req, res, next) {
  const error = createErrors.notFound(`Route ${req.method} ${req.path}`);
  next(error);
}

export default errorHandlerMiddleware;
