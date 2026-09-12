import { Server, EVENTS } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { existsSync, unlinkSync, openSync, readSync, closeSync, renameSync } from 'fs';
import logger from '../logger/index.js';
import { uploadsDir, MAX_FILE_SIZE, ALLOWED_EXTENSIONS, classifyExtension, extensionEffective } from '../lib/upload.js';
import { extensionDepuisOctets, TAILLE_ENTETE } from '../lib/signatures.js';
import { addUpload, getCustomCountries, getExtensions, updateUploadSize, setUploadProxy } from '../data/store.js';
import { queueCompression } from '../services/videoCompress.js';
import { buildWeeks, weekUploadCutoff, isCountryAccepted } from '../data/constants.js';
import { recordUpload } from '../monitoring/metrics.js';
import { broadcastNotification, AUDIENCES } from './webpush.js';
import { io } from '../app.js';
import { safeEqual, normalizeToken } from '../middleware/auth.js';
import { readReporterToken } from '../lib/reporterToken.js';
import { evaluerPortee } from '../middleware/portee.js';
import { nomLisible } from '../middleware/sanitizer.js';

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
    err.body = 'Délai dépassé : les envois de cette semaine sont clôturés depuis dimanche 10h30 (GMT+2).';
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
 *
 * `correspondant` vient du lien personnel, que le client passe en métadonnée
 * TUS faute de pouvoir compter sur `readReporter` : celui-ci est monté sur
 * /api (app.js) alors que TUS est branché AVANT. Sans cette relecture, le
 * chemin d'envoi le plus utilisé — celui des vidéos depuis un téléphone —
 * échapperait entièrement à la portée.
 */
/**
 * Lit un en-tête quelle que soit la forme de la requête.
 *
 * @tus/server v2 passe aux crochets un `Request` de l'API fetch, dont
 * `headers` est un objet `Headers` : l'indexer comme un dictionnaire renvoie
 * toujours `undefined`. C'est ce qui faisait passer pour anonyme un
 * correspondant qui présentait pourtant son lien — et la portée refusait
 * alors tous ses envois.
 */
function enTete(req, nom) {
  const entetes = req?.headers;
  if (!entetes) return '';
  if (typeof entetes.get === 'function') return entetes.get(nom) || '';
  return entetes[nom] || entetes[nom.toLowerCase()] || '';
}

export function authorizeTusUpload(meta = {}, req = null) {
  const ADMIN = process.env.ADMIN_PASSWORD;
  const token = normalizeToken(String(meta.adminPassword || meta.appPassword || ''));
  const isAdmin = !!(ADMIN && token && safeEqual(token, normalizeToken(String(ADMIN))));

  // En-tête d'abord : il voyage hors des métadonnées, donc hors du sidecar
  // écrit sur disque. La métadonnée reste acceptée en repli, car un proxy
  // peut retirer un en-tête inconnu — et un envoi refusé pour cette raison
  // serait incompréhensible pour le correspondant.
  const brut = enTete(req, 'x-reporter-token') || meta.reporterToken || '';
  const correspondant = readReporterToken(brut);
  return { ok: true, isAdmin, correspondant };
}

/**
 * Le nom porte-t-il une extension explicitement INTERDITE ?
 *
 * C'est la seule chose qui justifie encore un refus à l'ouverture : un
 * `.html` ou un `.exe` nommé comme tel. L'absence d'extension, elle, n'est
 * pas une faute — le partage Android et certains sélecteurs livrent
 * couramment un nom nu, et le refuser coûtait un reportage. Ce cas-là est
 * tranché à l'arrivée, sur les octets, où il n'y a plus à deviner.
 */
