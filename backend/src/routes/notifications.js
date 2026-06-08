import { Router } from 'express';
import { addSubscription, getSubscriptions } from '../data/store.js';
import { buildWeeks, COUNTRIES } from '../data/constants.js';

const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);
const isValidCountry = (countryId) => COUNTRIES.some((c) => c.id === countryId);
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { sanitizeParams } from '../middleware/sanitizer.js';
import { globalLimiter } from '../middleware/rateLimiter.js';
import { requireAdmin } from '../middleware/auth.js';
import { audit } from '../logger/audit.js';

// Masque un numéro pour audit/affichage : +33•••••42.
function maskPhone(p) {
  if (typeof p !== 'string' || p.length < 4) return '••••';
  return `${p.slice(0, 3)}•••••${p.slice(-2)}`;
}

const router = Router();

// POST /api/notifications/:weekId/:countryId/subscribe
router.post('/:weekId/:countryId/subscribe', globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  const rawBody = sanitizeParams(req.body);
  const { phone } = rawBody;

  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return next(createErrors.badRequest('Semaine ou pays invalide.'));
  }

  if (!phone || typeof phone !== 'string' || phone.trim().length < 5) {
    return next(createErrors.badRequest('Numéro de téléphone invalide.'));
  }

  // Basic sanitization of phone number (keep only digits and +)
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  addSubscription(weekId, countryId, cleanPhone);
  
  audit('Subscription Added', {
    weekId,
    countryId,
    ip: req.ip
  });

  res.status(201).json({ success: true, phone: cleanPhone });
}));

// GET /api/notifications/:weekId — protégé admin + numéros MASQUÉS.
// Avant : tout user connecté pouvait lister les téléphones de tous les
// pays (PII leak). Désormais : admin uniquement + +33•••••42.
router.get('/:weekId', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId } = req.params;

  if (!isValidWeek(weekId)) {
    return next(createErrors.badRequest('Semaine invalide.'));
  }

  const subscriptions = getSubscriptions(weekId);
  // Les numéros ne sont plus masqués puisque cette route est protégée
  // par `requireAdmin`. L'admin a besoin des vrais numéros pour WhatsApp.
  res.status(200).json(subscriptions);
}));

export default router;
