import { Router } from 'express';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { createReadStream, existsSync, unlinkSync, writeFileSync } from 'fs';
import logger from '../logger/index.js';
import { recordUpload } from '../monitoring/metrics.js';
import { COUNTRIES, buildWeeks, weekUploadCutoff } from '../data/constants.js';
import { getCustomCountries } from '../data/store.js';
import { getWeekUploads, getCountryUploads, addUpload, deleteUpload, updateFileStatus } from '../data/store.js';
import { body, validationResult } from 'express-validator';
import { validateFile, validateMagicNumber } from '../middleware/fileValidator.js';
import { sanitizeFilename, isValidUUID, validateUUIDParam } from '../middleware/sanitizer.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { archiveLimiter } from '../middleware/rateLimiter.js';
import { audit } from '../logger/audit.js';
import { fileUpload as upload, uploadsDir } from '../lib/upload.js';
import { HAS_R2, uploadToR2, uploadBufferToR2, getR2ReadStream, deleteFromR2, checkR2Exists } from '../lib/s3.js';
import { Readable } from 'stream';

function createLazyStream(factory) {
  let stream = null;
  let initiating = false;

  return new Readable({
    async read(size) {
      if (stream) return stream.resume();
      if (initiating) return;
      
      initiating = true;
      try {
        stream = await factory();
        stream.on('data', chunk => {
          if (!this.push(chunk)) stream.pause();
        });
        stream.on('end', () => this.push(null));
        stream.on('error', err => this.destroy(err));
      } catch (err) {
        this.destroy(err);
      }
    }
  });
}

const router = Router();

// La validation se fait contre la liste recalculée à chaque appel —
// indispensable car la fenêtre visible glisse chaque jour à minuit.
const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);
const isValidCountry = (countryId) =>
  COUNTRIES.some((c) => c.id === countryId) ||
  getCustomCountries().some((c) => c.id === countryId);

// Renvoie une erreur 423 (Locked) si la date limite d'envoi (dimanche
// 17h30) est dépassée pour cette semaine.
function checkUploadCutoff(weekId) {
  const cutoff = weekUploadCutoff(weekId);
  if (!cutoff) return null;
  if (new Date() > cutoff) {
    const err = new Error('Date limite d\'envoi dépassée (dimanche 17h30)');
    err.statusCode = 423;
    err.code = 'UPLOAD_DEADLINE_PASSED';
    err.publicMessage = 'Délai dépassé : les uploads pour cette semaine sont clôturés depuis dimanche 17h30.';
    return err;
  }
  return null;
}

// GET /api/uploads/:weekId — tous les pays d'une semaine
router.get('/:weekId', (req, res) => {
  if (!isValidWeek(req.params.weekId)) {
    return res.status(404).json({ 
      code: 'INVALID_WEEK',
      message: 'Semaine introuvable',
      details: { weekId: req.params.weekId }
    });
  }
  return res.json(getWeekUploads(req.params.weekId));
});

// GET /api/uploads/:weekId/:countryId — fichiers d'un pays
router.get('/:weekId/:countryId', (req, res) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return res.status(404).json({ 
      code: 'NOT_FOUND',
      message: 'Ressource introuvable',
      details: { weekId, countryId }
    });
  }
  return res.json(getCountryUploads(weekId, countryId));
});

