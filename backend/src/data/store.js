import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../logger/index.js';
import { weekExpiryDate } from './constants.js';
import { storePath } from '../lib/paths.js';
import { Redis } from '@upstash/redis';
import { HAS_R2, deleteManyFromR2, listR2Objects } from '../lib/s3.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = storePath();

// Setup Upstash Redis client if credentials exist
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const REDIS_KEY = 'jt_alwm_store_v1';

// Store local persistant (remplacer par une DB en production).
// Démarre vide en production — les uploads remplissent le store.
const seed = {};

let db = {};

export async function initDb() {
  if (redis) {
    try {
      logger.info('Attempting to load DB from Upstash Redis...');
      const redisData = await redis.get(REDIS_KEY);
      if (redisData) {
        db = typeof redisData === 'string' ? JSON.parse(redisData) : redisData;
        logger.info('DB successfully loaded from Redis');
        persistDbLocal(); // sync it back to the local ephemeral disk
        return;
      }
      logger.info('Redis DB is empty, falling back to local/seed');
    } catch (err) {
      logger.error('Failed to load DB from Redis, falling back to local', { error: err.message });
    }
  }

  if (!existsSync(DB_PATH)) {
    db = JSON.parse(JSON.stringify(seed));
    return;
  }

  try {
    const raw = readFileSync(DB_PATH, 'utf-8');
    db = JSON.parse(raw);
    logger.info('DB loaded from local disk');
  } catch (err) {
    logger.error('Failed to parse local DB', { error: err.message });
    db = JSON.parse(JSON.stringify(seed));
  }
}

// Écriture atomique : tmp file + rename. Évite la corruption du JSON
// si le process meurt en plein write. Suffisant en mono-instance ; pour
// multi-instance il faudrait migrer vers une vraie DB.
function persistDbLocal() {
  try {
    const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(db, null, 2));
    renameSync(tmpPath, DB_PATH);
  } catch (err) {
    logger.error('Failed to persist DB locally', { error: err.message });
  }
}

function persistDb() {
  persistDbLocal();
  
  if (redis) {
    // Fire and forget: sync to Redis asynchronously so we don't block the API
    redis.set(REDIS_KEY, JSON.stringify(db)).catch(err => {
      logger.error('Failed to sync DB to Redis', { error: err.message });
    });
  }
}

// Clés réservées d'une entrée de semaine (`db[weekId][...]`) qui ne sont
// pas des correspondants. `_delivery` = montage final ("JT Prêt").
const RESERVED_WEEK_KEYS = new Set(['_delivery']);

export function getWeekUploads(weekId) {
  const week = db[weekId];
  if (!week) return {};
  // Exclut les clés réservées (deliveries sont récupérées séparément).
  const result = {};
  for (const [k, v] of Object.entries(week)) {
    if (!RESERVED_WEEK_KEYS.has(k)) result[k] = v;
  }
  return result;
}

export function getCountryUploads(weekId, countryId) {
  if (RESERVED_WEEK_KEYS.has(countryId)) return [];
  return db[weekId]?.[countryId] || [];
}

export function getDelivery(weekId) {
  return db[weekId]?._delivery || [];
}

export function addDelivery(weekId, fileData) {
  if (!db[weekId]) db[weekId] = {};
  if (!db[weekId]._delivery) db[weekId]._delivery = [];
  db[weekId]._delivery.push(fileData);
  persistDb();
  return fileData;
}

export function deleteDelivery(weekId, fileId) {
  if (!db[weekId]?._delivery) return false;
  const list = db[weekId]._delivery;
  const index = list.findIndex((f) => f.id === fileId);
  if (index === -1) return false;
  const [removed] = list.splice(index, 1);
  persistDb();
  return removed;
}

export function getCustomCountries() {
  return Array.isArray(db._countries) ? db._countries.slice() : [];
}

export function addCustomCountry(country) {
  if (!db._countries) db._countries = [];
  db._countries.push(country);
  persistDb();
  return country;
}

export function addUpload(weekId, countryId, fileData) {
  if (!db[weekId]) db[weekId] = {};
  if (!db[weekId][countryId]) db[weekId][countryId] = [];
  db[weekId][countryId].push(fileData);
  persistDb();
  return fileData;
}

export function deleteUpload(weekId, countryId, fileId) {
  if (!db[weekId]?.[countryId]) return false;
  const list = db[weekId][countryId];
  const index = list.findIndex((f) => f.id === fileId);
  if (index === -1) return false;
  const [removed] = list.splice(index, 1);
  persistDb();
  return removed;
}

// Clés réservées du store (méta-données qui ne sont pas des semaines).
const META_KEYS = new Set(['_countries']);

function deleteUploadFile(upload, uploadsDir) {
  if (!upload?.filename || !uploadsDir) return false;
  const filePath = join(uploadsDir, upload.filename);
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      logger.info(`File deleted: ${upload.filename}`, {
        context: { filename: upload.filename, uploadId: upload.id },
      });
      return true;
    }
  } catch (err) {
    logger.error(`Failed to delete file: ${upload.filename}`, {
      error: err.message,
      context: { filename: upload.filename },
    });
  }
  return false;
}

