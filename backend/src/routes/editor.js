import express from 'express';
import { body, validationResult } from 'express-validator';
import { concatenateVideos } from '../services/editorService.js';
import { addListener, removeListener, finishJob, getJobState } from '../services/editorProgress.js';
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

// GET /api/editor/result/:jobId — état du job en polling. Fallback robuste
// quand le SSE est coupé par un proxy : le frontend récupère ainsi le
// résultat (url) même si la connexion temps réel a sauté pendant le rendu.
router.get('/result/:jobId', (req, res) => {
  const state = getJobState(req.params.jobId);
  if (!state) return res.status(404).json({ status: 'unknown' });
  res.json(state);
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
      .withMessage('outPoint doit être un nombre positif (en secondes).')
      .custom((value, { req, path }) => {
        const match = path.match(/^clips\[(\d+)\]\.outPoint$/);
        if (match) {
          const index = match[1];
          const inPoint = req.body.clips[index].inPoint;
          if (inPoint !== undefined && value <= inPoint) {
            throw new Error('outPoint doit être strictement supérieur à inPoint.');
          }
        }
        return true;
      }),
    body('clips.*.overlays')
      .optional()
      .isArray()
      .withMessage('overlays doit être un tableau.'),
    body('clips.*.overlays.*.startTime')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('startTime doit être positif.'),
    body('clips.*.overlays.*.duration')
      .optional()
      .isFloat({ min: 0.1 })
      .withMessage('duration doit être supérieur à 0.'),
    body('clips.*.overlays.*.templateId')
      .optional()
      .isString()
      .withMessage('Chaque overlay doit avoir un templateId valide.'),
    body('clips.*.overlays.*.animation')
      .optional()
      .isIn(['fade', 'slide', 'scale', 'sweep', 'typewriter'])
      .withMessage('animation invalide.'),
    body('clips.*.overlays.*.font')
      .optional()
      .isString().isLength({ max: 40 })
      .withMessage('font invalide.'),
    body('clips.*.transition.type')
      .optional()
      .isIn(['fade', 'fadeblack', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'dissolve', 'circleopen', 'circleclose', 'pixelize'])
      .withMessage('Type de transition invalide.'),
    body('clips.*.transition.duration')
      .optional()
      .isFloat({ min: 0.2, max: 2 })
      .withMessage('Durée de transition entre 0.2 et 2 s.'),
    body('clips.*.kenBurns.mode')
      .optional()
      .isIn(['in', 'out'])
      .withMessage('Mode Ken Burns invalide.'),
    body('globalOverlays')
      .optional()
      .isArray()
      .withMessage('globalOverlays doit être un tableau.'),
    body('globalOverlays.*.templateId')
      .optional()
      .isString()
      .withMessage('templateId global invalide.'),
    body('logo')
      .optional()
      .isBoolean()
      .withMessage('logo doit être un booléen.'),
    body('globalOverlays.*.font').optional().isString().isLength({ max: 40 }),
    body('music.filename').optional().isString().notEmpty(),
    body('music.volume').optional().isFloat({ min: 0, max: 1 }),
    body('voiceover.filename').optional().isString().notEmpty(),
    body('voiceover.volume').optional().isFloat({ min: 0, max: 2 }),
    body('voiceover.startTime').optional().isFloat({ min: 0 }),
    body('imageOverlays').optional().isArray(),
    body('imageOverlays.*.filename').optional().isString().notEmpty(),
    body('imageOverlays.*.scale').optional().isFloat({ min: 0.05, max: 1 }),
    body('imageOverlays.*.opacity').optional().isFloat({ min: 0, max: 1 }),
    body('imageOverlays.*.startTime').optional().isFloat({ min: 0 }),
    body('imageOverlays.*.duration').optional().isFloat({ min: 0.1 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { clips, jobId, globalOverlays, logo, music, voiceover, imageOverlays } = req.body;

      logger.info('Demande de concaténation reçue', { clipsCount: clips.length, jobId, globalCount: Array.isArray(globalOverlays) ? globalOverlays.length : 0, logo: !!logo, music: !!(music && music.filename), voiceover: !!(voiceover && voiceover.filename), images: Array.isArray(imageOverlays) ? imageOverlays.length : 0 });

      // Run async to prevent Render 100s timeout on HTTP request
      concatenateVideos(clips, jobId, { globalOverlays, logo: !!logo, music, voiceover, imageOverlays })
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