// GET /api/uploads/:weekId/:countryId/archive — zip des fichiers d'un pays
router.get('/:weekId/:countryId/archive', archiveLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    logger.warn('Archive request with invalid week or country', {
      context: { weekId, countryId, ip: req.ip },
    });
    return next(createErrors.notFound('Week ou Country'));
  }

  // Sécurisation spécifique pour MOT DU JT
  if (countryId === 'mj') {
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const providedToken = req.query.adminPassword || req.header('x-admin-password');
    if (ADMIN_PASSWORD && providedToken !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: 'Accès protégé : mot de passe administrateur requis pour cette rubrique.' });
    }
  }

  const uploads = getCountryUploads(weekId, countryId);
  // Si R2 est actif, on assume que le fichier existe dans le cloud (ou on tentera de l'attraper).
  // Sinon, on vérifie l'existence locale.
  const files = uploads.filter((u) => u.filename && (HAS_R2 || existsSync(path.join(uploadsDir, u.filename))));
  
  if (files.length === 0) {
    logger.warn('Archive request with no files', {
      context: { weekId, countryId, totalUploads: uploads.length, ip: req.ip },
    });
    return next(createErrors.notFound('Aucun fichier à archiver'));
  }

  const zipName = `uploads_${weekId}_${countryId}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { 
    zlib: { level: 0 },
  });

  archive.on('error', (err) => {
    logger.error(`Archive creation error: ${err.message}`, {
      error: err.message,
      context: { 
        weekId, 
        countryId, 
        filesCount: files.length,
        code: err.code,
      },
    });
    
    if (res.headersSent) {
      return res.end();
    }

    // NB: `res.json(createErrors.X())` serait buggé — un AppError
    // (Error class) sérialise en `{}` faute de propriétés enumerable.
    // On construit explicitement le body JSON ici.
    if (err.code === 'ENOSPC') {
      const e = createErrors.diskFullError();
      res.status(507).json({ code: e.code, message: e.publicMessage });
    } else {
      res.status(500).json({
        code: 'ARCHIVE_FAILED',
        message: 'Échec de la création de l\'archive',
      });
    }
  });

  archive.on('end', () => {
    logger.info(`Archive created successfully: ${zipName}`, {
      context: { 
        weekId, 
        countryId, 
        filesCount: files.length,
        archivedSize: archive.pointer(),
        compressionRatio: (archive.pointer() / files.reduce((s, f) => s + (f.size ? parseInt(f.size) * 1024 * 1024 : 0), 0)).toFixed(2),
      },
    });
  });

  archive.pipe(res);
  
  // Append streams lazily without eagerly opening S3 connections
  for (const file of files) {
    // Protection contre le Zip Slip (Path Traversal)
    const safeName = path.basename(file.name);
    const safeReportage = file.reportage ? file.reportage.replace(/[/\\]/g, '') : null;
    const archivePath = safeReportage ? `${safeReportage}/${safeName}` : safeName;
    if (HAS_R2) {
      const exists = await checkR2Exists(`uploads/${file.filename}`);
      if (!exists) {
        logger.warn(`Skipping missing R2 file in ZIP: ${file.filename}`);
        continue;
      }
      const lazyStream = createLazyStream(() => getR2ReadStream(`uploads/${file.filename}`));
      archive.append(lazyStream, { name: archivePath });
      logger.debug(`Added lazy R2 stream to archive: ${file.name}`, {
        context: { filename: file.filename, size: file.size },
      });
    } else {
      const filePath = path.join(uploadsDir, file.filename);
      if (!existsSync(filePath)) {
        logger.warn(`Skipping missing local file in ZIP: ${file.filename}`);
        continue;
      }
      archive.append(createReadStream(filePath), { name: archivePath });
      logger.debug(`Added local to archive: ${file.name}`, {
        context: { filename: file.filename, size: file.size },
      });
    }
  }
  archive.finalize();
}));

// POST /api/uploads/:weekId/:countryId — upload fichier
router.post('/:weekId/:countryId', asyncHandler(async (req, res, next) => {
  const uploadStartTime = Date.now();
  const { weekId, countryId } = req.params;
  
  // Valider les paramètres de semaine et pays
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    logger.warn('Upload attempt with invalid week or country', {
      context: { weekId, countryId, ip: req.ip },
    });
    return next(createErrors.notFound('Week ou Country'));
  }

  // Bloque les rushes après dimanche 17h30
  const cutoffErr = checkUploadCutoff(weekId);
  if (cutoffErr) {
    audit('upload.blocked_after_deadline', req, { weekId, countryId });
    logger.info('Upload blocked: deadline passed', { context: { weekId, countryId, ip: req.ip } });
    return next(cutoffErr);
  }

  return upload.single('file')(req, res, async (err) => {
    if (err) {
      logger.error(`Upload error: ${err.message}`, {
        error: err.message,
        context: { weekId, countryId, code: err.code, ip: req.ip },
      });

      // Gestion des erreurs multer
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(createErrors.fileSizeError());
      }
      if (err.code === 'ENOSPC') {
        return next(createErrors.diskFullError());
      }
      return next(createErrors.badRequest(err.message || 'Erreur upload'));
    }

    const file = req.file;
    if (!file) {
      logger.warn('Upload attempt without file', {
        context: { weekId, countryId, ip: req.ip },
      });
      return next(createErrors.badRequest('Aucun fichier reçu'));
    }

    // Valider le fichier avec fileValidator (extension + MIME + nom)
    let validation = validateFile(file);
    // Puis valider le magic number (contenu réel) sur le fichier écrit
    if (validation.valid) {
      const ext = path.extname(file.originalname).toLowerCase();
      const filePath = path.join(uploadsDir, file.filename);
      validation = validateMagicNumber(filePath, ext);
    }
    if (!validation.valid) {
      // ROLLBACK: Supprimer le fichier uploadé en cas de validation échouée
      const filePath = path.join(uploadsDir, file.filename);
      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
          logger.info(`Upload rolled back - invalid file deleted: ${file.filename}`, {
            context: { reason: validation.error, fileId: file.filename },
          });
        }
      } catch (delErr) {
        logger.error(`Failed to rollback invalid file: ${file.filename}`, {
          error: delErr.message,
          context: { fileId: file.filename },
        });
      }

      logger.warn(`Invalid file upload rejected: ${validation.error}`, {
        context: {
          weekId,
          countryId,
          filename: file.originalname,
          error: validation.error,
          ip: req.ip,
        },
      });
      return next(createErrors.fileTypeError(validation.error));
    }

    const isScript = ['.txt', '.docx'].includes(path.extname(file.originalname).toLowerCase());
    const reportage = req.query.reportage || null;

    const fileData = {
      id: uuidv4(),
      name: file.originalname,
      filename: file.filename,
      type: isScript ? 'script' : 'video',
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      status: 'completed',
      reportage,
      uploadedAt: new Date().toISOString(),
    };

    try {
      // Ajouter à la DB
      const result = addUpload(weekId, countryId, fileData);
      const uploadDurationMs = Date.now() - uploadStartTime;
      recordUpload(uploadDurationMs, true); // Record successful upload
      logger.uploadReceived(weekId, countryId, file.originalname, fileData.size);
      audit('upload.create', req, {
        weekId, countryId,
        fileId: fileData.id,
        filename: file.originalname,
        size: file.size,
      });

      // --- NOUVEAU: Upload vers R2 ---
      if (HAS_R2) {
        try {
          const filePath = path.join(uploadsDir, file.filename);
          logger.info(`Starting R2 upload for ${file.filename}`);
          await uploadToR2(filePath, `uploads/${file.filename}`, file.mimetype);
          logger.info(`R2 upload complete for ${file.filename}, deleting local temporary file`);
          // Supprimer le fichier local après succès
          unlinkSync(filePath);
        } catch (r2Err) {
          logger.error(`R2 upload failed for ${file.filename}`, { error: r2Err.message });
          // Rollback: on annule l'upload DB car le fichier n'est pas dans le Cloud
          deleteUpload(weekId, countryId, fileData.id);
          const filePath = path.join(uploadsDir, file.filename);
          if (existsSync(filePath)) unlinkSync(filePath);
          return next(createErrors.internalError('Erreur lors du transfert vers Cloudflare R2'));
        }
      }
      // ---------------------------------
      
      logger.info('Upload completed and persisted', {
        context: {
          weekId,
          countryId,
          filename: file.originalname,
          fileId: fileData.id,
          type: fileData.type,
          size: fileData.size,
          durationMs: uploadDurationMs,
        },
      });
      
      return res.status(201).json(result);
    } catch (storeErr) {
      const uploadDurationMs = Date.now() - uploadStartTime;
      recordUpload(uploadDurationMs, false); // Record failed upload
      // ROLLBACK: En cas d'erreur DB, supprimer le fichier uploadé
      const filePath = path.join(uploadsDir, file.filename);
      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
          logger.info(`Upload rolled back - file deleted due to DB error: ${file.filename}`, {
            context: { dbError: storeErr.message, fileId: file.filename },
          });
        }
      } catch (delErr) {
        logger.error(`Failed to rollback file after DB error: ${file.filename}`, {
          error: delErr.message,
          context: { dbError: storeErr.message, fileId: file.filename },
        });
      }

      logger.uploadFailed(weekId, countryId, file.originalname, storeErr);
      return next(createErrors.internalError('Erreur lors de la sauvegarde des métadonnées'));
    }
  });
}));

// POST /api/uploads/:weekId/:countryId/script — saisie manuelle de script
router.post('/:weekId/:countryId/script', asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  const { content, reportage } = req.body;

  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    logger.warn('Script upload attempt with invalid week or country', {
      context: { weekId, countryId, ip: req.ip },
    });
    return next(createErrors.notFound('Week ou Country'));
  }

  const cutoffErr = checkUploadCutoff(weekId);
  if (cutoffErr) {
    audit('upload.blocked_after_deadline', req, { weekId, countryId, kind: 'script' });
    return next(cutoffErr);
  }

  if (!content?.trim()) {
    logger.warn('Script upload with empty content', {
      context: { weekId, countryId, ip: req.ip },
    });
    return next(createErrors.badRequest('Contenu vide'));
  }

  const filename = `${uuidv4()}.txt`;
  const filePath = path.join(uploadsDir, filename);

  try {
    if (HAS_R2) {
      await uploadBufferToR2(content, `uploads/${filename}`, 'text/plain; charset=utf-8');
    } else {
      writeFileSync(filePath, content, 'utf-8');
    }
  } catch (err) {
    logger.error(`Failed to write script file: ${filename}`, {
      error: err.message,
      context: { weekId, countryId, code: err.code },
    });
    
    if (err.code === 'ENOSPC') {
      return next(createErrors.diskFullError());
    }
    return next(createErrors.internalError('Failed to save script'));
  }

  const fileData = {
    id: uuidv4(),
    name: `Script_${Date.now()}.txt`,
    type: 'script',
    size: `${Buffer.byteLength(content, 'utf-8')} octets`,
    status: 'completed',
    content,
    filename,
    reportage: reportage || null,
    uploadedAt: new Date().toISOString(),
  };

  try {
    const result = addUpload(weekId, countryId, fileData);
    logger.info('Script uploaded successfully', {
      context: {
        weekId,
        countryId,
        fileId: fileData.id,
        size: fileData.size,
        contentLength: content.length,
      },
    });
    return res.status(201).json(result);
  } catch (storeErr) {
    // ROLLBACK: Supprimer le fichier en cas d'erreur DB
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        logger.info(`Script rolled back - file deleted: ${filename}`, {
          context: { dbError: storeErr.message },
        });
      }
    } catch (delErr) {
      logger.error(`Failed to rollback script file: ${filename}`, {
        error: delErr.message,
        context: { dbError: storeErr.message },
      });
    }

    logger.error(`Script upload failed: ${storeErr.message}`, {
      error: storeErr.message,
      context: { weekId, countryId },
    });
    return next(createErrors.internalError('Erreur lors de la sauvegarde du script'));
  }
}));

// DELETE /api/uploads/:weekId/:countryId/:fileId
router.delete('/:weekId/:countryId/:fileId', requireAdmin, asyncHandler(async (req, res, next) => {
  const { weekId, countryId, fileId } = req.params;
  
  // Valider les paramètres
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    logger.warn('Delete attempt with invalid week or country', {
      context: { weekId, countryId, fileId, ip: req.ip },
    });
    return next(createErrors.notFound('Week ou Country'));
  }

  if (!isValidUUID(fileId)) {
    logger.warn('Delete attempt with invalid fileId format', {
      context: { weekId, countryId, fileId, ip: req.ip },
    });
    return next(createErrors.badRequest('fileId doit être un UUID valide'));
  }

  try {
    const deleted = deleteUpload(weekId, countryId, fileId);
    
    if (!deleted) {
      logger.info('Delete attempt for non-existent file', {
        context: { weekId, countryId, fileId, ip: req.ip },
      });
      return next(createErrors.notFound('Fichier'));
    }

    // Supprimer le fichier physique si présent
    if (deleted.filename) {
      if (HAS_R2) {
        try {
          await deleteFromR2(`uploads/${deleted.filename}`);
        } catch (delErr) {
          logger.warn(`Failed to delete R2 file: ${deleted.filename}, rolling back DB deletion`, {
            error: delErr.message,
            context: { weekId, countryId, fileId },
          });
          // Rollback: Re-insert into DB
          addUpload(weekId, countryId, deleted);
          return next(createErrors.internalError('Erreur de suppression du fichier distant'));
        }
      } else {
        const filePath = path.join(uploadsDir, deleted.filename);
        if (existsSync(filePath)) {
          try {
            unlinkSync(filePath);
            logger.info('File deleted successfully', {
              context: { 
                weekId, 
                countryId, 
                filename: deleted.filename, 
                fileId,
                deletedSize: deleted.size,
              },
            });
          } catch (delErr) {
            // Log mais ne pas échouer la requête si le fichier ne peut pas être supprimé
            logger.warn(`Failed to delete physical file: ${deleted.filename}`, {
              error: delErr.message,
              context: { weekId, countryId, fileId },
            });
          }
        }
      }
    }

    logger.info('Upload deleted from database', {
      context: {
        weekId,
        countryId,
        fileId,
        filename: deleted.filename,
        deletedAt: new Date().toISOString(),
      },
    });
    audit('upload.delete', req, {
      weekId, countryId, fileId,
      filename: deleted.filename,
    });

    return res.status(204).end();
  } catch (error) {
    logger.error(`Delete operation failed: ${error.message}`, {
      error: error.message,
      context: { weekId, countryId, fileId, ip: req.ip },
    });
    return next(createErrors.internalError('Erreur lors de la suppression'));
  }
}));

// PATCH /api/uploads/:weekId/files/:fileId/status
router.patch('/:weekId/files/:fileId/status', requireAdmin, [
  body('status').isIn(['pending', 'approved', 'rejected']).withMessage('Status must be one of: pending, approved, rejected'),
  body('feedback').optional().isString().withMessage('Feedback must be a string')
], asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', errors: errors.array() });
  }

  const { weekId, fileId } = req.params;
  const { status, feedback } = req.body;

  if (!isValidWeek(weekId)) {
    return next(createErrors.notFound('Week'));
  }
  if (!isValidUUID(fileId)) {
    return next(createErrors.badRequest('fileId doit être un UUID valide'));
  }

  const updatedFile = updateFileStatus(weekId, fileId, status, feedback);
  if (!updatedFile) {
    return next(createErrors.notFound('Fichier'));
  }

  return res.json(updatedFile);
}));

export default router;
