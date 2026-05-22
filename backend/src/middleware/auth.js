import { createErrors } from './errorHandler.js';
import logger from '../logger/index.js';

const GLOBAL_PASSWORD = process.env.GLOBAL_PASSWORD;
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_PROD = process.env.NODE_ENV === 'production';

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

  const token = req.header('x-app-password');
  
  if (token && token === GLOBAL_PASSWORD) {
    return next();
  }

  logger.warn('Authentication failed: Invalid or missing X-App-Password', {
    context: { path: req.path, ip: req.ip },
  });
  return next(createErrors.unauthorized('Session requise'));
}
