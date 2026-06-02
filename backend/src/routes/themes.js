import { Router } from 'express';
import { getThemes, saveTheme, deleteTheme } from '../data/store.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getThemes());
});

router.post('/', (req, res) => {
  const theme = req.body;
  if (!theme || !theme.name) {
    return res.status(400).json({ error: 'Thème invalide (nom manquant)' });
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
