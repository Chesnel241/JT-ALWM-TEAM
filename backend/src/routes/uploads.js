import { Router } from 'express';
import multer from 'multer';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { createReadStream, existsSync, unlinkSync, writeFileSync } from 'fs';
import { COUNTRIES, WEEKS } from '../data/constants.js';
import { getWeekUploads, getCountryUploads, addUpload, deleteUpload } from '../data/store.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.mp3', '.wav', '.txt', '.docx']);

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Type de fichier non autorise'));
    }
    return cb(null, true);
  },
});

const isValidWeek = (weekId) => WEEKS.some((w) => w.id === weekId);
const isValidCountry = (countryId) => COUNTRIES.some((c) => c.id === countryId);
const uploadsDir = path.join(process.cwd(), 'uploads');

// GET /api/uploads/:weekId — tous les pays d'une semaine
router.get('/:weekId', (req, res) => {
  if (!isValidWeek(req.params.weekId)) {
    return res.status(404).json({ error: 'Semaine introuvable' });
  }
  return res.json(getWeekUploads(req.params.weekId));
});

// GET /api/uploads/:weekId/:countryId — fichiers d'un pays
router.get('/:weekId/:countryId', (req, res) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return res.status(404).json({ error: 'Ressource introuvable' });
  }
  return res.json(getCountryUploads(weekId, countryId));
});

// GET /api/uploads/:weekId/:countryId/archive — zip des fichiers d'un pays
router.get('/:weekId/:countryId/archive', (req, res) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return res.status(404).json({ error: 'Ressource introuvable' });
  }

  const uploads = getCountryUploads(weekId, countryId);
  const files = uploads.filter((u) => u.filename && existsSync(path.join(uploadsDir, u.filename)));
  if (files.length === 0) {
    return res.status(404).json({ error: 'Aucun fichier a telecharger' });
  }

  const zipName = `uploads_${weekId}_${countryId}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    res.status(500).end(err.message);
  });

  archive.pipe(res);
  files.forEach((file) => {
    const filePath = path.join(uploadsDir, file.filename);
    archive.append(createReadStream(filePath), { name: file.name });
  });
  archive.finalize();
});

// POST /api/uploads/:weekId/:countryId — upload fichier
router.post('/:weekId/:countryId', (req, res) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return res.status(404).json({ error: 'Ressource introuvable' });
  }

  return upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Fichier trop volumineux'
        : err.message || 'Erreur upload';
      return res.status(400).json({ error: message });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Aucun fichier reçu' });

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

    return res.status(201).json(addUpload(weekId, countryId, fileData));
  });
});

// POST /api/uploads/:weekId/:countryId/script — saisie manuelle de script
router.post('/:weekId/:countryId/script', (req, res) => {
  const { weekId, countryId } = req.params;
  const { content } = req.body;

  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return res.status(404).json({ error: 'Ressource introuvable' });
  }

  if (!content?.trim()) return res.status(400).json({ error: 'Contenu vide' });

  const filename = `${uuidv4()}.txt`;
  const filePath = path.join(uploadsDir, filename);
  writeFileSync(filePath, content, 'utf-8');

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

  res.status(201).json(addUpload(weekId, countryId, fileData));
});

// DELETE /api/uploads/:weekId/:countryId/:fileId
router.delete('/:weekId/:countryId/:fileId', (req, res) => {
  const { weekId, countryId, fileId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return res.status(404).json({ error: 'Ressource introuvable' });
  }

  const deleted = deleteUpload(weekId, countryId, fileId);
  if (!deleted) return res.status(404).json({ error: 'Fichier introuvable' });

  if (deleted.filename) {
    const filePath = path.join(uploadsDir, deleted.filename);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch {
        // Best-effort cleanup
      }
    }
  }

  return res.status(204).end();
});

export default router;