export function extensionInterdite(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return Boolean(ext) && !ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Allowlist d'extensions — même règle que le chemin multer (lib/upload.js).
 * Le type MIME sert de secours quand le nom n'a pas d'extension exploitable.
 */
export function validateTusExtension(name, mimetype = '') {
  return Boolean(extensionEffective(name, mimetype));
}

/**
 * Donne au fichier stocké l'extension que ses octets révèlent, quand il n'en
 * a pas. Renvoie le nom à retenir — inchangé si tout allait déjà bien, ou si
 * rien n'est reconnu (un script texte n'a aucune signature : il reste sans
 * extension, et le serveur statique le sert en pièce jointe, ce qui est
 * exactement ce qu'il faut).
 *
 * Ne jette jamais : au pire on garde le nom tel quel.
 */
function reconnaitreEtRenommer(id, meta) {
  if (path.extname(id)) return id;

  const chemin = path.join(uploadsDir, id);
  let ext = '';
  let fd;
  try {
    fd = openSync(chemin, 'r');
    const buf = Buffer.alloc(TAILLE_ENTETE);
    const lus = readSync(fd, buf, 0, TAILLE_ENTETE, 0);
    ext = extensionDepuisOctets(buf.subarray(0, lus));
  } catch (err) {
    logger.warn('Lecture d\'en-tête impossible, nom conservé', { error: err.message, id });
    return id;
  } finally {
    if (fd !== undefined) { try { closeSync(fd); } catch { /* ignore */ } }
  }

  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    logger.info('Format non reconnu sur les octets : fichier conservé sans extension', {
      context: { id, nomDorigine: meta?.name || '', typeAnnonce: meta?.filetype || '' },
    });
    return id;
  }

  try {
    renameSync(chemin, path.join(uploadsDir, `${id}${ext}`));
    logger.info('Extension reconnue sur les octets', {
      context: { id, ext, nomDorigine: meta?.name || '', typeAnnonce: meta?.filetype || '' },
    });
    return `${id}${ext}`;
  } catch (err) {
    logger.warn('Renommage impossible, nom conservé', { error: err.message, id });
    return id;
  }
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
    // L'extension vient du nom, ou à défaut du type annoncé. Si rien n'est
    // exploitable on écrit sans extension : les octets trancheront à
    // l'arrivée (onUploadFinish), et le fichier sera renommé alors.
    const safeExt = extensionEffective(
      metadata?.filename || metadata?.name || '',
      metadata?.filetype || '',
    );
    return `${Date.now()}-${uuidv4()}${safeExt}`;
  },
  onUploadCreate: async (req, upload) => {
    // Authentification & Validation
    const meta = upload.metadata || {};
    const weekId = meta.weekId;
    const countryId = meta.countryId;

    const { ok, isAdmin, correspondant } = authorizeTusUpload(meta, req);
    if (!ok) {
      throw { status_code: 401, body: 'Session requise : mot de passe invalide ou manquant.' };
    }

    if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
      throw { status_code: 404, body: 'Week ou Country invalide' };
    }

    // Même règle exactement que sur les routes HTTP : c'est `evaluerPortee`
    // qui tranche, ici comme là-bas.
    const portee = evaluerPortee({
      redaction: isAdmin,
      correspondant,
      pays: countryId,
      chemin: '/api/tus',
    });
    if (!portee.autorise) {
      throw { status_code: 403, body: portee.erreur?.publicMessage || 'Envoi hors de votre pays.' };
    }

    // On ne refuse que ce qui se déclare interdit. Un nom sans extension
    // passe : son format sera reconnu sur ses octets à la fin du transfert.
    if (extensionInterdite(meta.name || meta.filename)) {
      throw { status_code: 415, body: 'Type de fichier non autorisé.' };
    }

    if (!isAdmin) {
      const cutoffErr = checkUploadCutoff(weekId, countryId);
      if (cutoffErr) throw cutoffErr;
    }

    // On NE persiste PAS les secrets dans le .json sidecar du FileStore.
    // upload.metadata est sérialisé sur disque par @tus/file-store ; si on y
    // laisse adminPassword/appPassword/reporterToken, ils restent lisibles à
    // toute personne ayant accès au volume d'uploads. Le lien personnel est
    // un secret porteur au même titre que le mot de passe : il part avec eux.
    // On filtre ici avant retour (l'auth a déjà été vérifiée juste au-dessus).
    const { adminPassword: _ap, appPassword: _gp, reporterToken: _rt, ...safeMeta } = upload.metadata || {};
    return { metadata: safeMeta };
  },
  onUploadFinish: async (req, upload) => {
    const meta = upload.metadata || {};
    const weekId = meta.weekId;
    const countryId = meta.countryId;
    // `namingFunction` a pu écrire sans extension, faute d'avoir su la
    // déduire du nom ou du type annoncé. Les octets sont arrivés depuis :
    // on lit l'en-tête et on renomme. C'est le seul juge fiable — le nom
    // ment par omission, et le type annoncé vaut très souvent
    // « application/octet-stream ».
    let filename = reconnaitreEtRenommer(upload.id, meta);
    const originalName = nomLisible(meta.name || meta.filename || 'envoi');
    const reportage = meta.reportage || null;
    // `sujetId` est la nouvelle attache. `reportage` reste écrit pour que les
    // écrans qui ne connaissent pas encore les sujets continuent d'afficher
    // quelque chose, et pour qu'un retour en arrière reste possible.
    const sujetId = meta.sujetId || null;
    const fileType = meta.filetype || 'application/octet-stream';
    const fileSize = upload.size;
    // Le classement se fait sur l'extension retenue après reconnaissance, et
    // non sur le nom d'origine : c'est elle qui dit ce que le fichier est.
    const extRetenue = path.extname(filename).toLowerCase();

    // Classement par extension d'abord, type MIME ensuite : un téléphone qui
    // annonce application/octet-stream pour un .wav rangeait son audio dans
    // les rushes vidéo.
    const fileData = {
      id: uuidv4(),
      name: originalName,
      filename: filename,
      type: classifyExtension(extRetenue, fileType),
      size: `${(fileSize / (1024 * 1024)).toFixed(1)} MB`,
      status: 'pending',
      reportage,
      sujetId,
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
        const ext = extRetenue || path.extname(originalName).toLowerCase();
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
