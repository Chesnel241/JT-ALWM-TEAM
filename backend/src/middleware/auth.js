import { timingSafeEqual } from 'crypto';
import { createErrors } from './errorHandler.js';
import logger from '../logger/index.js';

const GLOBAL_PASSWORD = process.env.GLOBAL_PASSWORD;
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_PROD = process.env.NODE_ENV === 'production';

// Fail-closed en prod si pas de mot de passe configuré : on ne veut
// JAMAIS exposer l'API avec un secret hardcodé dans le repo. En dev/test,
// on tolère l'absence (les tests bypassent de toute façon).
if (IS_PROD && !GLOBAL_PASSWORD) {
  logger.error('FATAL: GLOBAL_PASSWORD not set in production — refusing to start');
  // Throw au load → empêche le serveur de démarrer sans password.
  throw new Error('GLOBAL_PASSWORD environment variable is required in production');
}

// Comparaison timing-safe pour éviter les attaques par timing.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (IS_TEST) return next();

  // Hors prod : si pas de password configuré, on laisse passer (dev local).
  if (!GLOBAL_PASSWORD) return next();

  const providedPassword = req.headers['x-app-password'] || req.query.pwd;

  if (!providedPassword) {
    logger.warn('Authentication failed: No password provided', {
      context: { path: req.path, ip: req.ip },
    });
    return next(createErrors.unauthorized('Mot de passe requis'));
  }

  if (!safeEqual(providedPassword, GLOBAL_PASSWORD)) {
    logger.warn('Authentication failed: Incorrect password', {
      context: { path: req.path, ip: req.ip },
    });
    return next(createErrors.unauthorized('Mot de passe incorrect'));
  }

  next();
}
