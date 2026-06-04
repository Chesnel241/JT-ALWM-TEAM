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
import { requireAdmin, safeEqual } from '../middleware/auth.js';
import { archiveLimiter } from '../middleware/rateLimiter.js';
import { audit } from '../logger/audit.js';
import { fileUpload as upload, uploadsDir } from '../lib/upload.js';

import { Readable } from 'stream';
import { processVoiceover } from '../services/audioProcessor.js';
import { broadcastNotification } from './webpush.js';
import { io } from '../app.js';


const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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

  // Sécurisation retirée à la demande de l'utilisateur : le téléchargement est public

  const uploads = getCountryUploads(weekId, countryId);
  // On assume que le fichier existe dans le volume local.
  // Sinon, on vérifie l'existence locale.
  const files = uploads.filter((u) => u.filename && existsSync(path.join(uploadsDir, u.filename)));
  
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
  archive.finalize();
}));

const uploadMiddleware = (req, res, next) => {
  const { weekId, countryId } = req.params;
  const providedToken = req.query.adminPassword || req.header('x-admin-password');
  const isAdmin = safeEqual(providedToken, ADMIN_PASSWORD);

  if (!isAdmin) {
    const cutoffErr = checkUploadCutoff(weekId);
    if (cutoffErr) {
      audit('upload.blocked_after_deadline', req, { weekId, countryId });
      logger.info('Upload blocked: deadline passed', { context: { weekId, countryId, ip: req.ip } });
      return next(cutoffErr);
    }
  }
  next();
};

