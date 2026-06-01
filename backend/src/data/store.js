import { existsSync } from 'fs';
import { readFile, writeFile, unlink, readdir, rename, mkdir } from 'fs/promises';
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
let redis = null;
if (redisUrl && redisToken) {
  try {
    redis = new Redis({ url: redisUrl, token: redisToken });
  } catch (err) {
    logger.error('Invalid Upstash Redis configuration', { error: err.message });
  }
}
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
    const raw = await readFile(DB_PATH, 'utf-8');
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
// Écrit le store sur le disque local (write atomique via tmp + rename).
// `snapshot` = JSON déjà sérialisé (réutilisé pour Redis, évite un 2e
// stringify). Si absent, sérialise db courant.
async function persistDbLocalRaw(snapshot) {
  try {
    await mkdir(dirname(DB_PATH), { recursive: true });
    // tmp unique pour éviter ENOENT pendant rename si writes concurrents.
    const tmpPath = `${DB_PATH}.${process.pid}.${Date.now()}.${Math.floor(Math.random() * 10000)}.tmp`;
    await writeFile(tmpPath, snapshot != null ? snapshot : JSON.stringify(db));
    await rename(tmpPath, DB_PATH);
  } catch (err) {
    logger.error('Failed to persist DB locally', { error: err.message });
  }
}

// Variante immédiate (chargement initial depuis Redis → sync disque).
async function persistDbLocal() {
  return persistDbLocalRaw(null);
}

function persistDb() {
  schedulePersist();
}

// Écriture debouncée : chaque mutation marque le store "sale" et programme un
// flush. On coalesce les rafales (30 users qui uploadent → des dizaines de
// mutations/s) en une seule écriture disque + Redis. Le `maxWait` garantit
// qu'on ne repousse pas indéfiniment si les mutations sont continues.
let dirty = false;
let debounceTimer = null;
let firstDirtyAt = 0;
let flushing = false;
const PERSIST_DEBOUNCE_MS = Number(process.env.PERSIST_DEBOUNCE_MS) || 1500;
const PERSIST_MAX_WAIT_MS = Number(process.env.PERSIST_MAX_WAIT_MS) || 5000;

async function flushPersist() {
  if (!dirty || flushing) return;
  flushing = true;
  dirty = false;
  firstDirtyAt = 0;
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  // Snapshot pour que les mutations pendant l'await ré-arment proprement.
  const snapshot = JSON.stringify(db);
  try {
    await persistDbLocalRaw(snapshot);
    if (redis) {
      await redis.set(REDIS_KEY, snapshot).catch((err) => {
        logger.error('Failed to sync DB to Redis', { error: err.message });
      });
    }
  } finally {
    flushing = false;
    // Une mutation est arrivée pendant le flush → reprogramme.
    if (dirty) schedulePersist();
  }
}

function schedulePersist() {
  const now = Date.now();
  if (!dirty) { dirty = true; firstDirtyAt = now; }
  const waited = now - firstDirtyAt;
  // Si on a déjà attendu le max, flush tout de suite ; sinon (re)debounce.
  const delay = waited >= PERSIST_MAX_WAIT_MS ? 0 : Math.min(PERSIST_DEBOUNCE_MS, PERSIST_MAX_WAIT_MS - waited);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { flushPersist(); }, delay);
}

// Flush synchrone best-effort à l'arrêt du process pour ne pas perdre les
// dernières mutations (déploiement, redémarrage conteneur).
async function flushOnExit(signal) {
  try {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    if (dirty) { dirty = true; await flushPersist(); }
  } catch { /* best effort */ }
  if (signal) process.exit(0);
}
// Enregistre les handlers une seule fois par process (les tests réimportent
// le module via vi.resetModules() → éviter l'accumulation de listeners).
if (!globalThis.__jtStoreExitHooks) {
  globalThis.__jtStoreExitHooks = true;
  process.once('SIGTERM', () => flushOnExit('SIGTERM'));
  process.once('SIGINT', () => flushOnExit('SIGINT'));
  process.once('beforeExit', () => flushOnExit(null));
}