export async function cleanupExpiredUploads(_unused, uploadsDir) {
  const now = new Date();
  let removedCount = 0;
  let removedFromDb = 0;
  const removedFiles = [];
  const r2KeysToDelete = new Set();
  const weeksToDelete = [];
  const details = {
    startTime: now.toISOString(),
    errors: [],
  };

  logger.info('Starting cleanup of expired uploads', { context: { uploadsDir } });

  // 1. Identify expired weeks and their R2 keys
  for (const weekId of Object.keys(db)) {
    if (META_KEYS.has(weekId)) continue;

    const expiry = weekExpiryDate(weekId);
    if (!expiry || now < expiry) continue;

    logger.info(`Cleanup: Week ${weekId} expired, preparing to remove uploads`, {
      context: { weekId, expiryDate: expiry.toISOString() },
    });

    const weekUploads = db[weekId];
    if (weekUploads) {
      for (const countryId of Object.keys(weekUploads)) {
        for (const upload of weekUploads[countryId]) {
          if (HAS_R2 && upload.filename) {
            r2KeysToDelete.add(`uploads/${upload.filename}`);
          }
        }
      }
    }
    weeksToDelete.push(weekId);
  }

  // 2. Delete from R2 FIRST (Fix Issue #1: Delete-Before-Confirm Flaw)
  if (r2KeysToDelete.size > 0) {
    try {
      await deleteManyFromR2(Array.from(r2KeysToDelete));
      logger.info(`Deleted ${r2KeysToDelete.size} files from R2 during cleanup`);
    } catch (err) {
      logger.error('Failed to delete files from R2, aborting DB cleanup to prevent orphans', { error: err.message });
      details.errors.push({ phase: 'r2_cleanup_abort', error: err.message });
      return 0; // Abort DB cleanup to ensure we retry next time
    }
  }

  // 3. R2 deletion succeeded. Now delete local files and DB entries.
  for (const weekId of weeksToDelete) {
    const weekUploads = db[weekId];
    if (weekUploads) {
      for (const countryId of Object.keys(weekUploads)) {
        for (const upload of weekUploads[countryId]) {
          if (deleteUploadFile(upload, uploadsDir)) {
            removedCount++;
            removedFiles.push({ weekId, countryId, filename: upload.filename });
          } else if (HAS_R2) {
             removedCount++;
             removedFiles.push({ weekId, countryId, filename: upload.filename });
          }
        }
      }
    }
    delete db[weekId];
    removedFromDb++;
  }

  // 4. Cleanup Local Orphans
  if (existsSync(uploadsDir)) {
    try {
      const physicalFiles = readdirSync(uploadsDir);
      const entries = readdirSync(uploadsDir, { withFileTypes: true });
      for (const file of physicalFiles) {
        if (entries.find((d) => d.name === file)?.isDirectory()) continue;
        if (file.endsWith('.json') || file.endsWith('.tmp')) continue;

        let found = false;
        for (const weekId of Object.keys(db)) {
          if (META_KEYS.has(weekId)) continue;
          for (const countryId of Object.keys(db[weekId])) {
            if (db[weekId][countryId].some((u) => u.filename === file)) {
              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          const filePath = join(uploadsDir, file);
          try {
            if (existsSync(filePath)) {
              unlinkSync(filePath);
              logger.info(`Orphan local file deleted: ${file}`);
            }
          } catch (err) {
            logger.error(`Failed to delete orphan file: ${file}`, { error: err.message });
            details.errors.push({ filename: file, error: err.message });
          }
        }
      }
    } catch (err) {
      logger.error('Error during local orphan cleanup', { error: err.message });
      details.errors.push({ phase: 'local_orphan_cleanup', error: err.message });
    }
  }

  // 5. Cleanup True R2 Orphans (Fix Issue #2: Orphan Cleanup is Local-Only)
  if (HAS_R2) {
    try {
      const allR2Keys = await listR2Objects('uploads/');
      const activeFilenames = new Set();
      
      for (const weekId of Object.keys(db)) {
        if (META_KEYS.has(weekId)) continue;
        for (const countryId of Object.keys(db[weekId])) {
           for (const upload of db[weekId][countryId]) {
              if (upload.filename) activeFilenames.add(`uploads/${upload.filename}`);
           }
        }
      }
      
      const r2Orphans = allR2Keys.filter(key => !activeFilenames.has(key));
      if (r2Orphans.length > 0) {
        // Optionnel : on pourrait utiliser deleteManyFromR2 si c'est supporté par S3 en mode silencieux
        await deleteManyFromR2(r2Orphans);
        logger.info(`Deleted ${r2Orphans.length} true orphan files from R2`);
      }
    } catch(err) {
      logger.error('Error during R2 orphan cleanup', { error: err.message });
      details.errors.push({ phase: 'r2_orphan_cleanup', error: err.message });
    }
  }

  if (removedCount > 0 || removedFromDb > 0) {
    try {
      persistDb();
    } catch (err) {
      logger.error('Failed to persist database after cleanup', {
        error: err.message,
      });
      details.errors.push({ phase: 'persist_db', error: err.message });
    }
  }

  details.endTime = new Date().toISOString();
  logger.cleanupExecuted(removedCount, {
    removedCount,
    removedFromDb,
    filesRemoved: removedFiles,
    errors: details.errors,
  });

  return removedCount;
};
