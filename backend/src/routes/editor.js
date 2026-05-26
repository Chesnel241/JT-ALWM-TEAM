import express from 'express';
import { body, validationResult } from 'express-validator';
import { concatenateVideos } from '../services/editorService.js';
import logger from '../logger/index.js';

const router = express.Router();

router.post(
  '/concat',
  [
    body('videoFilenames').isArray({ min: 1 }).withMessage('videoFilenames doit être un tableau non vide contenant les noms des fichiers à monter.')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { videoFilenames } = req.body;

      logger.info('Demande de concaténation reçue', { videosCount: videoFilenames.length });

      // On lance le traitement de manière synchrone car le frontend attend
      // Le timeout Express (REQUEST_TIMEOUT_MS) devrait couvrir cela s'il est suffisamment élevé.
      const exportPath = await concatenateVideos(videoFilenames);

      // On retourne le chemin relatif qui peut être lu via GET /uploads/exports/nomdufichier.mp4
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
