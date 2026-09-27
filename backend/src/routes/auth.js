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
import rateLimit from 'express-rate-limit';
import logger from '../logger/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verdictAdmin, erreurTropDEssais } from '../middleware/auth.js';

const router = Router();

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
//
// C'est la porte la plus exposée : elle répond oui ou non, rien d'autre. Elle
// passe donc par le vérificateur commun, qui compte les échecs et bloque une
// adresse après trop d'essais (middleware/echecsAdmin.js).
//
// Sans mot de passe configuré — ou avec la valeur d'exemple — elle répondait
// « authentifié » : l'espace montage s'ouvrait, puis chaque action échouait.
// Elle dit désormais la même chose que `requireAdmin` : non.
router.get('/check-admin', authLimiter, (req, res) => {
  const { verdict, attente } = verdictAdmin(req, { compter: true });
  if (verdict === 'ok') return res.json({ authenticated: true });
  if (verdict === 'bloque') {
    const erreur = erreurTropDEssais(attente);
    res.set('Retry-After', String(attente));
    return res.status(429).json({ authenticated: false, error: erreur.publicMessage, code: 'TROP_D_ESSAIS' });
  }
  return res.status(401).json({ authenticated: false });
});

export default router;
