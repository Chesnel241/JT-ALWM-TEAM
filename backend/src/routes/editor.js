import express from 'express';
import { body, validationResult } from 'express-validator';
import { concatenateVideos } from '../services/editorService.js';
import { addListener, removeListener, finishJob } from '../services/editorProgress.js';
import logger from '../logger/index.js';

const router = express.Router();

// GET /api/editor/progress/:jobId — flux SSE de progression du montage.
// EventSource ne peut pas poser de header → auth via ?pwd= (supporté
// par requireAuth). Le client ouvre ce flux avant de lancer /concat.
router.get('/progress/:jobId', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
  const { jobId } = req.params;
  addListener(jobId, res);
  req.on('close', () => removeListener(jobId, res));
});

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
    body('clips.*.overlays')
      .optional()
      .isArray()
      .withMessage('overlays doit être un tableau.'),
    body('clips.*.overlays.*.templateId')
      .optional()
      .isString()
      .withMessage('Chaque overlay doit avoir un templateId valide.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { clips, jobId } = req.body;

      logger.info('Demande de concaténation reçue', { clipsCount: clips.length, jobId });

      // Run async to prevent Render 100s timeout on HTTP request
      concatenateVideos(clips, jobId)
        .then(({ url }) => {
          finishJob(jobId, 'done', url);
        })
        .catch((err) => {
          logger.error('Erreur lors du montage vidéo en arrière-plan', { error: err.message });
          finishJob(jobId, 'error');
        });

      res.status(202).json({
        message: 'Montage démarré avec succès en arrière-plan.',
      });
    } catch (err) {
      logger.error('Erreur lors du montage vidéo via /editor/concat', { error: err.message });
      if (req.body?.jobId) finishJob(req.body.jobId, 'error');
      next(err);
    }
  }
);

export default router;
