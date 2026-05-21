import { Router } from 'express';
import { addSubscription, getSubscriptions } from '../data/store.js';
import { isValidWeek, isValidCountry } from '../data/constants.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { sanitizeParams } from '../middleware/sanitizer.js';
import { globalLimiter } from '../middleware/rateLimiter.js';
import { audit } from '../logger/audit.js';

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

// GET /api/notifications/:weekId
router.get('/:weekId', globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId } = req.params;

  if (!isValidWeek(weekId)) {
    return next(createErrors.badRequest('Semaine invalide.'));
  }

  const subscriptions = getSubscriptions(weekId);
  res.status(200).json(subscriptions);
}));

export default router;
