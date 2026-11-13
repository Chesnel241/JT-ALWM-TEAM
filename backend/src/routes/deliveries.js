import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { existsSync, unlinkSync } from 'fs';
import { link, copyFile, stat } from 'fs/promises';
import logger from '../logger/index.js';
import { recordUpload } from '../monitoring/metrics.js';
import { buildWeeks, isCountryAccepted, SPECIAL_BUCKETS } from '../data/constants.js';
import { getDelivery, addDelivery, deleteDelivery, getSujets, compterVueJT, getCustomCountries } from '../data/store.js';
import { validateFile, validateMagicNumber } from '../middleware/fileValidator.js';
import { classifyUpload } from '../lib/upload.js';
import { nomLisible } from '../middleware/sanitizer.js';
import { isValidUUID } from '../middleware/sanitizer.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { audit } from '../logger/audit.js';
import { deliveryUpload, uploadsDir, DELIVERY_MAX_FILE_SIZE } from '../lib/upload.js';
import { broadcastNotification, AUDIENCES } from './webpush.js';
import { getJobState } from '../services/editorProgress.js';
import { planifierVersionLegere, annulerVersionLegere } from '../services/versionLegere.js';
import { lireSommaireTexte, minutage } from '../lib/sommaire.js';
import { reportagesDiffuses } from '../services/suiviSujet.js';
import { nomLeger } from '../lib/leger.js';
import { io } from '../app.js';

const router = Router();

const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);

/** Les écrans « JT Prêt » ouverts se rafraîchissent (version légère prête…). */
const signaler = (weekId) => () => io?.emit('delivery_update', { weekId });

/**
 * Le message d'un pays dont un reportage passe dans ce JT : le sien, avec la
 * minute, plutôt que l'annonce générale.
 */
export function messageDiffusion(reportages, numeroSemaine) {
  const premier = reportages[0];
  const semaine = numeroSemaine ? ` de la semaine ${numeroSemaine}` : '';
  return reportages.length === 1
    ? `« ${premier.titre} » passe à ${minutage(premier.t)} dans le JT${semaine}.`
    : `Vos ${reportages.length} reportages sont dans le JT${semaine}, dès ${minutage(premier.t)}.`;
}

/**
 * Prévenir tout le monde que le JT est là. Deux envois : chaque équipe doit
 * atterrir sur SA page. Le lien unique vers la racine ouvrait le studio de
 * montage pour tout le monde, y compris pour les correspondants qui n'y ont
 * rien à faire.
 *
 * Un pays dont un reportage est au sommaire reçoit un message à lui (« votre
 * reportage passe à 4:12 »), qui ouvre le JT à cette minute ; il ne reçoit
 * pas en plus l'annonce générale.
 */
function annoncerJT(weekId, livraison = null) {
  const diffuses = livraison ? reportagesDiffuses(livraison, getSujets(weekId)) : new Map();
  const numero = /-w(\d{1,2})$/i.exec(String(weekId))?.[1];
  for (const [countryId, reportages] of diffuses) {
    reportages.sort((a, b) => a.t - b.t);
    broadcastNotification(
      {
        title: 'Votre reportage est dans le JT',
        body: messageDiffusion(reportages, numero ? Number(numero) : null),
        url: `/journalistes/telecharger-le-jt?jt=${encodeURIComponent(livraison.id)}&a=${Math.floor(reportages[0].t)}`,
      },
      { audiences: [AUDIENCES.REPORTER, AUDIENCES.UNKNOWN], countryId }
    ).catch(err => logger.error('Push notification failed', { error: err.message }));
  }
  const announce = `Le JT de la semaine ${weekId} est prêt et disponible au téléchargement.`;
  broadcastNotification(
    { title: '🚨 NOUVEAU JT PRÊT !', body: announce, url: '/journalistes/telecharger-le-jt' },
    { audiences: [AUDIENCES.REPORTER, AUDIENCES.UNKNOWN], saufPays: [...diffuses.keys()] }
  ).catch(err => logger.error('Push notification failed', { error: err.message }));
  broadcastNotification(
    { title: '🚨 NOUVEAU JT PRÊT !', body: announce, url: '/monteurs/jt-pret' },
    { audiences: [AUDIENCES.EDITOR] }
  ).catch(err => logger.error('Push notification failed', { error: err.message }));
}

/** « JT ALWM - Semaine 46 (2026).mp4 » plutôt qu'un identifiant de rendu. */
export function nomDuMaster(weekId) {
  const m = /^(\d{4})-w(\d{1,2})$/i.exec(String(weekId));
  return m ? `JT ALWM - Semaine ${Number(m[2])} (${m[1]}).mp4` : `JT ALWM ${weekId}.mp4`;
}

const EXPORT_PUBLIABLE = /^\/uploads\/exports\/(export_[A-Za-z0-9_-]{1,80}\.mp4)$/;

