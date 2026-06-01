/**
 * Rate Limiter Middleware
 * Protection contre les abus d'API
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter pour les uploads
 * Limite: 10 uploads par IP / 1 heure
 */
export const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 3600000), // 1 heure
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 10), // 10 requêtes par IP
  message: 'Trop d\'uploads depuis cette IP. Veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false, validate: { xForwardedForHeader: false, default: false },
  skip: (req) => {
    // On ne limite que les requêtes d'upload (POST/PUT),
    // on ignore les requêtes GET (consultation) et DELETE.
    return req.method !== 'POST' && req.method !== 'PUT';
  },
  handler: (req, res, options) => {
    res.status(options.statusCode || 429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: options.message,
      details: {
        retryAfter: req.rateLimit ? req.rateLimit.resetTime : null
      }
    });
  }
});

/**
 * Global rate limiter
 * Limite: 100 requests/min par IP
 */
export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || 60000), // 1 minute
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX_REQUESTS || 500), // 500 requêtes par IP
  message: 'Trop de requêtes depuis cette IP. Veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false, validate: { xForwardedForHeader: false, default: false },
  skip: (req) => {
    // Optionnel: exclure les requêtes GET sur /uploads (fichiers statiques)
    return req.method === 'GET' && req.path.startsWith('/uploads');
  },
  handler: (req, res, options) => {
    res.status(options.statusCode || 429).json({
      code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
      message: options.message,
      details: {
        retryAfter: req.rateLimit ? req.rateLimit.resetTime : null
      }
    });
  }
});

/**
 * Rate limiter pour la création de pays.
 * Sans authentification, n'importe qui pourrait spammer des créations.
 * Limite: 5 créations / IP / 10 min.
 */
export const createLimiter = rateLimit({
  windowMs: parseInt(process.env.CREATE_RATE_LIMIT_WINDOW_MS || 600000), // 10 min
  max: parseInt(process.env.CREATE_RATE_LIMIT_MAX || 5),
  message: 'Trop de créations depuis cette IP. Veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
  handler: (req, res, options) => {
    res.status(options.statusCode || 429).json({
      code: 'CREATE_RATE_LIMIT_EXCEEDED',
      message: options.message,
      details: { retryAfter: req.rateLimit ? req.rateLimit.resetTime : null },
    });
  },
});

export const archiveLimiter = rateLimit({
  windowMs: parseInt(process.env.ARCHIVE_RATE_LIMIT_WINDOW_MS || 60000), // 1 min
  max: parseInt(process.env.ARCHIVE_RATE_LIMIT_MAX || 5), // 5 archives max / min
  message: 'Trop de téléchargements d\'archives. Veuillez patienter.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
  handler: (req, res, options) => {
    res.status(options.statusCode || 429).json({
      code: 'ARCHIVE_RATE_LIMIT_EXCEEDED',
      message: options.message,
      details: { retryAfter: req.rateLimit ? req.rateLimit.resetTime : null },
    });
  },
});

export default { uploadLimiter, globalLimiter, createLimiter, archiveLimiter };
