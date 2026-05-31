import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getUploadPresignedUrl } from '../lib/s3.js';
import logger from '../logger/index.js';

const router = express.Router();

// Réduit le nom fourni par le client à un basename sûr : on retire tout
// séparateur de chemin et caractère de contrôle pour qu'il ne puisse pas
// s'échapper du préfixe `uploads/` dans la clé R2 (path traversal).
function safeNamePart(name) {
  return String(name)
    .replace(/[/\\]/g, '_')        // pas de séparateur de chemin
    .replace(/\.{2,}/g, '_')        // pas de '..'
    .replace(/[\x00-\x1f]/g, '')    // pas de caractère de contrôle
    .slice(0, 200);                 // borne la longueur
}

// GET /api/presigned/upload?filename=...&contentType=...
router.get('/upload', async (req, res) => {
  try {
    const { filename, contentType } = req.query;

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' });
    }
    if (typeof contentType !== 'string' || !/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
      return res.status(400).json({ error: 'contentType invalide' });
    }

    // Generate a unique filename to avoid collisions (nom client assaini)
    const uniqueFilename = `${uuidv4()}-${safeNamePart(filename)}`;
    const r2Key = `uploads/${uniqueFilename}`;

    // Get the presigned URL valid for 1 hour (3600 seconds)
    const url = await getUploadPresignedUrl(r2Key, contentType, 3600);

    res.json({
      url,
      r2Key,
      filename: uniqueFilename
    });
  } catch (error) {
    logger.error(`Error generating presigned URL: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
});

export default router;
