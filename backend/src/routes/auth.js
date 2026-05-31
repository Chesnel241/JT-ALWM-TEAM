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

function safeEqual(a, b) {
  if (!a || !b) return false;
  const hashA = createHash('sha256').update(String(a).toLowerCase()).digest();
  const hashB = createHash('sha256').update(String(b).toLowerCase()).digest();
  return timingSafeEqual(hashA, hashB);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Trop de tentatives de connexion, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login — body: { password }
router.post('/login', loginLimiter, asyncHandler(async (req, res, next) => {
  let { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return next(createErrors.badRequest('Mot de passe requis'));
  }
  password = password.trim();
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
router.get('/check', authLimiter, (req, res) => {
  const token = req.headers['x-app-password'];
  if (!token) return res.status(401).json({ authenticated: false });
  
  if (!GLOBAL_PASSWORD) return res.json({ authenticated: true });
  if (!safeEqual(token, GLOBAL_PASSWORD)) return res.status(401).json({ authenticated: false });
  
  return res.json({ authenticated: true });
});

// GET /api/auth/check-admin — vérifier si le mot de passe admin est valide
router.get('/check-admin', authLimiter, (req, res) => {
  let token = req.headers['x-admin-password'];
  if (!token) return res.status(401).json({ authenticated: false });
  token = typeof token === 'string' ? token.trim() : token;
  
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : undefined;
  if (!ADMIN_PASSWORD) return res.json({ authenticated: true });
  if (!safeEqual(token, ADMIN_PASSWORD)) return res.status(401).json({ authenticated: false });
  
  return res.json({ authenticated: true });
});

export default router;
