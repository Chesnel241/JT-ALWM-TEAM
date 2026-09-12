/**
 * Routes d'authentification.
 *
 * Une seule protège réellement quelque chose : `/check-admin`, qui garde
 * l'espace montage derrière `ADMIN_PASSWORD` (header `X-Admin-Password`).
 *
 * `/login`, `/logout` et `/check` n'authentifient plus personne : la
 * plateforme n'a plus de mot de passe global. Elles restent en place pour les
 * clients déjà ouverts dans un onglet, qui continuent de les appeler ; les
 * retirer leur vaudrait une erreur visible sans qu'ils aient rien fait.
 */

import { Router } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import logger from '../logger/index.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';

const router = Router();

// Normalise le mot de passe admin avant comparaison :
// - NFC unicode (un même caractère accentué peut arriver en deux formes
//   différentes selon le clavier ou l'OS)
// - retire les caractères invisibles ajoutés par copier-coller (NBSP,
//   NARROW NBSP, ZW SPACE/JOINER, BOM, WORD JOINER)
// - trim des espaces classiques en début/fin (auto-fill/auto-complete
//   navigateur en injecte fréquemment)
// - toLowerCase (saisie insensible à la casse — décision produit pour
//   limiter les rejets sur clavier mobile, validée par l'admin)
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

// La route n'a plus de secret à garder, mais elle reste publique : on
// plafonne son débit pour qu'un client en boucle ou un robot ne la martèle
// pas. 30/15 min laisse largement passer un bureau-pays entier, dont les
// correspondants partagent une même IP derrière un NAT.
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

// POST /api/auth/login — accepte tout le monde, sans même lire le body :
// il n'y a plus de mot de passe global à vérifier.
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  logger.info('Login (no-auth)', { context: { ip: req.ip } });
  return res.json({ success: true, token: 'no-auth' });
}));

// POST /api/auth/logout — aucune session à fermer côté serveur.
router.post('/logout', (req, res) => {
  return res.json({ success: true });
});

// GET /api/auth/check — répond « authentifié » à tout le monde. Ne pas y
// remettre de garde : les clients n'envoient plus de jeton, et c'est
// `/check-admin` ci-dessous qui protège ce qui doit l'être.
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
