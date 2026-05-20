import { Router } from 'express';
import multer from 'multer';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { createReadStream, existsSync, unlinkSync, writeFileSync } from 'fs';
import logger from '../logger/index.js';
import { recordUpload } from '../monitoring/metrics.js';
import { COUNTRIES, buildWeeks } from '../data/constants.js';
import { getCustomCountries } from '../data/store.js';
import { getWeekUploads, getCountryUploads, addUpload, deleteUpload } from '../data/store.js';
import { validateFile, validateMagicNumber } from '../middleware/fileValidator.js';
import { sanitizeFilename, isValidUUID, validateUUIDParam } from '../middleware/sanitizer.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { audit } from '../logger/audit.js';

const router = Router();

// Path absolu pour que multer écrive sur le disque persistant en prod.
// En dev, fallback sur cwd/uploads/.
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || 209715200); // 200MB par défaut
const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.mp3', '.wav', '.txt', '.docx']);

const upload = multer({
  storage,
  limits: { 
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Type de fichier non autorise'));
    }
    return cb(null, true);
  },
});

// La validation se fait contre la liste recalculée à chaque appel —
// indispensable car la fenêtre visible glisse chaque jour à minuit.
const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);
const isValidCountry = (countryId) =>
  COUNTRIES.some((c) => c.id === countryId) ||
  getCustomCountries().some((c) => c.id === countryId);

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
router.get('/:weekId/:countryId/archive', asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    logger.warn('Archive request with invalid week or country', {
      context: { weekId, countryId, ip: req.ip },
    });
    return next(createErrors.notFound('Week ou Country'));
  }

  const uploads = getCountryUploads(weekId, countryId);
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
    zlib: { level: 9 },
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
    
    // Gérer les erreurs de disque plein
    if (err.code === 'ENOSPC') {
      res.status(507).json(createErrors.diskFullError());
    } else {
      res.status(500).json(createErrors.internalError('Failed to create archive'));
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
  
  files.forEach((file) => {
    const filePath = path.join(uploadsDir, file.filename);
    try {
      archive.append(createReadStream(filePath), { name: file.name });
      logger.debug(`Added to archive: ${file.name}`, {
        context: { filename: file.filename, size: file.size },
      });
    } catch (err) {
      logger.error(`Failed to add file to archive: ${file.name}`, {
        error: err.message,
        context: { filename: file.filename },
      });
    }
  });
  
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

  return upload.single('file')(req, res, (err) => {
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
      return next(createErrors.fileTypeError());
    }

    const isScript = ['.txt', '.docx'].includes(path.extname(file.originalname).toLowerCase());

    const fileData = {
      id: uuidv4(),
      name: file.originalname,
      filename: file.filename,
      type: isScript ? 'script' : 'video',
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      status: 'completed',
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
  const { content } = req.body;

  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    logger.warn('Script upload attempt with invalid week or country', {
      context: { weekId, countryId, ip: req.ip },
    });
    return next(createErrors.notFound('Week ou Country'));
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
    status: 'completed',
    content,
    filename,
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
router.delete('/:weekId/:countryId/:fileId', asyncHandler(async (req, res, next) => {
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

    return res.status(204).end();
  } catch (error) {
    logger.error(`Delete operation failed: ${error.message}`, {
      error: error.message,
      context: { weekId, countryId, fileId, ip: req.ip },
    });
    return next(createErrors.internalError('Erreur lors de la suppression'));
  }
}));

export default router;
