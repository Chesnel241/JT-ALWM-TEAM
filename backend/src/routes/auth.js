/**
 * Authentication routes — token-based (X-App-Password).
 *
 * Le mot de passe (token) transite via le header `X-App-Password`
 * pour éviter les blocages de cookies cross-site (ITP) sur Safari
 * lorsque le frontend et le backend sont sur des domaines différents.
 */

import { Router } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import logger from '../logger/index.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';

const router = Router();

const GLOBAL_PASSWORD = process.env.GLOBAL_PASSWORD ? String(process.env.GLOBAL_PASSWORD).trim() : undefined;

// Normalise un mot de passe avant comparaison :
// - NFC unicode (un même caractère accentué peut arriver en deux formes
//   différentes selon le clavier ou l'OS)
// - retire les caractères invisibles ajoutés par copier-coller (NBSP,
//   NARROW NBSP, ZW SPACE/JOINER, BOM, WORD JOINER)
// - trim des espaces classiques en début/fin (auto-fill/auto-complete
//   navigateur en injecte fréquemment)
// - toLowerCase (login insensible à la casse — décision produit pour
//   limiter les rejets sur mobile, validée par l'admin)
function normalizePassword(s) {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFC')
    .replace(/[\u0009\u00A0\u1680\u2000-\u200D\u202F\u205F\u2060\u3000\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

function safeEqual(a, b) {
  if (a == null || b == null) return false;
  const hashA = createHash('sha256').update(String(a)).digest();
  const hashB = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(hashA, hashB);
}

// Limiteur login : 5/15 min était trop strict — un bureau-pays derrière
// un NAT (5 correspondants partagent la même IP) atteignait la limite et
// recevait 429 que le frontend affichait comme "mot de passe incorrect".
// On passe à 30/15 min pour absorber les tentatives légitimes tout en
// gardant un garde-fou brute-force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '30', 10),
  message: { error: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login — body: { password }
router.post('/login', loginLimiter, asyncHandler(async (req, res, next) => {
  const raw = (req.body || {}).password;
  if (!raw || typeof raw !== 'string') {
    return next(createErrors.badRequest('Mot de passe requis'));
  }
  const password = normalizePassword(raw);
  const expected = normalizePassword(GLOBAL_PASSWORD);
  if (!GLOBAL_PASSWORD) {
    // Dev local sans password configuré : on accepte n'importe quoi
    return res.json({ success: true, token: 'dev-noauth' });
  }
  if (!safeEqual(password, expected)) {
    // Log diagnostic : on enregistre les LONGUEURS reçues/attendues + le
    // delta après normalisation, pas le contenu. Permet de voir si un pays
    // est rejeté pour raison de caractère invisible (raw.length différent
    // de normalized.length) ou de vrai mismatch.
    logger.warn('Login: incorrect password', {
      context: {
        ip: req.ip,
        rawLen: raw.length,
        normalizedLen: password.length,
        expectedLen: expected.length,
      },
    });
    return next(createErrors.unauthorized('Mot de passe incorrect'));
  }

  logger.info('Login successful', { context: { ip: req.ip } });
  // Retourne le mot de passe normalisé qui servira de "token" à insérer
  // dans X-App-Password ; requireAuth re-normalise donc le header sera
  // accepté même si le frontend l'a stocké avec espaces/casse différente.
  return res.json({ success: true, token: password });
}));

// POST /api/auth/logout — ne fait plus rien côté serveur
router.post('/logout', (req, res) => {
  return res.json({ success: true });
});

// GET /api/auth/check — pour que le front sache si la session est valide
router.get('/check', authLimiter, (req, res) => {
  const token = normalizePassword(req.headers['x-app-password']);
  if (!token) return res.status(401).json({ authenticated: false });

  if (!GLOBAL_PASSWORD) return res.json({ authenticated: true });
  if (!safeEqual(token, normalizePassword(GLOBAL_PASSWORD))) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({ authenticated: true });
});

// GET /api/auth/check-admin — vérifier si le mot de passe admin est valide
router.get('/check-admin', authLimiter, (req, res) => {
  const token = normalizePassword(req.headers['x-admin-password']);
  if (!token) return res.status(401).json({ authenticated: false });

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : undefined;
  if (!ADMIN_PASSWORD) return res.json({ authenticated: true });
  if (!safeEqual(token, normalizePassword(ADMIN_PASSWORD))) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({ authenticated: true });
});

export default router;
