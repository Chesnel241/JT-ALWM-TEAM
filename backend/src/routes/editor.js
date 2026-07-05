import express from 'express';
import { body, validationResult } from 'express-validator';
import { concatenateVideos, XFADE_TRANSITIONS } from '../services/editorService.js';
import { addListener, removeListener, finishJob, getJobState } from '../services/editorProgress.js';
import { TEXT_ANIMATIONS_IDS, OVERLAY_TEMPLATES } from '../data/overlayTemplates.js';

// Allowlist des templateId valides (source unique = registre des modèles).
const TEMPLATE_IDS = OVERLAY_TEMPLATES.map((t) => t.id);
import logger from '../logger/index.js';

const router = express.Router();

// GET /api/editor/progress/:jobId — flux SSE de progression du montage.
// EventSource ne peut pas poser de header → auth via ?pwd= (supporté
// par requireAuth). Le client ouvre ce flux avant de lancer /concat.
router.get('/progress/:jobId', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
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
      .optional({ values: 'null' })
      .isFloat({ min: 0 })
      .withMessage('inPoint doit être un nombre positif (en secondes).'),
    body('clips.*.outPoint')
      .optional({ values: 'null' })
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
      .optional({ values: 'null' })
      .isArray()
      .withMessage('overlays doit être un tableau.'),
    body('clips.*.overlays.*.startTime')
      .optional({ values: 'null' })
      .isFloat({ min: 0 })
      .withMessage('startTime doit être positif.'),
    body('clips.*.overlays.*.duration')
      .optional({ values: 'null' })
      .isFloat({ min: 0.1 })
      .withMessage('duration doit être supérieur à 0.'),
    body('clips.*.overlays.*.templateId')
      .optional({ values: 'null' })
      .isIn(TEMPLATE_IDS)
      .withMessage('templateId invalide.'),
    // Champs d'un overlay (texte libre gravé via safe(), ou valeurs num.
    // comme ticker.speed). Si chaîne : bornée à 600 (défense en profondeur ;
    // safe() reste le vrai garde-fou anti-injection). Nombres/booléens OK.
    body('clips.*.overlays.*.fields.*')
      .optional({ values: 'null' })
      .custom((v) => typeof v !== 'string' || v.length <= 600)
      .withMessage('Champ texte overlay trop long (max 600).'),
    body('clips.*.overlays.*.animation')
      .optional({ values: 'null' })
      .isIn(TEXT_ANIMATIONS_IDS)
      .withMessage('animation invalide.'),
    body('clips.*.overlays.*.outline').optional({ values: 'null' }).isFloat({ min: 0, max: 6 }),
    body('clips.*.overlays.*.glow').optional({ values: 'null' }).isFloat({ min: 0, max: 10 }),
    body('clips.*.overlays.*.scale').optional({ values: 'null' }).isFloat({ min: 10, max: 300 }),
    body('clips.*.overlays.*.fontSize').optional({ values: 'null' }).isFloat({ min: 10, max: 500 }),
    body('clips.*.overlays.*.lineHeight').optional({ values: 'null' }).isFloat({ min: 10, max: 500 }),
    body('clips.*.overlays.*.colors.text').optional({ values: 'null' }).matches(/^#[0-9a-fA-F]{6}$/),
    body('clips.*.overlays.*.colors.bg').optional({ values: 'null' }).matches(/^#[0-9a-fA-F]{6}$/),
    body('clips.*.overlays.*.colors.accent').optional({ values: 'null' }).matches(/^#[0-9a-fA-F]{6}$/),
    body('clips.*.overlays.*.position.x').optional({ values: 'null' }).isFloat({ min: -1920, max: 3840 }),
    body('clips.*.overlays.*.position.y').optional({ values: 'null' }).isFloat({ min: -1080, max: 2160 }),
    // Champs posX/posY/scale/animationLoop/animationOut envoyés par l'UI
    // (sliders/drag). Sans règle, isFloat sur d'autres clés ne strippe pas
    // mais une valeur aberrante (NaN, string) corromprait le rendu. Bornes
    // larges pour autoriser le drag hors-cadre et le zoom.
    body('clips.*.overlays.*.posX').optional({ values: 'null' }).isFloat({ min: -1920, max: 1920 }),
    body('clips.*.overlays.*.posY').optional({ values: 'null' }).isFloat({ min: -1080, max: 1080 }),
    body('clips.*.overlays.*.animationLoop').optional({ values: 'null' }).isString().isLength({ max: 40 }),
    body('clips.*.overlays.*.animationOut').optional({ values: 'null' }).isString().isLength({ max: 40 }),
    body('clips.*.subtitles').optional({ values: 'null' }).isArray(),
    body('clips.*.subtitles.*.text').optional({ values: 'null' }).isString().isLength({ max: 300 }),
    body('clips.*.subtitles.*.start').optional({ values: 'null' }).isFloat({ min: 0 }),
    body('clips.*.subtitles.*.end').optional({ values: 'null' }).isFloat({ min: 0 }),
    body('clips.*.subtitleStyle.position').optional({ values: 'null' }).isIn(['bottom', 'top']),
    body('clips.*.subtitleStyle.size').optional({ values: 'null' }).isIn(['S', 'M', 'L']),
    body('clips.*.subtitleStyle.font').optional({ values: 'null' }).isString().isLength({ max: 40 }),
    body('clips.*.overlays.*.font')
      .optional({ values: 'null' })
      .isString().isLength({ max: 40 })
      .withMessage('font invalide.'),
    body('clips.*.transition.type')
      .optional({ values: 'null' })
      .isIn([...XFADE_TRANSITIONS])
      .withMessage('Type de transition invalide.'),
    body('clips.*.transition.duration')
      .optional({ values: 'null' })
      .isFloat({ min: 0.2, max: 2 })
      .withMessage('Durée de transition entre 0.2 et 2 s.'),
    body('clips.*.kenBurns.mode')
      .optional({ values: 'null' })
      .isIn(['in', 'out'])
      .withMessage('Mode Ken Burns invalide.'),
    body('clips.*.durationSec').optional({ values: 'null' }).isFloat({ min: 0.1, max: 36000 }),
    body('globalOverlays')
      .optional({ values: 'null' })
      .isArray()
      .withMessage('globalOverlays doit être un tableau.'),
    body('globalOverlays.*.templateId')
      .optional({ values: 'null' })
      .isIn([...TEMPLATE_IDS, 'ticker', 'live_badge'])
      .withMessage('templateId global invalide.'),
    body('globalOverlays.*.fields.*')
      .optional({ values: 'null' })
      .custom((v) => typeof v !== 'string' || v.length <= 600)
      .withMessage('Champ texte global trop long (max 600).'),
    body('logo')
      .optional({ values: 'null' })
      .isBoolean()
      .withMessage('logo doit être un booléen.'),
    body('logoPosition').optional({ values: 'null' }).isIn(['tl', 'tr', 'bl', 'br', 'center']),
    body('globalOverlays.*.font').optional({ values: 'null' }).isString().isLength({ max: 40 }),
    body('globalOverlays.*.fontSize').optional({ values: 'null' }).isFloat({ min: 10, max: 500 }),
    body('globalOverlays.*.lineHeight').optional({ values: 'null' }).isFloat({ min: 10, max: 500 }),
    // Personnalisation overlays globaux (idem clip.overlays) — sans ça les
    // sliders posX/posY/scale et les color-pickers seraient ignorés sur
    // les overlays globaux (ticker, live_badge, overlays timeline globale).
    body('globalOverlays.*.scale').optional({ values: 'null' }).isFloat({ min: 10, max: 500 }),
    body('globalOverlays.*.posX').optional({ values: 'null' }).isFloat({ min: -1920, max: 1920 }),
    body('globalOverlays.*.posY').optional({ values: 'null' }).isFloat({ min: -1080, max: 1080 }),
    body('globalOverlays.*.startTime').optional({ values: 'null' }).isFloat({ min: 0, max: 36000 }),
    body('globalOverlays.*.duration').optional({ values: 'null' }).isFloat({ min: 0.1, max: 36000 }),
    body('globalOverlays.*.animation').optional({ values: 'null' }).isIn(TEXT_ANIMATIONS_IDS),
    body('globalOverlays.*.animationLoop').optional({ values: 'null' }).isString().isLength({ max: 40 }),
    body('globalOverlays.*.animationOut').optional({ values: 'null' }).isString().isLength({ max: 40 }),
    body('globalOverlays.*.colors.text').optional({ values: 'null' }).matches(/^#[0-9a-fA-F]{6}$/),
    body('globalOverlays.*.colors.bg').optional({ values: 'null' }).matches(/^#[0-9a-fA-F]{6}$/),
    body('globalOverlays.*.colors.accent').optional({ values: 'null' }).matches(/^#[0-9a-fA-F]{6}$/),
    body('globalOverlays.*.outline').optional({ values: 'null' }).isFloat({ min: 0, max: 6 }),
    body('globalOverlays.*.glow').optional({ values: 'null' }).isFloat({ min: 0, max: 10 }),
    body('music.filename').optional({ values: 'null' }).isString().notEmpty(),
    body('music.volume').optional({ values: 'null' }).isFloat({ min: 0, max: 1 }),
    body('voiceover.filename').optional({ values: 'null' }).isString().notEmpty(),
    body('voiceover.volume').optional({ values: 'null' }).isFloat({ min: 0, max: 2 }),
    body('voiceover.startTime').optional({ values: 'null' }).isFloat({ min: 0 }),
    body('imageOverlays').optional({ values: 'null' }).isArray(),
    body('imageOverlays.*.filename').optional({ values: 'null' }).isString().notEmpty(),
    body('imageOverlays.*.scale').optional({ values: 'null' }).isFloat({ min: 0.05, max: 1 }),
    body('imageOverlays.*.opacity').optional({ values: 'null' }).isFloat({ min: 0, max: 1 }),
    body('imageOverlays.*.startTime').optional({ values: 'null' }).isFloat({ min: 0 }),
    body('imageOverlays.*.duration').optional({ values: 'null' }).isFloat({ min: 0.1 }),
    body('atmosphere.vignette').optional({ values: 'null' }).isFloat({ min: 0, max: 1 }),
    body('atmosphere.grain').optional({ values: 'null' }).isFloat({ min: 0, max: 1 }),
    body('atmosphere.sweep').optional({ values: 'null' }).isFloat({ min: 0, max: 1 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { clips, jobId, globalOverlays, logo, logoPosition, music, voiceover, imageOverlays, atmosphere } = req.body;

      logger.info('Demande de concaténation reçue', { clipsCount: clips.length, jobId, globalCount: Array.isArray(globalOverlays) ? globalOverlays.length : 0, logo: !!logo, music: !!(music && music.filename), voiceover: !!(voiceover && voiceover.filename), images: Array.isArray(imageOverlays) ? imageOverlays.length : 0 });

      // Run async to prevent Render 100s timeout on HTTP request
      concatenateVideos(clips, jobId, { globalOverlays, logo: !!logo, logoPosition, music, voiceover, imageOverlays, atmosphere })
        .then((result) => {
          // Chemin Remotion : le worker pilote la fin via /internal/progress.
          if (result && result.delegated) return;
          finishJob(jobId, 'done', result.url);
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
