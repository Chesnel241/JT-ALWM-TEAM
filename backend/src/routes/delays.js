import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { porteeCountry } from '../middleware/portee.js';
import {
  getExtensions,
  requestExtension,
  approveExtension,
  setGlobalExtension,
  getStats,
  getCustomCountries,
} from '../data/store.js';
import { buildWeeks, isCountryAccepted, COUNTRIES } from '../data/constants.js';

const router = express.Router();

// Validation partagée : un weekId doit exister dans la fenêtre courante et un
// countryId doit être connu (liste + custom). Sans ça, requestExtension
// écrivait n'importe quel {weekId, countryId} arbitraire dans le store.
const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);
const isValidCountry = (countryId) => isCountryAccepted(countryId, getCustomCountries());

// GET /api/delays/stats - Require ADMIN
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/delays/:weekId - Require APP or ADMIN
router.get('/:weekId', requireAuth, (req, res) => {
  try {
    const { weekId } = req.params;
    const extensions = getExtensions(weekId);
    res.json(extensions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Les demandes de délai en attente, pour l'équipe montage.
 *
 * Une demande était enregistrée puis n'allait nulle part : elle n'apparaissait
 * que dans l'onglet Statistiques, que personne n'ouvre le dimanche matin. Le
 * correspondant croyait avoir engagé quelque chose et attendait une réponse
 * qui ne venait pas, pendant que l'échéance passait.
 */
router.get('/:weekId/demandes', requireAuth, requireAdmin, (req, res) => {
  const { weekId } = req.params;
  if (!isValidWeek(weekId)) return res.status(404).json({ error: 'Semaine invalide' });

  const { requests = {} } = getExtensions(weekId);
  const pays = new Map([...COUNTRIES, ...(getCustomCountries() || [])]
    .filter(Boolean).map((c) => [c.id, c.name]));

  const enAttente = Object.entries(requests)
    .filter(([, d]) => d?.status === 'pending')
    .map(([countryId, d]) => ({
      countryId,
      nom: pays.get(countryId) || countryId.toUpperCase(),
      demandeLe: d.requestedAt || null,
    }))
    // La plus ancienne d'abord : c'est celle qui attend depuis le plus
    // longtemps, et celle dont l'échéance est la plus proche.
    .sort((a, b) => String(a.demandeLe).localeCompare(String(b.demandeLe)));

  return res.json(enAttente);
});

// POST /api/delays/request - Require APP or ADMIN
router.post('/request', requireAuth, porteeCountry((req) => req.body?.countryId), (req, res) => {
  try {
    const { weekId, countryId } = req.body;
    if (!weekId || !countryId) return res.status(400).json({ error: 'Missing parameters' });
    if (!isValidWeek(weekId)) return res.status(404).json({ error: 'Semaine invalide' });
    if (!isValidCountry(countryId)) return res.status(404).json({ error: 'Pays invalide' });
    const ext = requestExtension(weekId, countryId);
    res.json(ext);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delays/approve - Require ADMIN
router.post('/approve', requireAuth, requireAdmin, (req, res) => {
  try {
    const { weekId, countryId, minutes } = req.body;
    if (!weekId || !countryId || typeof minutes !== 'number' || !Number.isFinite(minutes)) return res.status(400).json({ error: 'Missing parameters' });
    if (minutes <= 0 || minutes > 10080) return res.status(400).json({ error: 'Durée invalide (1 à 10080 minutes)' });
    if (!isValidWeek(weekId)) return res.status(404).json({ error: 'Semaine invalide' });
    if (!isValidCountry(countryId)) return res.status(404).json({ error: 'Pays invalide' });
    const ext = approveExtension(weekId, countryId, minutes);
    res.json(ext);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delays/global - Require ADMIN
router.post('/global', requireAuth, requireAdmin, (req, res) => {
  try {
    const { weekId, minutes } = req.body;
    if (!weekId || typeof minutes !== 'number' || !Number.isFinite(minutes)) return res.status(400).json({ error: 'Missing parameters' });
    if (minutes <= 0 || minutes > 10080) return res.status(400).json({ error: 'Durée invalide (1 à 10080 minutes)' });
    if (!isValidWeek(weekId)) return res.status(404).json({ error: 'Semaine invalide' });
    const ext = setGlobalExtension(weekId, minutes);
    res.json(ext);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
