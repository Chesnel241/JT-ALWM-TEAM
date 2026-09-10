import { Server, EVENTS } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { existsSync, unlinkSync } from 'fs';
import logger from '../logger/index.js';
import { uploadsDir, MAX_FILE_SIZE, ALLOWED_EXTENSIONS, classifyUpload } from '../lib/upload.js';
import { addUpload, getCustomCountries, getExtensions, updateUploadSize, setUploadProxy } from '../data/store.js';
import { queueCompression } from '../services/videoCompress.js';
import { buildWeeks, weekUploadCutoff, isCountryAccepted } from '../data/constants.js';
import { recordUpload } from '../monitoring/metrics.js';
import { broadcastNotification, AUDIENCES } from './webpush.js';
import { io } from '../app.js';
import { safeEqual, normalizeToken } from '../middleware/auth.js';

const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);
// Délègue à la source de vérité partagée (inclut COUNTRIES + custom +
// buckets spéciaux comme `mj`). Avant : TUS rejetait `mj` → écran d'erreur
// 404 "Week ou Country invalide" sur les uploads admin (Mot du JT, etc.).
const isValidCountry = (countryId) => isCountryAccepted(countryId, getCustomCountries());

function checkUploadCutoff(weekId, countryId) {
  const cutoff = weekUploadCutoff(weekId);
  if (!cutoff) return null;
  
  if (new Date() > cutoff) {
    // Check if there is a valid extension
    const exts = getExtensions(weekId);
    let extendedUntil = null;
    
    // Check global extension
    if (exts.global && exts.global.extendedUntil) {
      extendedUntil = new Date(exts.global.extendedUntil);
    }
    
    // Check country-specific extension
    if (exts.requests && exts.requests[countryId] && exts.requests[countryId].status === 'approved') {
      const countryExt = new Date(exts.requests[countryId].extendedUntil);
      if (!extendedUntil || countryExt > extendedUntil) {
        extendedUntil = countryExt;
      }
    }
    
    // If we have an extension and it's still valid
    if (extendedUntil && new Date() <= extendedUntil) {
      return null;
    }

    const err = new Error('Date limite d\'envoi dépassée');
    err.status_code = 423;
    err.body = 'Délai dépassé : les uploads pour cette semaine sont clôturés depuis dimanche 17h30.';
    return err;
  }
  return null;
}

/**
 * Authentifie une création d'upload TUS. La route /api/tus est montée AVANT
 * le middleware requireAuth (les body-parsers casseraient le protocole TUS).
 *
 * Le mot de passe de session global a été retiré (décision produit) : tout
 * upload est accepté (`ok: true` inconditionnel). On calcule quand même
 * `isAdmin` à partir d'ADMIN_PASSWORD — cette protection-là reste active et
 * distincte (bypass du cutoff hebdo, rubrique `mj`), hors périmètre du
 * retrait du mot de passe global.
 */
export function authorizeTusUpload(meta = {}) {
  const ADMIN = process.env.ADMIN_PASSWORD;
  const token = normalizeToken(String(meta.adminPassword || meta.appPassword || ''));
  const isAdmin = !!(ADMIN && token && safeEqual(token, normalizeToken(String(ADMIN))));
  return { ok: true, isAdmin };
}

