/**
 * Authentication routes — token-based (X-App-Password).
 *
 * Le mot de passe (token) transite via le header `X-App-Password`
 * pour éviter les blocages de cookies cross-site (ITP) sur Safari
 * lorsque le frontend et le backend sont sur des domaines différents.
 */

import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import rateLimit from 'express-rate-limit';
import logger from '../logger/index.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';

const router = Router();

const GLOBAL_PASSWORD = process.env.GLOBAL_PASSWORD;

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Trop de tentatives de connexion, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login — body: { password }
router.post('/login', loginLimiter, asyncHandler(async (req, res, next) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return next(createErrors.badRequest('Mot de passe requis'));
  }
  if (!GLOBAL_PASSWORD) {
    // Dev local sans password configuré : on accepte n'importe quoi
    return res.json({ success: true, token: 'dev-noauth' });
  }
  if (!safeEqual(password, GLOBAL_PASSWORD)) {
    logger.warn('Login: incorrect password', { context: { ip: req.ip } });
    return next(createErrors.unauthorized('Mot de passe incorrect'));
  }
  
  logger.info('Login successful', { context: { ip: req.ip } });
  // Retourne le mot de passe qui servira de "token" à insérer dans X-App-Password
  return res.json({ success: true, token: password });
}));

// POST /api/auth/logout — ne fait plus rien côté serveur
router.post('/logout', (req, res) => {
  return res.json({ success: true });
});

// GET /api/auth/check — pour que le front sache si la session est valide
router.get('/check', (req, res) => {
  const token = req.headers['x-app-password'];
  if (!token) return res.status(401).json({ authenticated: false });
  
  if (!GLOBAL_PASSWORD) return res.json({ authenticated: true });
  if (!safeEqual(token, GLOBAL_PASSWORD)) return res.status(401).json({ authenticated: false });
  
  return res.json({ authenticated: true });
});

export default router;