// Exposé pour les tests / shutdown explicite.
export async function flushStore() {
  await flushPersist();
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

// Clés internes du modèle (db[weekId][...]) qui ne sont PAS des
// correspondants. addUpload doit refuser tout countryId qui collide
// avec ces clés — défense en profondeur si un appelant contourne la
// validation route-level.
const RESERVED_FOR_UPLOAD = new Set(['_delivery', '_subscriptions']);

export function addUpload(weekId, countryId, fileData) {
  if (RESERVED_FOR_UPLOAD.has(countryId)) {
    throw new Error(`countryId reserved: ${countryId}`);
  }
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

export function addSubscription(weekId, countryId, phone) {
  if (!db[weekId]) db[weekId] = {};
  if (!db[weekId]._subscriptions) db[weekId]._subscriptions = [];
  
  const subs = db[weekId]._subscriptions;
  // Prevent duplicate numbers
  if (!subs.some(sub => sub.phone === phone)) {
    subs.push({ countryId, phone, timestamp: new Date().toISOString() });
    persistDb();
  }
  return { success: true };
}

export function getSubscriptions(weekId) {
  if (!db[weekId]?._subscriptions) return [];
  return db[weekId]._subscriptions;
}

export function updateFileStatus(weekId, fileId, status, feedback) {
  if (!db[weekId]) return false;
  
  let targetFile = null;

  // Check in deliveries
  if (db[weekId]._delivery) {
    targetFile = db[weekId]._delivery.find(f => f.id === fileId);
  }

  // Check in countries
  if (!targetFile) {
    for (const key of Object.keys(db[weekId])) {
      if (key === '_delivery' || key === '_subscriptions') continue;
      const list = db[weekId][key];
      if (Array.isArray(list)) {
        targetFile = list.find(f => f.id === fileId);
        if (targetFile) break;
      }
    }
  }

  if (targetFile) {
    targetFile.status = status || 'pending';
    if (feedback !== undefined) targetFile.feedback = feedback;
    persistDb();
    return targetFile;
  }

  return false;
}

// Clés réservées du store (méta-données qui ne sont pas des semaines).
const META_KEYS = new Set(['_countries']);

export function getFileMetadata(filename) {
  for (const weekId of Object.keys(db)) {
    if (META_KEYS.has(weekId)) continue;
    const weekData = db[weekId];
    if (typeof weekData !== 'object' || !weekData) continue;
    
    // Check deliveries
    if (weekData._delivery) {
      const found = weekData._delivery.find(f => f.filename === filename);
      if (found) return { ...found, weekId, countryId: '_delivery' };
    }
    
    // Check countries
    for (const countryId of Object.keys(weekData)) {
      if (countryId === '_delivery' || countryId === '_subscriptions') continue;
      const list = weekData[countryId];
      if (Array.isArray(list)) {
        const found = list.find(f => f.filename === filename);
        if (found) return { ...found, weekId, countryId };
      }
    }
  }
  return null;
}

export function getStore() {
  return db;
}

async function deleteUploadFile(upload, uploadsDir) {
  if (!upload?.filename || !uploadsDir) return false;
  const filePath = join(uploadsDir, upload.filename);
  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
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
          if (await deleteUploadFile(upload, uploadsDir)) {
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
      const physicalFiles = await readdir(uploadsDir);
      const entries = await readdir(uploadsDir, { withFileTypes: true });
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
              await unlink(filePath);
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

  // 6. Cleanup Editor Exports (older than 48h)
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const exportsDir = path.join(uploadsDir, 'exports');
    if (existsSync(exportsDir)) {
      const exportFiles = await fs.readdir(exportsDir);
      const fortyEightHoursAgo = now.getTime() - (48 * 60 * 60 * 1000);
      
      for (const file of exportFiles) {
        if (file === '.gitkeep') continue;
        const filePath = path.join(exportsDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < fortyEightHoursAgo) {
          await fs.unlink(filePath);
          logger.info(`Deleted expired export file: ${file}`);
        }
      }
    }
  } catch (err) {
    logger.error('Error during exports cleanup', { error: err.message });
    details.errors.push({ phase: 'exports_cleanup', error: err.message });
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
