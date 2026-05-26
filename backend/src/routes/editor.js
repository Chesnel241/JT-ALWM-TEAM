import express from 'express';
import { body, validationResult } from 'express-validator';
import { concatenateVideos } from '../services/editorService.js';
import logger from '../logger/index.js';

const router = express.Router();

router.post(
  '/concat',
  [
    body('clips')
      .isArray({ min: 1 })
      .withMessage('clips doit être un tableau non vide.'),
    body('clips.*.filename')
      .isString()
      .notEmpty()
      .withMessage('Chaque clip doit avoir un filename valide.'),
    body('clips.*.inPoint')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('inPoint doit être un nombre positif (en secondes).'),
    body('clips.*.outPoint')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('outPoint doit être un nombre positif (en secondes).'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { clips } = req.body;

      logger.info('Demande de concaténation reçue', { clipsCount: clips.length });

      const exportPath = await concatenateVideos(clips);

      res.status(200).json({
        message: 'Montage terminé avec succès.',
        exportUrl: `/uploads/${exportPath}`
      });
    } catch (err) {
      logger.error('Erreur lors du montage vidéo via /editor/concat', { error: err.message });
      next(err);
    }
  }
);

export default router;
