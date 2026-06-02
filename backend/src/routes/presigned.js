import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getUploadPresignedUrl } from '../lib/s3.js';
import logger from '../logger/index.js';

const router = express.Router();

// Allowlist des MIME types acceptés pour l'upload R2. Sans contrainte, un
// client pourrait signer une URL pour `text/html` et pousser du contenu
// servi via /uploads/* (stored XSS / drive-by). On limite aux médias.
const ALLOWED_MIME = new Set([
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/mp4',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'text/plain',
  'application/zip', 'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// Taille max présignée par défaut (200 Mo), surchargeable via env.
const MAX_PRESIGNED_BYTES = parseInt(process.env.MAX_PRESIGNED_BYTES || String(200 * 1024 * 1024), 10);

// Réduit le nom fourni par le client à un basename sûr : on retire tout
// séparateur de chemin et caractère de contrôle pour qu'il ne puisse pas
// s'échapper du préfixe `uploads/` dans la clé R2 (path traversal).
function safeNamePart(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Safe characters only (alphanumeric, dot, dash)
    .replace(/_+/g, '_')             // Collapse multiple underscores
    .slice(0, 200);                  // Limit length
}

// GET /api/presigned/upload?filename=...&contentType=...&size=<bytes>
// Le `size` est la taille déclarée par le client : rejette la signature si
// > MAX_PRESIGNED_BYTES (filet de sécurité ; R2 ne plafonne pas une PUT
// présignée par défaut). Garde-fou anti-abus de facturation.
router.get('/upload', async (req, res) => {
  try {
    const { filename, contentType, size } = req.query;

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' });
    }
    if (size !== undefined) {
      const n = Number(size);
      if (!Number.isFinite(n) || n < 0 || n > MAX_PRESIGNED_BYTES) {
        return res.status(400).json({
          error: `Taille hors limite (max ${Math.round(MAX_PRESIGNED_BYTES / (1024 * 1024))} Mo)`,
        });
      }
    }
    if (typeof contentType !== 'string' || !/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
      return res.status(400).json({ error: 'contentType invalide' });
    }
    if (!ALLOWED_MIME.has(contentType.toLowerCase())) {
      return res.status(400).json({ error: 'contentType non autorisé' });
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

// GET /api/presigned/download?filename=...
// SÉCURITÉ : on ne fait JAMAIS confiance au countryId fourni par le client
// pour décider de la protection. L'autorité est la métadonnée stockée du
// fichier (getFileMetadata). Sinon un fichier protégé "mj" demandé avec
// ?countryId=ci passerait la vérif (IDOR).
router.get('/download', async (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename is required' });
    }
    // Validation stricte du nom : pas de séparateur de chemin / .. / contrôle
    // → empêche de cibler une clé R2 arbitraire hors préfixe uploads/.
    if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes('..')) {
      return res.status(400).json({ error: 'filename invalide' });
    }

    // Protection "Mot du JT" : déterminée par la métadonnée RÉELLE du fichier.
    const { getFileMetadata } = await import('../data/store.js');
    const meta = getFileMetadata(filename);
    if (meta && meta.countryId === 'mj') {
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : undefined;
      if (ADMIN_PASSWORD) {
        const { safeEqual } = await import('../middleware/auth.js');
        const providedToken = req.header('x-admin-password');
        if (!providedToken || !safeEqual(providedToken.trim(), ADMIN_PASSWORD)) {
          return res.status(403).json({ error: 'Mot de passe administrateur requis pour ce téléchargement' });
        }
      }
    }

    const { HAS_R2, getR2PresignedUrl, checkR2Exists } = await import('../lib/s3.js');
    const r2Key = `uploads/${filename}`;

    if (HAS_R2) {
      const exists = await checkR2Exists(r2Key);
      if (exists) {
        const url = await getR2PresignedUrl(r2Key, 3600);
        return res.json({ url });
      }
    }

    // Fallback local avec token temporaire signé.
    const { generateDownloadToken } = await import('../lib/downloadTokens.js');
    const dlToken = generateDownloadToken(filename);
    const localUrl = `/uploads/${encodeURIComponent(filename)}?dl_token=${encodeURIComponent(dlToken)}`;
    res.json({ url: localUrl });

  } catch (error) {
    logger.error(`Error generating download URL: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

export default router;
