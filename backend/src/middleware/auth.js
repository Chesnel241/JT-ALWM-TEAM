import { createErrors } from './errorHandler.js';
import logger from '../logger/index.js';
import { timingSafeEqual, createHash } from 'crypto';

const GLOBAL_PASSWORD = process.env.GLOBAL_PASSWORD ? String(process.env.GLOBAL_PASSWORD).trim() : undefined;
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_PROD = process.env.NODE_ENV === 'production';

// Mêmes règles que routes/auth.js : NFC + retrait des caractères invisibles
// (NBSP, ZW*, BOM) + trim + lowercase (décision : login insensible à la
// casse pour les pays qui tapent en majuscules sur mobile). Aligne le
// comparateur sur le format normalisé que le frontend envoie après login.
// Exportée pour les vérifications hors middleware (TUS notamment).
export function normalizeToken(s) {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFC')
    .replace(/[\u0009\u00A0\u1680\u2000-\u200D\u202F\u205F\u2060\u3000\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

// Comparaison à temps constant (anti-timing-attack). On hache les deux entrées
// en SHA-256 (32 octets fixes) AVANT timingSafeEqual : ça élimine l'oracle de
// longueur (un early-return sur des Buffer de tailles différentes laisserait
// fuiter la longueur du secret par timing). Exportée pour les vérifications
// admin hors middleware (app.js, routes/uploads.js).
export function safeEqual(a, b) {
  if (a == null || b == null) return false;
  const hashA = createHash('sha256').update(String(a)).digest();
  const hashB = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(hashA, hashB);
}

// Fail-closed en prod si pas de mot de passe configuré.
if (IS_PROD && !GLOBAL_PASSWORD) {
  logger.error('FATAL: GLOBAL_PASSWORD not set in production — refusing to start');
  throw new Error('GLOBAL_PASSWORD environment variable is required in production');
}

export function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (IS_TEST) return next();

  // EXCEPTION : Le téléchargement d'archive ZIP d'un pays est public
  // (décision produit — voir bypass dédié). On SCOPE le bypass à l'URL
  // EXACTE attendue (`/api/uploads/:weekId/:countryId/archive`) pour éviter
  // qu'une future route ou un path forgé finissant par `/archive` ne
  // contourne l'auth.
  if (req.method === 'GET'
      && /^\/api\/uploads\/[^/?#]+\/[^/?#]+\/archive(?:[/?#]|$)/.test(req.originalUrl)) {
    return next();
  }

  // Si aucun mot de passe n'est configuré (ex: dev local), on laisse passer
  if (!GLOBAL_PASSWORD) return next();

  const raw = req.header('x-app-password');
  const token = normalizeToken(raw);

  if (token && safeEqual(token, normalizeToken(GLOBAL_PASSWORD))) {
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

  const token = normalizeToken(req.header('x-admin-password'));

  if (token && safeEqual(token, normalizeToken(ADMIN_PASSWORD))) {
    return next();
  }

  logger.warn('Admin authentication failed: Invalid or missing X-Admin-Password', {
    context: { path: req.path, ip: req.ip },
  });
  return next(createErrors.forbidden('Mot de passe administrateur incorrect ou manquant'));
}
