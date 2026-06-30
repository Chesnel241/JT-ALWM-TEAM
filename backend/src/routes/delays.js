import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getExtensions,
  requestExtension,
  approveExtension,
  setGlobalExtension,
  getStats
} from '../data/store.js';

const router = express.Router();

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

// POST /api/delays/request - Require APP or ADMIN
router.post('/request', requireAuth, (req, res) => {
  try {
    const { weekId, countryId } = req.body;
    if (!weekId || !countryId) return res.status(400).json({ error: 'Missing parameters' });
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
    if (!weekId || !countryId || typeof minutes !== 'number') return res.status(400).json({ error: 'Missing parameters' });
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
    if (!weekId || typeof minutes !== 'number') return res.status(400).json({ error: 'Missing parameters' });
    const ext = setGlobalExtension(weekId, minutes);
    res.json(ext);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