/** Allowlist d'extensions — même règle que le chemin multer (lib/upload.js). */
export function validateTusExtension(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export const tusServer = new Server({
  path: '/api/tus',
  datastore: new FileStore({ directory: uploadsDir }),
  respectForwardedHeaders: true,
  relativeLocation: true,
  // Même plafond que le chemin multer des rushes (200 Mo par défaut,
  // surchargeable MAX_FILE_SIZE). Sans lui : remplissage disque illimité.
  maxSize: MAX_FILE_SIZE,
  namingFunction: (req, metadata) => {
    // UUID + timestamp pour l'unicité, MAIS on préserve l'extension
    // d'origine (allowlist uniquement — pas d'injection possible) : toute
    // la chaîne aval détecte le type par extension (INLINE_EXT du static,
    // IMAGE_EXT de ffmpeg, isImage de Remotion, mime du player). Un fichier
    // sans extension est traité comme vidéo → écran noir si c'était une
    // image, téléchargement forcé au lieu de lecture inline, etc.
    const ext = path.extname(String(metadata?.filename || metadata?.name || '')).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '';
    return `${Date.now()}-${uuidv4()}${safeExt}`;
  },
  onUploadCreate: async (req, upload) => {
    // Authentification & Validation
    const meta = upload.metadata || {};
    const weekId = meta.weekId;
    const countryId = meta.countryId;

    const { ok, isAdmin } = authorizeTusUpload(meta);
    if (!ok) {
      throw { status_code: 401, body: 'Session requise : mot de passe invalide ou manquant.' };
    }

    if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
      throw { status_code: 404, body: 'Week ou Country invalide' };
    }

    if (!validateTusExtension(meta.name || meta.filename)) {
      throw { status_code: 415, body: 'Type de fichier non autorisé.' };
    }

    if (!isAdmin) {
      const cutoffErr = checkUploadCutoff(weekId, countryId);
      if (cutoffErr) throw cutoffErr;
    }

    // On NE persiste PAS le mot de passe dans le .json sidecar du FileStore.
    // upload.metadata est sérialisé sur disque par @tus/file-store ; si on
    // y laisse adminPassword/appPassword, le secret reste lisible à toute
    // personne ayant accès au volume d'uploads. On le filtre ici avant
    // retour (l'auth a déjà été vérifiée juste au-dessus).
    const { adminPassword: _ap, appPassword: _gp, ...safeMeta } = upload.metadata || {};
    return { metadata: safeMeta };
  },
  onUploadFinish: async (req, upload) => {
    const meta = upload.metadata || {};
    const weekId = meta.weekId;
    const countryId = meta.countryId;
    const filename = upload.id; // Generated by namingFunction
    const originalName = meta.name || 'Unknown.mp4';
    const reportage = meta.reportage || null;
    const fileType = meta.filetype || 'application/octet-stream';
    const fileSize = upload.size;

    // Classement par extension d'abord, type MIME ensuite : un téléphone qui
    // annonce application/octet-stream pour un .wav rangeait son audio dans
    // les rushes vidéo.
    const fileData = {
      id: uuidv4(),
      name: originalName,
      filename: filename,
      type: classifyUpload(originalName, fileType),
      size: `${(fileSize / (1024 * 1024)).toFixed(1)} MB`,
      status: 'pending',
      reportage,
      uploadedAt: new Date().toISOString(),
    };

    try {
      addUpload(weekId, countryId, fileData);
      recordUpload(1000, true); // Mock duration since we don't have start time across chunks
      logger.uploadReceived(weekId, countryId, originalName, fileData.size);

      logger.info('TUS Upload completed and persisted', {
        context: {
          weekId,
          countryId,
          filename: originalName,
          fileId: fileData.id,
          type: fileData.type,
          size: fileData.size,
        },
      });

      broadcastNotification({
        title: 'Nouveau fichier reçu',
        body: `Un fichier a été envoyé via l'envoi sécurisé par ${countryId} pour la semaine ${weekId}.`,
        url: '/monteurs'
      }, { audiences: [AUDIENCES.EDITOR] })
        .catch(err => logger.error('Push notification failed', { error: err.message }));

      io?.emit('upload_update', { weekId, countryId });

      // Compression 720p côté serveur, en arrière-plan et une à la fois.
      // Elle se faisait auparavant dans le navigateur du correspondant :
      // téléchargement d'un moteur d'encodage puis réencodage sur le
      // téléphone, avant même de commencer l'envoi. Ici l'envoi est déjà
      // terminé et confirmé quand l'encodage démarre.
      if (fileData.type === 'video') {
        const ext = path.extname(originalName).toLowerCase();
        const absolutePath = path.join(uploadsDir, filename);
        queueCompression(absolutePath, ext, ({ compressed, proxyName, newSize }) => {
          if (!compressed) return;
          // La taille affichée reste celle du master : c'est lui qu'on
          // conserve et qu'on exporte. Le proxy ne sert qu'à l'aperçu.
          const label = `${(newSize / (1024 * 1024)).toFixed(1)} MB`;
          if (setUploadProxy(weekId, countryId, fileData.id, proxyName, label)) {
            io?.emit('upload_update', { weekId, countryId });
          }
        });
      }

    } catch (storeErr) {
      logger.uploadFailed(weekId, countryId, originalName, storeErr);
      // Cleanup complet : on doit virer le binaire ET le .json metadata
      // que FileStore conserve à côté (sinon le dossier d'upload se
      // remplit d'orphelins à chaque échec d'addUpload).
      try {
        await tusServer.datastore.remove(filename);
      } catch {
        // datastore.remove échoue si déjà parti : fallback unlink direct.
        try {
          const filePath = path.join(uploadsDir, filename);
          if (existsSync(filePath)) unlinkSync(filePath);
        } catch { /* ignore */ }
      }
    }
  }
});
