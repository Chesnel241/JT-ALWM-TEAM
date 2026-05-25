/**
 * Route /api/deliveries — JT Prêt (montage final).
 *
 * L'équipe montage publie ici le rendu définitif d'une semaine.
 * Tous les correspondants y accèdent ensuite en téléchargement.
 *
 * Même cycle de vie que les rushes : purgé mercredi 00:00 de la
 * semaine suivante (via cleanupExpiredUploads — les deliveries sont
 * stockées sous `db[weekId]._delivery` donc nettoyées automatiquement
 * quand toute la semaine expire).
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { existsSync, unlinkSync } from 'fs';
import logger from '../logger/index.js';
import { recordUpload } from '../monitoring/metrics.js';
import { buildWeeks } from '../data/constants.js';
import { getDelivery, addDelivery, deleteDelivery } from '../data/store.js';
import { validateFile, validateMagicNumber } from '../middleware/fileValidator.js';
import { isValidUUID } from '../middleware/sanitizer.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { audit } from '../logger/audit.js';
import { deliveryUpload, uploadsDir, DELIVERY_MAX_FILE_SIZE } from '../lib/upload.js';
import { HAS_R2, uploadToR2, deleteFromR2 } from '../lib/s3.js';

const router = Router();

const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);

// GET /api/deliveries/:weekId — liste des montages publiés
router.get('/:weekId', (req, res, next) => {
  const { weekId } = req.params;
  if (!isValidWeek(weekId)) {
    return next(createErrors.notFound('Week'));
  }
  return res.json(getDelivery(weekId));
});

// POST /api/deliveries/:weekId — publication d'un nouveau montage
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

      const ext = path.extname(file.originalname).toLowerCase();
      const isVideo = ['.mp4', '.mov'].includes(ext);
      const isAudio = ['.mp3', '.wav'].includes(ext);

      const fileData = {
        id: uuidv4(),
        name: file.originalname,
        filename: file.filename,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'document',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        status: 'completed',
        uploadedAt: new Date().toISOString(),
      };

      try {
        if (HAS_R2) {
          const r2Key = `uploads/${file.filename}`;
          await uploadToR2(path.join(uploadsDir, file.filename), r2Key);
          try { if (existsSync(path.join(uploadsDir, file.filename))) unlinkSync(path.join(uploadsDir, file.filename)); } catch { /* ignore */ }
        }

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
        return res.status(201).json(result);
      } catch (storeErr) {
        recordUpload(Date.now() - startTime, false);
        const filePath = path.join(uploadsDir, file.filename);
        try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ignore */ }
        if (HAS_R2) {
          try { await deleteFromR2(`uploads/${file.filename}`); } catch { /* ignore */ }
        }
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

// DELETE /api/deliveries/:weekId/:fileId
router.delete('/:weekId/:fileId', requireAdmin, asyncHandler(async (req, res, next) => {
  const { weekId, fileId } = req.params;

  if (!isValidWeek(weekId)) return next(createErrors.notFound('Week'));
  if (!isValidUUID(fileId)) return next(createErrors.badRequest('fileId doit être un UUID valide'));

  const removed = deleteDelivery(weekId, fileId);
  if (!removed) return next(createErrors.notFound('Fichier'));

  if (removed.filename) {
    if (HAS_R2) {
      try { await deleteFromR2(`uploads/${removed.filename}`); }
      catch (err) {
        logger.warn(`Failed to delete delivery file from R2: ${removed.filename}`, {
          error: err.message, context: { weekId, fileId },
        });
      }
    } else {
      const filePath = path.join(uploadsDir, removed.filename);
      if (existsSync(filePath)) {
        try { unlinkSync(filePath); }
        catch (err) {
          logger.warn(`Failed to delete delivery file locally: ${removed.filename}`, {
            error: err.message, context: { weekId, fileId },
          });
        }
      }
    }
  }

  audit('delivery.delete', req, { weekId, fileId, filename: removed.filename });
  logger.info('Delivery deleted', { context: { weekId, fileId, filename: removed.filename } });
  return res.status(204).end();
}));

export default router;
