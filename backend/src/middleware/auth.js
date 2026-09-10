import { createErrors } from './errorHandler.js';
import logger from '../logger/index.js';
import { timingSafeEqual, createHash } from 'crypto';
import { readReporterToken } from '../lib/reporterToken.js';

const IS_TEST = process.env.NODE_ENV === 'test';

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

// Mot de passe global de session RETIRÉ intentionnellement (décision produit :
// la plateforme n'a plus besoin d'un mot de passe partagé pour les
// correspondants). Le check est supprimé ici EN CODE, pas seulement en
// laissant GLOBAL_PASSWORD vide en .env : une variable restaurée par
// erreur dans le .env ne doit plus jamais pouvoir rouvrir cette porte
// toute seule (avant : un ancien garde fail-closed refusait même de
// démarrer le serveur en prod si la variable était absente).
// requireAdmin (ADMIN_PASSWORD) reste inchangé : c'est une protection
// distincte pour les actions d'équipe montage, hors du périmètre de ce
// retrait. Pour réintroduire un mot de passe de session, il faudra
// réécrire cette fonction (voir l'historique git pour l'ancienne logique).
export function requireAuth(req, res, next) {
  return next();
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

/**
 * Lit le lien personnel s'il y en a un, et pose `req.correspondant`.
 *
 * Délibérément non bloquant : l'API reste ouverte, par décision produit. Ce
 * middleware ATTRIBUE un envoi à quelqu'un quand c'est possible ; il n'en
 * refuse aucun. Un jeton absent, expiré d'usage ou falsifié laisse simplement
 * `req.correspondant` à null, et tout continue comme avant.
 *
 * Le nom `requireReporter` a été écarté exprès : il aurait laissé croire à
 * une garde. C'est `readReporter`.
 */
export function readReporter(req, _res, next) {
  const brut = req.header('x-reporter-token') || req.query?.k || '';
  const correspondant = readReporterToken(brut);
  req.correspondant = correspondant;
  return next();
}
