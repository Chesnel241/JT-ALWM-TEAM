import { S3Client, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'fs';
import logger from '../logger/index.js';

// Configuration Cloudflare R2
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'jt-alwm-uploads';

// Client S3 initialisé uniquement si les identifiants sont présents
export const s3 = R2_ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    })
  : null;

export const HAS_R2 = !!s3;

if (!HAS_R2 && process.env.NODE_ENV === 'production') {
  logger.warn('Cloudflare R2 is NOT configured. Uploads will only be saved locally (and lost on Render reboot).');
}

/**
 * Upload un fichier vers R2 via streaming multipart (efficace pour grosses vidéos)
 * @param {string} localFilePath - Chemin local du fichier temporaire
 * @param {string} r2Key - Clé de destination dans R2 (ex: "uploads/monfichier.mp4")
 * @param {string} contentType - Mime type du fichier
 */
export async function uploadToR2(localFilePath, r2Key, contentType) {
  if (!HAS_R2) return false;

  const fileStream = createReadStream(localFilePath);

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET_NAME,
      Key: r2Key,
      Body: fileStream,
      ContentType: contentType,
    },
    // Limiter la taille des parts et la concurrence pour préserver la RAM (512 Mo dispo sur Render)
    queueSize: 3, 
    partSize: 10 * 1024 * 1024, // 10 MB parts
  });

  /* Optionnel : logger la progression
  upload.on('httpUploadProgress', (progress) => {
    logger.debug(`R2 Upload progress: ${progress.loaded} / ${progress.total}`);
  });
  */

  await upload.done();
  return true;
}

/**
 * Upload directement depuis un buffer/string (pour les scripts)
 */
export async function uploadBufferToR2(bufferOrString, r2Key, contentType) {
  if (!HAS_R2) return false;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET_NAME,
      Key: r2Key,
      Body: bufferOrString,
      ContentType: contentType,
    },
  });

  await upload.done();
  return true;
}

/**
 * Récupère un flux de lecture (stream) depuis R2
 * Utilisé pour injecter le fichier directement dans l'archive ZIP
 */
export async function getR2ReadStream(r2Key) {
  if (!HAS_R2) throw new Error('R2 not configured');

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: r2Key,
  });

  const response = await s3.send(command);
  // response.Body est un ReadableStream (Node.js) avec le SDK v3
  return response.Body;
}

/**
 * Supprime un fichier de R2
 */
export async function deleteFromR2(r2Key) {
  if (!HAS_R2) return false;

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: r2Key,
  });

  await s3.send(command);
  return true;
}

/**
 * Supprime plusieurs fichiers d'un coup de R2
 * @param {string[]} r2Keys - Tableau de clés à supprimer
 */
export async function deleteManyFromR2(r2Keys) {
  if (!HAS_R2 || r2Keys.length === 0) return false;

  const command = new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: r2Keys.map(key => ({ Key: key })),
      Quiet: true,
    },
  });

  await s3.send(command);
  return true;
}

/**
 * Liste tous les fichiers dans un préfixe donné sur R2 (utile pour détecter les orphelins)
 * @param {string} prefix 
 */
export async function listR2Objects(prefix = 'uploads/') {
  if (!HAS_R2) return [];
  
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await s3.send(command);
  return (response.Contents || []).map(obj => obj.Key);
}