// POST /api/uploads/:weekId/:countryId — upload fichier
router.post('/:weekId/:countryId', uploadMiddleware, asyncHandler(async (req, res, next) => {
  const uploadStartTime = Date.now();
  const { weekId, countryId } = req.params;
  
  // Valider les paramètres de semaine et pays
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    logger.warn('Upload attempt with invalid week or country', {
      context: { weekId, countryId, ip: req.ip },
    });
    return next(createErrors.notFound('Week ou Country'));
  }

  const providedToken = req.query.adminPassword || req.header('x-admin-password');
  const isAdmin = safeEqual(providedToken, ADMIN_PASSWORD);

  return upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        logger.error(`Upload error: ${err.message}`, {
          error: err.message,
          context: { weekId, countryId, code: err.code, ip: req.ip },
        });

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

    const reportageName = req.query.reportage || '';
    const allowImages = reportageName === 'Séminaires de la semaine';

    // Valider le fichier avec fileValidator (extension + MIME + nom)
    let validation = validateFile(file, { allowImages });
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


    const isScript = file.mimetype.startsWith('text/') || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isImage = file.mimetype.startsWith('image/');
    const isAudio = file.mimetype.startsWith('audio/');
    const reportage = req.query.reportage || null;

    let finalSize = file.size;

    const fileData = {
      id: uuidv4(),
      name: file.originalname,
      filename: file.filename,
      type: isScript ? 'script' : isImage ? 'image' : isAudio ? 'audio' : 'video',
      size: `${(finalSize / (1024 * 1024)).toFixed(1)} MB`,
      // 'pending' = en attente de revue par l'équipe montage.
      // (Avant: 'completed' → l'UI l'affichait à tort comme "Rejeté".)
      status: 'pending',
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
      
      // Trigger push notification in background
      broadcastNotification({
        title: 'Nouveau fichier reçu',
        body: `Un fichier a été envoyé par ${countryId} pour la semaine ${weekId}.`,
        url: `/?week=${weekId}`
      }).catch(err => logger.error('Push notification failed', { error: err.message }));
      
      io?.emit('upload_update', { weekId, countryId });
      
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
    } catch (e) {
      return next(e);
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

  if (content.length > 100000) {
    return next(createErrors.badRequest('Script trop long'));
  }

  const filename = `${uuidv4()}.txt`;
  const filePath = path.join(uploadsDir, filename);

  try {
    writeFileSync(filePath, content, 'utf-8');
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
    status: 'pending',
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
    io?.emit('upload_update', { weekId, countryId });
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

    io?.emit('upload_update', { weekId, countryId });

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

  io?.emit('upload_update', { weekId, countryId: undefined });

  return res.json(updatedFile);
}));
// --- VOIX OFF STUDIO ---
// Upload raw voiceover, process via FFmpeg (EQ/Compressor), save audio + script.
import { mkdirSync } from 'fs';

router.post('/voiceover/:weekId/:countryId', upload.single('audio'), asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  const { reportageTitle, script } = req.body;

  if (!isValidWeek(weekId)) {
    return next(createErrors.notFound('Week'));
  }
  // Chutier `mj` (Mot du JT) réservé à l'équipe montage : admin requis,
  // même via la route voix-off (sinon n'importe quel pays peut polluer).
  if (countryId === 'mj') {
    const provided = req.header('x-admin-password') || req.query.adminPassword;
    if (!ADMIN_PASSWORD || !safeEqual(provided, ADMIN_PASSWORD)) {
      return next(createErrors.forbidden('Accès admin requis pour la rubrique Mot du JT.'));
    }
  }

  // Allow custom countries too
  const customCountries = getCustomCountries();
  const isValidCountry = COUNTRIES.some(c => c.id === countryId) || customCountries.some(c => c.id === countryId) || countryId === 'mj' || countryId === '_subscriptions';
  if (!isValidCountry) {
    return next(createErrors.badRequest('ID de pays/chutier invalide.'));
  }

  const providedToken = req.body.adminPassword || req.header('x-admin-password');
  const ignoreCutoff = safeEqual(providedToken, ADMIN_PASSWORD);
  
  if (!ignoreCutoff) {
    const cutoffErr = checkUploadCutoff(weekId);
    if (cutoffErr) return next(cutoffErr);
  }

  if (!req.file) {
    return next(createErrors.badRequest('Fichier audio manquant.'));
  }

  if (!reportageTitle) {
    return next(createErrors.badRequest('Le titre du reportage est requis.'));
  }

  if (script && script.length > 100000) {
    return next(createErrors.badRequest('Le script est trop long.'));
  }

  let rawAudioPath;
  let finalAudioPath;
  let scriptPath;

  try {
    rawAudioPath = req.file.path;
    const uploadStartTime = Date.now();
    
    // Generate paths for processed files
    const safeTitle = sanitizeFilename(reportageTitle) || 'Reportage';
    const audioFilename = `${uuidv4()}-${safeTitle}-Voix.mp3`;
    const scriptFilename = `${uuidv4()}-${safeTitle}-Script.txt`;
    
    // Flat layout = même chemin que les autres uploads → getFileMetadata
    // matche par basename, safeFilename (editorService) n'explose pas sur '/'.
    finalAudioPath = path.join(uploadsDir, audioFilename);
    scriptPath = path.join(uploadsDir, scriptFilename);

    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    // Process audio via FFmpeg
    await processVoiceover(rawAudioPath, finalAudioPath);
    
    // Save Script
    if (script) {
      writeFileSync(scriptPath, script, 'utf8');
    }

    // Clean up raw recording
    if (existsSync(rawAudioPath)) {
      unlinkSync(rawAudioPath);
    }

    // Register audio in DB
    const { statSync } = await import('fs');
    const audioFileMeta = {
      id: uuidv4(),
      name: `${reportageTitle} - Voix (Studio).mp3`,
      filename: audioFilename,
      size: `${(statSync(finalAudioPath).size / (1024 * 1024)).toFixed(2)} MB`,
      type: 'audio',
      uploadedAt: new Date().toISOString(),
      reportage: reportageTitle,
      status: 'pending'
    };
    addUpload(weekId, countryId, audioFileMeta);

    // Register script in DB if exists
    let scriptFileMeta = null;
    if (script) {
      scriptFileMeta = {
        id: uuidv4(),
        name: `${reportageTitle} - Script.txt`,
        filename: scriptFilename,
        size: `${statSync(scriptPath).size} octets`,
        type: 'script',
        uploadedAt: new Date().toISOString(),
        reportage: reportageTitle,
        status: 'pending'
      };
      addUpload(weekId, countryId, scriptFileMeta);
    }

    const uploadDurationMs = Date.now() - uploadStartTime;
    recordUpload(uploadDurationMs, true);

    io?.emit('upload_update', { weekId, countryId });

      broadcastNotification({
        title: 'Nouvelle Voix Off Studio',
        body: `Une voix off "${reportageTitle}" a été générée pour la semaine ${weekId}.`,
        url: `/?week=${weekId}`
      }).catch(err => logger.error('Push notification failed', { error: err.message }));

    res.status(201).json({
      message: 'Voix traitée et enregistrée avec succès',
      audio: audioFileMeta,
      script: scriptFileMeta
    });

  } catch (error) {
    logger.error('Voiceover processing error', { error: error.message, stack: error.stack });
    // Clean up files if fails
    if (rawAudioPath && existsSync(rawAudioPath)) {
      unlinkSync(rawAudioPath);
    }
    if (finalAudioPath && existsSync(finalAudioPath)) {
      unlinkSync(finalAudioPath);
    }
    if (scriptPath && existsSync(scriptPath)) {
      unlinkSync(scriptPath);
    }
    return next(createErrors.internalError('Erreur lors du traitement de la voix: ' + error.message));
  }
}));

export default router;