/** Le fichier du master rendu par ce job, s'il est encore là. */
function masterDuJob(url) {
  let chemin = '';
  try { chemin = new URL(String(url || ''), 'http://local').pathname; } catch { return null; }
  const m = EXPORT_PUBLIABLE.exec(chemin);
  return m ? m[1] : null;
}

router.get('/:weekId', (req, res, next) => {
  const { weekId } = req.params;
  if (!isValidWeek(weekId)) {
    return next(createErrors.notFound('Week'));
  }
  return res.json(getDelivery(weekId));
});

// Publier le JT : requireAdmin comme la suppression plus bas. C'est le
// fichier que tous les correspondants téléchargent (et qui déclenche la
// notification push "JT prêt") — laisser n'importe qui le remplacer
// revenait à laisser n'importe qui diffuser à toute l'équipe.
router.post('/:weekId', requireAdmin, asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  const { weekId } = req.params;

  if (!isValidWeek(weekId)) {
    logger.warn('Delivery upload attempt with invalid week', {
      context: { weekId, ip: req.ip },
    });
    return next(createErrors.notFound('Week'));
  }

  return deliveryUpload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        logger.error(`Delivery upload error: ${err.message}`, {
          error: err.message,
          context: { weekId, code: err.code, ip: req.ip },
        });
        if (err.code === 'LIMIT_FILE_SIZE') return next(createErrors.fileSizeError());
        if (err.code === 'ENOSPC') return next(createErrors.diskFullError());
        return next(createErrors.badRequest(err.message || 'Erreur upload'));
      }

      const file = req.file;
      if (!file) {
        return next(createErrors.badRequest('Aucun fichier reçu'));
      }

      let validation = validateFile(file, { maxSize: DELIVERY_MAX_FILE_SIZE });
      if (validation.valid) {
        const ext = path.extname(file.originalname).toLowerCase();
        validation = validateMagicNumber(path.join(uploadsDir, file.filename), ext);
      }
      if (!validation.valid) {
        const filePath = path.join(uploadsDir, file.filename);
        try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ignore */ }
        logger.warn(`Invalid delivery file rejected: ${validation.error}`, {
          context: { weekId, filename: file.originalname, error: validation.error, ip: req.ip },
        });
        return next(createErrors.fileTypeError());
      }

      // Le JT livré peut arriver en mkv, webm ou tout autre conteneur : la
      // liste fermée `.mp4`/`.mov` rangeait tout le reste en « document », et
      // l'écran de livraison n'offrait alors pas de lecteur.
      const famille = classifyUpload(file.originalname, file.mimetype);

      const fileData = {
        id: uuidv4(),
        name: nomLisible(file.originalname),
        filename: file.filename,
        type: famille === 'script' ? 'document' : famille,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        status: 'completed',
        uploadedAt: new Date().toISOString(),
        // Le sommaire joint par le monteur (celui du déroulé), nettoyé.
        sommaire: lireSommaireTexte(req.body?.sommaire),
      };

      try {
        const result = addDelivery(weekId, fileData);
        const durationMs = Date.now() - startTime;
        recordUpload(durationMs, true);
        audit('delivery.create', req, {
          weekId,
          fileId: fileData.id,
          filename: file.originalname,
          size: file.size,
        });
        logger.info('Delivery uploaded', {
          context: { weekId, fileId: fileData.id, filename: file.originalname, durationMs },
        });
        annoncerJT(weekId, result);
        planifierVersionLegere(weekId, result, { dossier: uploadsDir, signaler: signaler(weekId) });
        signaler(weekId)();

        return res.status(201).json(getDelivery(weekId).find((d) => d.id === result.id) || result);
      } catch (storeErr) {
        recordUpload(Date.now() - startTime, false);
        const filePath = path.join(uploadsDir, file.filename);
        try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ignore */ }
        logger.error(`Delivery store error: ${storeErr.message}`, {
          error: storeErr.message, context: { weekId },
        });
        return next(createErrors.internalError('Erreur lors de la sauvegarde'));
      }
    } catch (e) {
      next(e);
    }
  });
}));

