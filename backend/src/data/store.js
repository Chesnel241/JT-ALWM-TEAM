import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../logger/index.js';
import { weekExpiryDate } from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.JT_STORE_PATH || join(__dirname, 'store.json');

// Store local persistant (remplacer par une DB en production).
// Démarre vide en production — les uploads remplissent le store.
const seed = {};

function loadDb() {
  if (!existsSync(DB_PATH)) {
    return JSON.parse(JSON.stringify(seed));
  }

  try {
    const raw = readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(seed));
  }
}

// Écriture atomique : tmp file + rename. Évite la corruption du JSON
// si le process meurt en plein write. Suffisant en mono-instance ; pour
// multi-instance il faudrait migrer vers une vraie DB.
function persistDb() {
  const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(db, null, 2));
  renameSync(tmpPath, DB_PATH);
}

const db = loadDb();

export function getWeekUploads(weekId) {
  return db[weekId] || {};
}

export function getCountryUploads(weekId, countryId) {
  return db[weekId]?.[countryId] || [];
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

export function cleanupExpiredUploads(_unused, uploadsDir) {
  const now = new Date();
  let removedCount = 0;
  let removedFromDb = 0;
  const removedFiles = [];
  const details = {
    startTime: now.toISOString(),
    errors: [],
  };

  logger.info('Starting cleanup of expired uploads', { context: { uploadsDir } });

  // Itère sur toutes les clés du store et purge celles dont l'ID
  // identifie une semaine expirée (= mercredi 00:00 de la semaine
  // suivante atteint). Les IDs qui ne sont pas au format `YYYY-wWW`
  // (anciennes données de test, métadonnées, etc.) sont ignorés ici.
  for (const weekId of Object.keys(db)) {
    if (META_KEYS.has(weekId)) continue;

    const expiry = weekExpiryDate(weekId);
    if (!expiry) {
      logger.debug(`Skipping unrecognised weekId during cleanup: ${weekId}`);
      continue;
    }
    if (now < expiry) {
      logger.debug(`Week ${weekId} not yet expired`, {
        context: { weekId, expiryDate: expiry.toISOString() },
      });
      continue;
    }

    logger.info(`Cleanup: Week ${weekId} expired, removing uploads`, {
      context: { weekId, expiryDate: expiry.toISOString() },
    });

    const weekUploads = db[weekId];
    if (weekUploads) {
      for (const countryId of Object.keys(weekUploads)) {
        for (const upload of weekUploads[countryId]) {
          if (deleteUploadFile(upload, uploadsDir)) {
            removedCount++;
            removedFiles.push({ weekId, countryId, filename: upload.filename });
          }
        }
      }
    }

    delete db[weekId];
    removedFromDb++;
  }

  // Nettoyer les fichiers orphelins (dans le dossier mais pas dans la DB)
  if (existsSync(uploadsDir)) {
    try {
      const physicalFiles = readdirSync(uploadsDir);
      const entries = readdirSync(uploadsDir, { withFileTypes: true });
      for (const file of physicalFiles) {
        // Ignorer les sous-dossiers (ex: logs/ si LOG_DIR pointe ici)
        if (entries.find((d) => d.name === file)?.isDirectory()) continue;

        // Vérifier si ce fichier est référencé dans la DB
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

        // Si pas trouvé, c'est un orphelin - le supprimer
        if (!found) {
          const filePath = join(uploadsDir, file);
          try {
            unlinkSync(filePath);
            removedCount++;
            logger.info(`Orphan file deleted: ${file}`, {
              context: { filename: file, reason: 'orphaned' },
            });
            removedFiles.push({ filename: file, reason: 'orphaned' });
          } catch (err) {
            logger.error(`Failed to delete orphan file: ${file}`, {
              error: err.message,
              context: { filename: file },
            });
            details.errors.push({ filename: file, error: err.message });
          }
        }
      }
    } catch (err) {
      logger.error('Error during orphan file cleanup', {
        error: err.message,
        context: { uploadsDir },
      });
      details.errors.push({ phase: 'orphan_cleanup', error: err.message });
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
