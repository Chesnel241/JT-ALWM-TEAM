import { createErrors } from './errorHandler.js';
import logger from '../logger/index.js';
import { COOKIE_NAME } from '../routes/auth.js';

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

  // Auth UNIQUEMENT via cookie httpOnly posé par POST /api/auth/login.
  // Plus de header X-App-Password, plus de query string : le secret ne
  // transite plus depuis du JS accessible côté client (XSS-resistant).
  const cookie = req.cookies?.[COOKIE_NAME];
  if (cookie) return next();

  logger.warn('Authentication failed: No valid session cookie', {
    context: { path: req.path, ip: req.ip },
  });
  return next(createErrors.unauthorized('Session requise'));
}
