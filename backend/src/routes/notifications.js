import { Router } from 'express';
import {
  addSubscription, getSubscriptions, getCustomCountries,
  getContacts, setContact, retirerContact,
} from '../data/store.js';
import { paysARelancer } from '../services/manquants.js';
import { buildWeeks, isCountryAccepted } from '../data/constants.js';

const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);
// Source de vérité unique (constants.js).
const isValidCountry = (countryId) => isCountryAccepted(countryId, getCustomCountries());
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { sanitizeParams } from '../middleware/sanitizer.js';
import { globalLimiter } from '../middleware/rateLimiter.js';
import { requireAdmin } from '../middleware/auth.js';
import { porteeCountry } from '../middleware/portee.js';
import { audit } from '../logger/audit.js';

// Masque un numéro pour audit/affichage : +33•••••42.
function maskPhone(p) {
  if (typeof p !== 'string' || p.length < 4) return '••••';
  return `${p.slice(0, 3)}•••••${p.slice(-2)}`;
}

const router = Router();

// POST /api/notifications/:weekId/:countryId/subscribe
router.post('/:weekId/:countryId/subscribe', porteeCountry(), globalLimiter, asyncHandler(async (req, res, next) => {
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

// ---------------------------------------------------------------------------
// Contacts durables
// ---------------------------------------------------------------------------
// Un numéro était rangé POUR UNE SEMAINE : la suivante, la liste repartait
// vide, et le bloc « prévenir les pays que le JT est prêt » n'avait plus
// personne à prévenir. En pratique personne ne ressaisit son numéro chaque
// lundi. Le carnet vit donc en dehors des semaines.

router.get('/contacts', requireAdmin, globalLimiter, asyncHandler(async (_req, res) => {
  return res.json(getContacts());
}));

router.put('/contacts/:countryId', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const { countryId } = req.params;
  if (!isValidCountry(countryId)) return next(createErrors.badRequest('Pays invalide.'));

  const phone = String(sanitizeParams(req.body)?.phone || '').replace(/[^\d+]/g, '');
  if (phone.length < 5) return next(createErrors.badRequest('Numéro de téléphone invalide.'));

  setContact(countryId, phone);
  audit('Contact Updated', { countryId, phone: maskPhone(phone), ip: req.ip });
  return res.json({ countryId, phone });
}));

router.delete('/contacts/:countryId', requireAdmin, globalLimiter, asyncHandler(async (req, res) => {
  retirerContact(req.params.countryId);
  audit('Contact Removed', { countryId: req.params.countryId, ip: req.ip });
  return res.status(204).end();
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

// ---------------------------------------------------------------------------
// Relances
// ---------------------------------------------------------------------------
/**
 * Les pays dont il manque encore quelque chose, avec leur numéro.
 *
 * La plateforme savait déjà les deux : qui n'a rien envoyé, et à quel numéro
 * écrire. Il ne manquait que de les mettre côte à côte pour que la relance du
 * samedi cesse d'être une revue manuelle du tableau de bord.
 */
router.get('/:weekId/relances', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId } = req.params;
  if (!isValidWeek(weekId)) return next(createErrors.badRequest('Semaine invalide.'));

  const carnet = getContacts();
  // Le numéro confirmé cette semaine prime sur celui du carnet : c'est le
  // plus récent que le correspondant ait donné.
  const cetteSemaine = new Map(
    getSubscriptions(weekId)
      .filter((s) => s.origine !== 'contact')
      .map((s) => [s.countryId, s.phone]),
  );

  const liste = paysARelancer(weekId).map((pays) => ({
    ...pays,
    phone: cetteSemaine.get(pays.countryId) || carnet[pays.countryId]?.phone || '',
  }));

  return res.json(liste);
}));

export default router;
