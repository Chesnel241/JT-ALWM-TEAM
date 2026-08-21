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

// POST /api/auth/login — mot de passe de session global retiré (décision
// produit). Accepte toujours, sans exiger de body : le frontend peut encore
// appeler cette route (compat), mais elle ne bloque plus jamais personne.
// requireAdmin (ADMIN_PASSWORD) reste, lui, entièrement inchangé.
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  logger.info('Login (no-auth)', { context: { ip: req.ip } });
  return res.json({ success: true, token: 'no-auth' });
}));

// POST /api/auth/logout — ne fait plus rien côté serveur
router.post('/logout', (req, res) => {
  return res.json({ success: true });
});

// GET /api/auth/check — plus de mot de passe de session à vérifier : toujours
// authentifié. Important : NE PAS remettre un `if (!token) return 401`
// avant ce point — ordonné ainsi, ça bloquait le frontend (App.jsx gate le
// rendu entier sur ce endpoint) même une fois le mot de passe retiré
// partout ailleurs, puisque localStorage n'a plus de token à envoyer.
router.get('/check', authLimiter, (_req, res) => {
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
