import { createErrors } from './errorHandler.js';
import logger from '../logger/index.js';
import { timingSafeEqual } from 'crypto';

const GLOBAL_PASSWORD = process.env.GLOBAL_PASSWORD ? String(process.env.GLOBAL_PASSWORD).trim() : undefined;
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_PROD = process.env.NODE_ENV === 'production';

// Comparaison à temps constant (anti-timing-attack). Exportée pour les
// vérifications admin hors middleware (app.js, routes/uploads.js).
export function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a).toLowerCase());
  const bufB = Buffer.from(String(b).toLowerCase());
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Fail-closed en prod si pas de mot de passe configuré.
if (IS_PROD && !GLOBAL_PASSWORD) {
  logger.error('FATAL: GLOBAL_PASSWORD not set in production — refusing to start');
  throw new Error('GLOBAL_PASSWORD environment variable is required in production');
}

export function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (IS_TEST) return next();

  // Si aucun mot de passe n'est configuré (ex: dev local), on laisse passer
  if (!GLOBAL_PASSWORD) return next();

  let token = req.header('x-app-password') || req.query.pwd;
  token = typeof token === 'string' ? token.trim() : token;
  
  if (token && safeEqual(token, GLOBAL_PASSWORD)) {
    return next();
  }

  logger.warn('Authentication failed: Invalid or missing X-App-Password', {
    context: { path: req.path, ip: req.ip },
  });
  return next(createErrors.unauthorized('Session requise'));
}

export function requireAdmin(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (IS_TEST) return next();

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : undefined;
  if (!ADMIN_PASSWORD) {
    logger.warn('Admin action attempted but ADMIN_PASSWORD is not set on the server.');
    return next(createErrors.forbidden('Action non configurée (mot de passe admin manquant sur le serveur)'));
  }

  let token = req.header('x-admin-password');
  token = typeof token === 'string' ? token.trim() : token;
  
  if (token && safeEqual(token, ADMIN_PASSWORD)) {
    return next();
  }

  logger.warn('Admin authentication failed: Invalid or missing X-Admin-Password', {
    context: { path: req.path, ip: req.ip },
  });
  return next(createErrors.forbidden('Mot de passe administrateur incorrect ou manquant'));
}
