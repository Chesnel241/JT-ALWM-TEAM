import { Router } from 'express';
import { getThemes, saveTheme, deleteTheme } from '../data/store.js';

const router = Router();

const MAX_THEMES = 100;
const HEX = /^#[0-9a-fA-F]{3,8}$/;

// N'accepte qu'une forme connue : { id?, name, colors:{ clé: hex } }. Évite
// le stockage de payloads arbitraires (DoS persistance, stored-XSS si une
// valeur non échappée était injectée dans un style côté front).
function sanitizeTheme(input) {
  if (!input || typeof input !== 'object') return null;
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '';
  if (!name) return null;
  const out = { name };
  if (typeof input.id === 'string') out.id = input.id.slice(0, 40);
  if (input.colors && typeof input.colors === 'object' && !Array.isArray(input.colors)) {
    const colors = {};
    let n = 0;
    for (const [k, v] of Object.entries(input.colors)) {
      if (n >= 20) break;
      if (/^[a-zA-Z0-9_-]{1,30}$/.test(k) && typeof v === 'string' && HEX.test(v.trim())) {
        colors[k] = v.trim();
        n++;
      }
    }
    out.colors = colors;
  }
  return out;
}

router.get('/', (req, res) => {
  res.json(getThemes());
});

router.post('/', (req, res) => {
  const theme = sanitizeTheme(req.body);
  if (!theme) {
    return res.status(400).json({ error: 'Thème invalide (nom requis, couleurs hex uniquement)' });
  }
  const existing = getThemes();
  const isUpdate = theme.id && existing.some((t) => t.id === theme.id);
  if (!isUpdate && existing.length >= MAX_THEMES) {
    return res.status(429).json({ error: `Limite de ${MAX_THEMES} thèmes atteinte` });
  }
  const saved = saveTheme(theme);
  res.json(saved);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteTheme(id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Thème non trouvé' });
  }
});

export default router;
