/**
 * Authentication routes — cookie-based.
 *
 * Le mot de passe ne transite plus jamais via localStorage ou query
 * string. Login = POST avec body { password }. Si OK, on dépose un
 * cookie httpOnly + Secure + SameSite=None (le frontend Vercel est
 * sur un autre domaine que le backend Render → cross-site).
 */

import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import logger from '../logger/index.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';

const router = Router();

const GLOBAL_PASSWORD = process.env.GLOBAL_PASSWORD;
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_NAME = 'jt-auth';
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function cookieOptions() {
  return {
    httpOnly: true,                     // JavaScript ne peut PAS le lire
    secure: IS_PROD,                    // HTTPS only en prod
    sameSite: IS_PROD ? 'none' : 'lax', // cross-site cookies en prod (Vercel ↔ Render)
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

// POST /api/auth/login — body: { password }
router.post('/login', asyncHandler(async (req, res, next) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return next(createErrors.badRequest('Mot de passe requis'));
  }
  if (!GLOBAL_PASSWORD) {
    // Dev local sans password configuré : on accepte n'importe quoi
    // pour que le dev local marche sans GLOBAL_PASSWORD défini.
    res.cookie(COOKIE_NAME, 'dev-noauth', cookieOptions());
    return res.json({ success: true });
  }
  if (!safeEqual(password, GLOBAL_PASSWORD)) {
    logger.warn('Login: incorrect password', { context: { ip: req.ip } });
    return next(createErrors.unauthorized('Mot de passe incorrect'));
  }
  // On stocke un sentinel arbitraire dans le cookie ; la valeur n'a pas
  // d'importance, seul son existence + httpOnly + sameSite comptent.
  res.cookie(COOKIE_NAME, 'ok', cookieOptions());
  logger.info('Login successful', { context: { ip: req.ip } });
  return res.json({ success: true });
}));

// POST /api/auth/logout — clear cookie
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/', sameSite: IS_PROD ? 'none' : 'lax', secure: IS_PROD });
  return res.json({ success: true });
});

// GET /api/auth/check — pour que le front sache si la session est valide
router.get('/check', (req, res) => {
  const cookie = req.cookies?.[COOKIE_NAME];
  if (!cookie) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true });
});

export default router;
export { COOKIE_NAME };