// Publier le master tel que le studio vient de le rendre, sans le
// re-télécharger puis le renvoyer : plusieurs centaines de Mo d'aller-retour
// pour un fichier qui est déjà sur le serveur. Le chemin du master vient du
// suivi du rendu, jamais du navigateur.
router.post('/:weekId/depuis-export', requireAdmin, asyncHandler(async (req, res, next) => {
  const { weekId } = req.params;
  if (!isValidWeek(weekId)) return next(createErrors.notFound('Week'));
  const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
  const job = jobId && jobId.length <= 120 ? getJobState(jobId) : null;
  if (!job || job.status !== 'done') {
    return res.status(404).json({ code: 'MASTER_INCONNU', message: 'Ce rendu n’est plus suivi par le serveur. Téléchargez le master puis déposez-le dans « Livraison ».' });
  }
  if (job.weekId && job.weekId !== weekId) {
    return res.status(400).json({ code: 'AUTRE_SEMAINE', message: 'Ce master appartient à une autre semaine.' });
  }
  const source = masterDuJob(job.url);
  const cheminSource = source ? path.join(uploadsDir, 'exports', source) : null;
  if (!cheminSource || !existsSync(cheminSource)) {
    return res.status(410).json({ code: 'MASTER_ABSENT', message: 'Le master n’est plus sur le serveur. Relancez la génération, ou déposez le fichier dans « Livraison ».' });
  }
  if (getDelivery(weekId).some((d) => d.jobId === jobId)) {
    return res.status(409).json({ code: 'DEJA_PUBLIE', message: 'Ce master est déjà publié dans « JT Prêt ».' });
  }

  // Un lien plutôt qu'une copie : même fichier, aucune place prise. Le master
  // des exports s'efface au bout de 48 h ; la livraison, elle, reste.
  const filename = `${uuidv4()}.mp4`;
  const cible = path.join(uploadsDir, filename);
  try {
    await link(cheminSource, cible);
  } catch {
    await copyFile(cheminSource, cible);
  }
  const { size } = await stat(cible);
  const fileData = {
    id: uuidv4(),
    name: nomDuMaster(weekId),
    filename,
    type: 'video',
    size: `${(size / (1024 * 1024)).toFixed(1)} MB`,
    status: 'completed',
    uploadedAt: new Date().toISOString(),
    jobId,
    sommaire: Array.isArray(job.sommaire) ? job.sommaire : [],
  };
  try {
    addDelivery(weekId, fileData);
  } catch (err) {
    try { unlinkSync(cible); } catch { /* ignore */ }
    logger.error(`Delivery store error: ${err.message}`, { error: err.message, context: { weekId } });
    return next(createErrors.internalError('Erreur lors de la sauvegarde'));
  }
  audit('delivery.create', req, { weekId, fileId: fileData.id, source: 'studio', size });
  logger.info('Delivery published from studio export', { context: { weekId, fileId: fileData.id } });
  annoncerJT(weekId, fileData);
  planifierVersionLegere(weekId, fileData, { dossier: uploadsDir, signaler: signaler(weekId) });
  signaler(weekId)();
  return res.status(201).json(getDelivery(weekId).find((d) => d.id === fileData.id) || fileData);
}));

// POST /api/deliveries/:weekId/:fileId/vue — un accusé de lecture du JT.
// Anonyme : seul le pays est compté, et chaque appareil ne l'envoie qu'une
// fois par JT (le navigateur s'en souvient). Le pays vient du lien personnel
// quand il y en a un, sinon de l'appareil.
router.post('/:weekId/:fileId/vue', asyncHandler(async (req, res, next) => {
  const { weekId, fileId } = req.params;
  if (!isValidWeek(weekId)) return next(createErrors.notFound('Week'));
  if (!isValidUUID(fileId)) return next(createErrors.badRequest('fileId doit être un UUID valide'));
  const type = req.body?.type === 'telechargement' ? 'telechargement' : 'lecture';
  const declare = String(req.correspondant?.pays || req.body?.countryId || '').trim().toLowerCase();
  const countryId = isCountryAccepted(declare, getCustomCountries()) && !SPECIAL_BUCKETS.has(declare) ? declare : 'inconnu';
  const compte = compterVueJT(weekId, fileId, countryId, type);
  if (!compte) return next(createErrors.notFound('Fichier'));
  return res.status(204).end();
}));

router.delete('/:weekId/:fileId', requireAdmin, asyncHandler(async (req, res, next) => {
  const { weekId, fileId } = req.params;

  if (!isValidWeek(weekId)) return next(createErrors.notFound('Week'));
  if (!isValidUUID(fileId)) return next(createErrors.badRequest('fileId doit être un UUID valide'));

  const deliveryFile = getDelivery(weekId).find(d => d.id === fileId);
  if (!deliveryFile) return next(createErrors.notFound('Fichier'));

  if (deliveryFile.filename) {
    const filePath = path.join(uploadsDir, deliveryFile.filename);
    if (existsSync(filePath)) {
      try { unlinkSync(filePath); }
      catch (err) {
        logger.warn(`Failed to delete delivery file locally: ${deliveryFile.filename}`, {
          error: err.message, context: { weekId, fileId },
        });
      }
    }
  }

  // Sa version légère part avec lui, même en cours de fabrication.
  annulerVersionLegere(fileId);
  if (deliveryFile.filename) {
    const leger = nomLeger(deliveryFile.filename);
    for (const nom of [leger, `${leger}.tmp`]) {
      try { const p = path.join(uploadsDir, nom); if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ }
    }
  }

  const removed = deleteDelivery(weekId, fileId);
  if (!removed) return next(createErrors.notFound('Fichier (déjà supprimé)'));

  audit('delivery.delete', req, { weekId, fileId, filename: removed.filename });
  signaler(weekId)();
  logger.info('Delivery deleted', { context: { weekId, fileId, filename: removed.filename } });
  return res.status(204).end();
}));

export default router;
