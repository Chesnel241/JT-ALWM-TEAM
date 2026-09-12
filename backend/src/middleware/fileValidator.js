/**
 * File Validator Middleware
 * Validation stricte des fichiers uploadés.
 */

import { openSync, readSync, closeSync } from 'fs';
import {
  MAX_FILE_SIZE as UPLOAD_MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS as UPLOAD_ALLOWED_EXTENSIONS,
  IMAGE_EXTENSIONS,
  extensionEffective,
} from '../lib/upload.js';
import { extensionDepuisOctets, extensionCoherente, contenuEstBalisage, TAILLE_ENTETE } from '../lib/signatures.js';
import logger from '../logger/index.js';

// Même liste que multer et TUS : une seule source de vérité, sinon un fichier
// accepté à l'écriture se faisait refuser juste après par le validateur.
const ALLOWED_EXTENSIONS = [...UPLOAD_ALLOWED_EXTENSIONS];
// Source de vérité unique : on prend MAX_FILE_SIZE depuis lib/upload.js
// (qui lit l'env). Avant : valeur hardcodée 200 Mo divergente — multer
// acceptait jusqu'à 2 Go puis le validateur rejetait avec un message
// trompeur, et on avait déjà écrit le fichier sur disque.
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE;

/**
 * Les signatures binaires vivent dans lib/signatures.js, partagées avec le
 * chemin TUS. La table locale qui existait ici était trop étroite : `.mov`
 * n'y admettait que `ftyp` et `moov` alors que de vrais fichiers de
 * caméscope commencent par `wide` ou `mdat`, et `.aac` n'y admettait que
 * deux des quatre en-têtes ADTS — pendant que Safari, lui, livre un
 * conteneur MP4 sous ce nom. Chacun de ces écarts refusait un
 * enregistrement parfaitement lisible.
 */

export function validateMagicNumber(filePath, ext) {
  if (ext.toLowerCase() === '.txt') {
    let fd;
    try {
      fd = openSync(filePath, 'r');
      const buf = Buffer.alloc(1024);
      const bytesRead = readSync(fd, buf, 0, 1024, 0);
      const content = buf.toString('utf8', 0, bytesRead);
      if (/<script/i.test(content) || /<html/i.test(content)) {
        return { valid: false, error: 'Fichier texte contient des balises non autorisées' };
      }
      return { valid: true };
    } catch (err) {
      return { valid: false, error: `Lecture du fichier texte échouée: ${err.message}` };
    } finally {
      if (fd !== undefined) {
        try { closeSync(fd); } catch { /* ignore */ }
      }
    }
  }

  let fd;
  try {
    fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(TAILLE_ENTETE);
    const lus = readSync(fd, buf, 0, TAILLE_ENTETE, 0);
    const entete = buf.subarray(0, lus);

    // Du balisage sous un nom de média : le seul désaccord qui reste un refus.
    if (contenuEstBalisage(entete)) {
      return { valid: false, error: `Ce fichier contient du balisage, pas du ${ext.replace('.', '')}.` };
    }

    const coherent = extensionCoherente(entete, ext);
    const reelle = extensionDepuisOctets(entete);

    // Un désaccord entre l'extension et les octets n'est PAS un motif de
    // refus. Le nom est ce que le téléphone a bien voulu écrire ; les octets
    // sont le fichier. On note l'écart, on retient le format réel, et on
    // laisse passer — un enregistrement lisible ne doit jamais être perdu
    // parce qu'il a été mal nommé.
    if (coherent === false) {
      logger.info('Extension et contenu divergent, le contenu fait foi', {
        context: { ext, reelle },
      });
    }
    return { valid: true, extensionReelle: reelle };
  } catch (err) {
    return { valid: false, error: `Lecture du fichier échouée: ${err.message}` };
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }
}

/**
 * Valide un fichier uploadé.
 * @param {Object} file - Objet fichier de multer
 * @param {Object} [opts]
 * @param {number} [opts.maxSize] - Taille max en octets (défaut MAX_FILE_SIZE).
 *   Permet aux routes de spécifier une limite contextuelle (rushes 200 Mo,
 *   delivery 400 Mo, etc.). multer applique déjà sa propre limite avant
 *   d'arriver ici, ce check sert de défense en profondeur.
 * @returns {Object} - {valid: boolean, error?: string}
 */
export function validateFile(file, { maxSize = MAX_FILE_SIZE, allowImages = false } = {}) {
  if (!file) {
    return { valid: false, error: 'Aucun fichier fourni' };
  }

  if (!file.originalname || !file.size || !file.mimetype) {
    return { valid: false, error: 'Fichier invalide ou corrompu' };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Fichier trop volumineux. Maximum: ${Math.round(maxSize / (1024 * 1024))}MB`,
    };
  }

  // Extension retenue : celle du nom, ou à défaut celle que trahit le type
  // annoncé. Un fichier au nom nu n'est pas une faute (partage Android).
  const ext = extensionEffective(file.originalname, file.mimetype) || getFileExtension(file.originalname);
  const allowedExts = allowImages
    ? ALLOWED_EXTENSIONS
    : ALLOWED_EXTENSIONS.filter((e) => !IMAGE_EXTENSIONS.includes(e));
  
  if (!allowedExts.includes(ext.toLowerCase())) {
    return { 
      valid: false, 
      error: `Extension non autorisée: ${ext}. Autorisées: ${allowedExts.join(', ')}`
    };
  }

  // MIME : on raisonne par FAMILLE, pas par liste fermée. Les téléphones
  // annoncent des types très variables pour un même format (video/x-matroska,
  // audio/3gpp, et très souvent application/octet-stream depuis un navigateur
  // mobile). Une liste fermée rejetait des fichiers parfaitement valides.
  // Le garde-fou réel reste l'extension autorisée ci-dessus, doublée de la
  // signature binaire vérifiée par validateMagicNumber().
  const mime = String(file.mimetype).toLowerCase();
  const family = mime.split('/')[0];
  const MEDIA_FAMILIES = allowImages ? ['video', 'audio', 'image'] : ['video', 'audio'];
  const DOCUMENT_MIMES = [
    'text/plain', 'text/markdown', 'text/rtf', 'application/rtf', 'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/zip', 'application/x-zip-compressed',
    // Envoi depuis un navigateur mobile qui ne sait pas nommer le format.
    'application/octet-stream',
  ];

  if (!MEDIA_FAMILIES.includes(family) && !DOCUMENT_MIMES.includes(mime)) {
    return {
      valid: false,
      error: `Type MIME non autorisé: ${file.mimetype}`
    };
  }

  // Le nom d'origine ne sert QUE d'étiquette : le fichier est écrit sous un
  // UUID. Un `:` ou un `?` — que produisent couramment les enregistrements
  // iOS et Android — n'a donc aucune conséquence, et refuser l'envoi pour
  // cela coûtait un reportage. Les appelants rangent ce nom via nomLisible().

  return { valid: true };
}

/**
 * Extrait l'extension d'un nom de fichier
 */
function getFileExtension(filename) {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.substring(dot) : '';
}

/**
 * Middleware Express pour validation de fichiers
 */
export function fileValidatorMiddleware(req, res, next) {
  if (!req.file) {
    return next(); // Pas de fichier, laisser passer
  }

  const validation = validateFile(req.file);
  
  if (!validation.valid) {
    return res.status(400).json({
      code: 'INVALID_FILE',
      message: validation.error,
      details: { file: req.file.originalname }
    });
  }

  next();
}

export default fileValidatorMiddleware;
