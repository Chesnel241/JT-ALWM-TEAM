import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'store.json');

// Store local persistant (remplacer par une DB en production)
const seed = {
  'w-43': {
    sn: [
      {
        id: 'seed-1',
        name: 'rush_manifestation_dakar.mp4',
        type: 'video',
        size: '450 MB',
        status: 'completed',
        uploadedAt: new Date().toISOString(),
      },
      {
        id: 'seed-2',
        name: 'script_manifestation.txt',
        type: 'script',
        size: '12 KB',
        status: 'completed',
        content: 'Le rassemblement a commencé à 10h...',
        uploadedAt: new Date().toISOString(),
      },
    ],
  },
};

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

function persistDb() {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const db = loadDb();

export function getWeekUploads(weekId) {
  return db[weekId] || {};
}

export function getCountryUploads(weekId, countryId) {
  return db[weekId]?.[countryId] || [];
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

function parseWeekEndDate(week) {
  if (!week?.dates) return null;
  const parts = week.dates.split('-').map((p) => p.trim());
  if (parts.length < 2) return null;
  const end = parts[1];
  const [dayStr, monthStr] = end.split(' ');
  const day = Number(dayStr);
  const months = {
    jan: 0,
    fev: 1,
    mar: 2,
    avr: 3,
    mai: 4,
    jun: 5,
    jul: 6,
    aou: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const key = monthStr?.toLowerCase().slice(0, 3);
  if (!day || !months.hasOwnProperty(key)) return null;
  const year = new Date().getFullYear();
  return new Date(year, months[key], day, 23, 59, 59, 999);
}

function deleteUploadFile(upload, uploadsDir) {
  if (!upload?.filename || !uploadsDir) return;
  const filePath = join(uploadsDir, upload.filename);
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // Best-effort cleanup
  }
}

export function cleanupExpiredUploads(weeks, uploadsDir) {
  const now = new Date();
  let removedCount = 0;

  for (const week of weeks) {
    if (week.status !== 'archived') continue;
    const endDate = parseWeekEndDate(week);
    if (!endDate) continue;
    const expiry = new Date(endDate.getTime() + 48 * 60 * 60 * 1000);
    if (now <= expiry) continue;

    const weekUploads = db[week.id];
    if (!weekUploads) continue;

    for (const countryId of Object.keys(weekUploads)) {
      for (const upload of weekUploads[countryId]) {
        deleteUploadFile(upload, uploadsDir);
        removedCount += 1;
      }
    }

    delete db[week.id];
  }

  if (removedCount > 0) persistDb();
  return removedCount;
}
