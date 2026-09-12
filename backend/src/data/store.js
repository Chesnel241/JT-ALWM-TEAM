import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { readFile, writeFile, unlink, readdir, rename, mkdir, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../logger/index.js';
import { weekExpiryDate, weekUploadCutoff } from './constants.js';
import { storePath } from '../lib/paths.js';
import { Redis } from '@upstash/redis';


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

  // Run data migrations
  if (Array.isArray(db._countries)) {
    let migrated = false;
    db._countries.forEach(c => {
      // Nettoyage au cas où c'est un nombre ou un string
      if (String(c.code).trim() === '254') {
        c.code = 'KE';
        migrated = true;
      }
      if (String(c.id).trim() === '254') {
        c.id = 'ke';
        migrated = true;
      }
      if (String(c.name).trim() === '254') {
        c.name = 'Kenya';
        migrated = true;
      }
    });

    if (migrated) {
      // Migrer aussi les données d'uploads associées à l'ID 254
      for (const weekId of Object.keys(db)) {
        if (META_KEYS && META_KEYS.has(weekId)) continue;
        if (db[weekId] && db[weekId]['254']) {
          db[weekId]['ke'] = db[weekId]['254'];
          delete db[weekId]['254'];
        }
        if (db[weekId] && Array.isArray(db[weekId]._subscriptions)) {
          db[weekId]._subscriptions.forEach(sub => {
            if (String(sub.countryId).trim() === '254') {
              sub.countryId = 'ke';
            }
          });
        }
      }
      logger.info('Migrated country 254 to KE/Kenya');
      persistDb();
    }
  }

  migrateSujets();
}

/**
 * Crée un sujet par étiquette de reportage rencontrée, et rattache les
 * fichiers existants.
 *
 * Sans perte : un fichier sans étiquette rejoint le premier sujet du pays,
 * exactement comme l'affichage le faisait déjà en balayant les envois
 * antérieurs au découpage vers la section 1. Idempotent — un fichier qui a
 * déjà son `sujetId` n'est pas retouché — donc rejouable à chaque démarrage.
 */
function migrateSujets() {
  let touched = 0;

  for (const weekId of Object.keys(db)) {
    if (META_KEYS.has(weekId)) continue;
    const week = db[weekId];
    if (!week || typeof week !== 'object') continue;

    for (const countryId of Object.keys(week)) {
      if (RESERVED_WEEK_KEYS.has(countryId) || countryId === '_subscriptions' || countryId === '_extensions') continue;
      const files = week[countryId];
      if (!Array.isArray(files) || files.length === 0) continue;
      if (files.every((f) => f?.sujetId)) continue;

      const store = sujetsOf(weekId);
      // Un sujet par étiquette distincte, dans l'ordre où elles apparaissent.
      const parLabel = new Map();
      for (const [id, sujet] of Object.entries(store)) {
        if (sujet.countryId === countryId && sujet.titre) parLabel.set(sujet.titre, id);
      }

      const ensure = (titre) => {
        if (parLabel.has(titre)) return parLabel.get(titre);
        const sujet = {
          id: randomUUID(),
          weekId,
          countryId,
          titre,
          auteur: '',
          etat: ETATS_SUJET.RECU,
          creeLe: new Date().toISOString(),
        };
        store[sujet.id] = sujet;
        parLabel.set(titre, sujet.id);
        return sujet.id;
      };

      // Premier passage : les fichiers étiquetés fixent l'ordre des sujets.
      for (const file of files) {
        if (!file || file.sujetId) continue;
        const label = String(file.reportage || '').trim();
        if (label) file.sujetId = ensure(label);
      }

      // Second passage : les fichiers sans étiquette rejoignent le premier
      // sujet du pays, celui qui les affichait déjà.
      const premier = getSujets(weekId, countryId)[0];
      const repli = premier ? premier.id : null;
      for (const file of files) {
        if (!file || file.sujetId) continue;
        file.sujetId = repli || ensure('Reportage 1');
      }

      for (const file of files) {
        if (file?.sujetId) touched++;
      }

      // L'état de chaque sujet découle des fichiers déjà reçus.
      for (const sujet of Object.values(store)) {
        if (sujet.countryId !== countryId) continue;
        sujet.etat = etatDeduit(files.filter((f) => f?.sujetId === sujet.id));
      }
    }
  }

  if (touched) {
    logger.info('Sujets créés depuis les étiquettes de reportage', { context: { fichiers: touched } });
    persistDb();
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
// pas des correspondants. `_delivery` = montage final ("JT Prêt"),
// `_timeline` = projet de montage partagé entre les postes de travail.
const RESERVED_WEEK_KEYS = new Set(['_delivery', '_timeline', '_sujets', '_subscriptions', '_extensions']);

/**
 * Un identifiant de pays ne commence jamais par un tiret bas : c'est la marque
 * des clés internes. La règle vaut mieux que la liste, qui était incomplète —
 * `_subscriptions` remontait jusque dans la barre latérale de la rédaction
 * comme un pays nommé « _subscriptions », avec le compte des numéros WhatsApp
 * en guise de nombre de fichiers.
 */
function isInternalKey(key) {
  return typeof key === 'string' && (key.startsWith('_') || RESERVED_WEEK_KEYS.has(key));
}

// --------------------------------------------------------------------------
// SUJETS
// --------------------------------------------------------------------------

/**
 * Un sujet est l'unité de travail éditoriale : un reportage avec un titre,
 * un auteur et un état. Avant, « Reportage 2 » n'était qu'une étiquette texte
 * posée sur chaque fichier, et le rattachement se faisait par égalité de
 * chaîne — une faute de frappe ou un changement de langue suffisait à séparer
 * en deux ce qui était un seul reportage. La rédaction recevait des noms de
 * fichiers à réinterpréter plutôt qu'un objet qui a un sens.
 *
 * Les sujets vivent dans `db[weekId]._sujets`, à côté des pays, plutôt que
 * dans la liste des fichiers : `getWeekUploads` écarte déjà les clés
 * réservées, donc tout ce qui lit les envois aujourd'hui continue de
 * fonctionner sans rien savoir des sujets.
 */

export const ETATS_SUJET = Object.freeze({
  ATTENDU: 'attendu',
  RECU: 'recu',
  A_CORRIGER: 'a_corriger',
  VALIDE: 'valide',
  AU_CONDUCTEUR: 'au_conducteur',
});

const ETATS_VALIDES = new Set(Object.values(ETATS_SUJET));

export function isEtatSujet(value) {
  return ETATS_VALIDES.has(String(value || '').trim());
}

function sujetsOf(weekId) {
  if (!db[weekId]) db[weekId] = {};
  if (!db[weekId]._sujets || typeof db[weekId]._sujets !== 'object' || Array.isArray(db[weekId]._sujets)) {
    db[weekId]._sujets = {};
  }
  return db[weekId]._sujets;
}

/** Sujets d'une semaine, éventuellement filtrés sur un pays. */
export function getSujets(weekId, countryId) {
  const all = Object.values(db[weekId]?._sujets || {});
  const list = countryId ? all.filter((s) => s.countryId === countryId) : all;
  // Ordre d'apparition : c'est celui dans lequel le correspondant les a créés,
  // et celui que la rédaction lit ensuite.
  return list
    .slice()
    .sort((a, b) => String(a.creeLe || '').localeCompare(String(b.creeLe || '')))
    .map((s) => ({ ...s }));
}

export function getSujet(weekId, sujetId) {
  const found = db[weekId]?._sujets?.[sujetId];
  return found ? { ...found } : null;
}

export function createSujet(weekId, countryId, { titre = '', auteur = '' } = {}) {
  const store = sujetsOf(weekId);
  const sujet = {
    id: randomUUID(),
    weekId,
    countryId,
    titre: String(titre || '').trim(),
    auteur: String(auteur || '').trim(),
    etat: ETATS_SUJET.ATTENDU,
    creeLe: new Date().toISOString(),
  };
  store[sujet.id] = sujet;
  persistDb();
  return { ...sujet };
}

/** Renomme un sujet. Le titre est ce que la rédaction voit. */
export function renameSujet(weekId, sujetId, titre) {
  const sujet = db[weekId]?._sujets?.[sujetId];
  if (!sujet) return null;
  sujet.titre = String(titre || '').trim();
  persistDb();
  return { ...sujet };
}

export function updateSujetEtat(weekId, sujetId, etat) {
  const sujet = db[weekId]?._sujets?.[sujetId];
  if (!sujet || !isEtatSujet(etat)) return null;
  sujet.etat = etat;
  persistDb();
  return { ...sujet };
}

export function deleteSujet(weekId, sujetId) {
  const store = db[weekId]?._sujets;
  if (!store?.[sujetId]) return false;
  delete store[sujetId];
  persistDb();
  return true;
}

/**
 * État déduit des fichiers reçus, quand personne ne l'a fixé à la main.
 * Un rush refusé prime : c'est la seule information qui appelle une action.
 */
export function etatDeduit(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) return ETATS_SUJET.ATTENDU;
  if (list.some((f) => f?.status === 'rejected')) return ETATS_SUJET.A_CORRIGER;
  if (list.every((f) => f?.status === 'approved')) return ETATS_SUJET.VALIDE;
  return ETATS_SUJET.RECU;
}

export function getWeekUploads(weekId) {
  const week = db[weekId];
  if (!week) return {};
  // Exclut les clés réservées (deliveries sont récupérées séparément).
  const result = {};
  for (const [k, v] of Object.entries(week)) {
    if (!isInternalKey(k) && Array.isArray(v)) result[k] = v;
  }
  return result;
}

export function getCountryUploads(weekId, countryId) {
  if (isInternalKey(countryId)) return [];
  const list = db[weekId]?.[countryId];
  return Array.isArray(list) ? list : [];
}

export function getDelivery(weekId) {
  return db[weekId]?._delivery || [];
}

export function getTimelineWorkspace(weekId) {
  const workspace = db[weekId]?._timeline;
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) return null;
  // Ne jamais exposer une référence mutable vers le store en mémoire.
  return JSON.parse(JSON.stringify(workspace));
}

export function saveTimelineWorkspace(weekId, workspace) {
  if (!db[weekId]) db[weekId] = {};
  const previousRevision = Number(db[weekId]._timeline?.revision) || 0;
  const saved = {
    clips: Array.isArray(workspace?.clips) ? workspace.clips : [],
    overlays: Array.isArray(workspace?.overlays) ? workspace.overlays : [],
    branding: workspace?.branding && typeof workspace.branding === 'object'
      ? workspace.branding
      : {},
    revision: previousRevision + 1,
    updatedAt: new Date().toISOString(),
  };
  // Copie profonde pour empêcher une mutation ultérieure du body Express.
  db[weekId]._timeline = JSON.parse(JSON.stringify(saved));
  persistDb();
  return getTimelineWorkspace(weekId);
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

// ---- Gestion des Thèmes / Préférences ----
export function getThemes() {
  return Array.isArray(db._themes) ? db._themes.slice() : [];
}

export function saveTheme(theme) {
  if (!db._themes) db._themes = [];
  const existingIndex = db._themes.findIndex((t) => t.id === theme.id);
  if (existingIndex >= 0) {
    db._themes[existingIndex] = theme;
  } else {
    db._themes.push({ ...theme, id: theme.id || Date.now().toString() });
  }
  persistDb();
  return theme;
}

export function deleteTheme(themeId) {
  if (!db._themes) return false;
  const initialLength = db._themes.length;
  db._themes = db._themes.filter((t) => t.id !== themeId);
  if (db._themes.length < initialLength) {
    persistDb();
    return true;
  }
  return false;
}

// Clés internes du modèle (db[weekId][...]) qui ne sont PAS des
// correspondants. addUpload doit refuser tout countryId qui collide
// avec ces clés — défense en profondeur si un appelant contourne la
// validation route-level.
const RESERVED_FOR_UPLOAD = new Set(['_delivery', '_subscriptions', '_extensions', '_timeline']);

export function addUpload(weekId, countryId, fileData) {
  if (RESERVED_FOR_UPLOAD.has(countryId)) {
    throw new Error(`countryId reserved: ${countryId}`);
  }
  if (!db[weekId]) db[weekId] = {};
  if (!db[weekId][countryId]) db[weekId][countryId] = [];

  // Marquer "EN RETARD" si uploadé après le cutoff initial
  const cutoff = weekUploadCutoff(weekId);
  if (cutoff && new Date() > cutoff) {
    fileData.isLate = true;
  }

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
  const existingIdx = subs.findIndex(sub => sub.countryId === countryId);
  if (existingIdx !== -1) {
    subs[existingIdx] = { countryId, phone, timestamp: new Date().toISOString() };
    persistDb();
  } else if (!subs.some(sub => sub.phone === phone)) {
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

/**
 * Met à jour la taille affichée d'un fichier après compression serveur.
 * Retourne le fichier mis à jour, ou null s'il a disparu entre-temps
 * (suppression par un monteur pendant l'encodage).
 */
export function updateUploadSize(weekId, countryId, fileId, sizeLabel) {
  const list = db[weekId]?.[countryId];
  if (!Array.isArray(list)) return null;
  const file = list.find((f) => f && f.id === fileId);
  if (!file) return null;
  file.size = sizeLabel;
  persistDb();
  return file;
}

/**
 * Attache au fichier le nom de sa copie légère, une fois fabriquée.
 *
 * Le master garde son `filename` : rien de ce qui l'adresse ne bouge, et
 * l'export continue de repartir de lui. Seuls l'aperçu et le montage
 * préfèrent `proxyFilename` quand il existe. `proxySize` sert à afficher le
 * poids réellement transféré au navigateur.
 */
export function setUploadProxy(weekId, countryId, fileId, proxyFilename, proxySize) {
  const list = db[weekId]?.[countryId];
  if (!Array.isArray(list)) return null;
  const file = list.find((f) => f && f.id === fileId);
  if (!file) return null;
  file.proxyFilename = proxyFilename || '';
  if (proxySize) file.proxySize = proxySize;
  persistDb();
  return file;
}

/**
 * Pays propriétaire d'un fichier, ou '' s'il est introuvable ou s'il s'agit
 * d'un JT publié. Sert à ne prévenir que le correspondant concerné quand un
 * rush est refusé, plutôt que d'annoncer à tous les pays qu'un rush a été
 * refusé quelque part.
 */
export function findUploadCountry(weekId, fileId) {
  const week = db[weekId];
  if (!week) return '';
  for (const key of Object.keys(week)) {
    if (key === '_delivery' || key === '_subscriptions') continue;
    const list = week[key];
    if (Array.isArray(list) && list.some((f) => f && f.id === fileId)) return key;
  }
  return '';
}

/**
 * Rappels d'échéance déjà envoyés, pour ne jamais prévenir deux fois le même
 * pays pour la même semaine — y compris après un redémarrage du serveur.
 * La clé est `weekId:countryId`.
 */
export function wasReminderSent(weekId, countryId) {
  return Boolean(db._reminders && db._reminders[`${weekId}:${countryId}`]);
}

export function markReminderSent(weekId, countryId) {
  if (!db._reminders) db._reminders = {};
  db._reminders[`${weekId}:${countryId}`] = new Date().toISOString();
  persistDb();
}

/**
 * Registre des liens personnels émis — `{ [id]: { id, pays, nom, emisLe,
 * revoqueLe } }`.
 *
 * Tant que le lien ne faisait qu'attribuer un envoi, ne rien retenir était
 * défendable. Dès lors qu'il ouvre une porte, il faut pouvoir la refermer :
 * un lien circule par WhatsApp, il se transfère et il part avec un téléphone
 * perdu. Sans ce registre, le seul recours serait de changer
 * REPORTER_TOKEN_SECRET — ce qui coupe tout le monde d'un coup.
 *
 * On n'y stocke jamais le jeton lui-même, seulement son identifiant : le
 * lien reste un secret que le serveur ne sait pas relire.
 */
export function enregistrerLien({ id, pays, nom = '' }) {
  if (!id) return null;
  if (!db._liens) db._liens = {};
  const entree = {
    id,
    pays: String(pays || '').trim().toLowerCase(),
    nom: String(nom || '').trim().slice(0, 60),
    emisLe: new Date().toISOString(),
    revoqueLe: null,
  };
  db._liens[id] = entree;
  persistDb();
  return { ...entree };
}

export function revoquerLien(id) {
  if (!id || !db._liens || !db._liens[id]) return null;
  if (db._liens[id].revoqueLe) return { ...db._liens[id] };
  db._liens[id].revoqueLe = new Date().toISOString();
  persistDb();
  return { ...db._liens[id] };
}

export function listerLiens() {
  if (!db._liens) return [];
  return Object.values(db._liens).map((l) => ({ ...l }));
}

/**
 * Un identifiant inconnu n'est PAS révoqué : les liens émis avant ce
 * registre n'ont jamais été enregistrés, et doivent continuer de marcher.
 * Révoquer est un geste explicite, jamais un effet de bord.
 */
export function estLienRevoque(id) {
  if (!id || !db._liens) return false;
  return Boolean(db._liens[id]?.revoqueLe);
}

// Clés réservées du store (méta-données qui ne sont pas des semaines).
// `_liens` en fait partie : sans ça, les balayages de purge liraient le
// registre des liens comme s'il s'agissait d'une semaine de reportages.
const META_KEYS = new Set(['_countries', '_themes', '_reminders', '_liens']);

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
      if (RESERVED_WEEK_KEYS.has(countryId) || countryId === '_subscriptions') continue;
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
  // La copie légère part avec son master. La balayeuse d'orphelins la
  // rattraperait après 24 h, mais s'en remettre à elle laisserait le disque
  // porter deux fois le poids d'une semaine entière pendant une journée.
  if (upload.proxyFilename) {
    const proxyPath = join(uploadsDir, upload.proxyFilename);
    try {
      if (existsSync(proxyPath)) await unlink(proxyPath);
    } catch (err) {
      logger.warn(`Proxy non supprimé: ${upload.proxyFilename}`, { error: err.message });
    }
  }
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

  const weeksToDelete = [];
  const details = {
    startTime: now.toISOString(),
    errors: [],
  };

  logger.info('Starting cleanup of expired uploads', { context: { uploadsDir } });

  // 1. Identify expired weeks
  for (const weekId of Object.keys(db)) {
    if (META_KEYS.has(weekId)) continue;

    const expiry = weekExpiryDate(weekId);
    if (!expiry || now < expiry) continue;

    logger.info(`Cleanup: Week ${weekId} expired, preparing to remove uploads`, {
      context: { weekId, expiryDate: expiry.toISOString() },
    });

    weeksToDelete.push(weekId);
  }

  // 3. Delete local files and DB entries.
  for (const weekId of weeksToDelete) {
    const weekUploads = db[weekId];
    if (weekUploads) {
      for (const countryId of Object.keys(weekUploads)) {
        if (RESERVED_WEEK_KEYS.has(countryId) || countryId === '_subscriptions') continue;
        const uploads = weekUploads[countryId];
        if (!Array.isArray(uploads)) continue;
        for (const upload of uploads) {
          if (await deleteUploadFile(upload, uploadsDir)) {
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
      // Un upload TUS de 20 Go n'est inséré dans le store qu'À LA FIN
      // (onUploadFinish) : pendant le transfert (plusieurs dizaines de
      // minutes), son binaire est "orphelin" du point de vue du store. Sans
      // ce garde-fou d'âge, le sweep horaire SUPPRIMAIT le master en plein
      // téléversement → transfert détruit, non reprenable, à chaque heure.
      // On ne purge donc jamais un fichier récemment modifié.
      const ORPHAN_MIN_AGE_MS = Number(process.env.ORPHAN_MIN_AGE_MS) || 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      for (const file of physicalFiles) {
        if (entries.find((d) => d.name === file)?.isDirectory()) continue;
        // Les `.json` sont les fiches compagnes que @tus/file-store écrit à
        // côté de chaque envoi. On ne les balaie pas directement — elles
        // partent avec leur binaire, plus bas — sinon un envoi en cours
        // perdrait le décompte de ce qu'il a déjà reçu.
        if (file.endsWith('.json') || file.endsWith('.tmp')) continue;

        // Skip les fichiers récents (upload potentiellement en cours).
        try {
          const st = await stat(join(uploadsDir, file));
          if (nowMs - st.mtimeMs < ORPHAN_MIN_AGE_MS) continue;
        } catch { continue; /* disparu entre-temps */ }

        let found = false;
        for (const weekId of Object.keys(db)) {
          if (META_KEYS.has(weekId)) continue;
          for (const countryId of Object.keys(db[weekId])) {
            const uploads = db[weekId][countryId];
            // Une copie légère est référencée par `proxyFilename`, pas par
            // `filename` : sans ce test, la balayeuse la prendrait pour un
            // orphelin et supprimerait le proxy d'un master bien vivant,
            // 24 h après sa fabrication.
            if (Array.isArray(uploads)
              && uploads.some((u) => u.filename === file || u.proxyFilename === file)) {
              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          // Un envoi interrompu plus de 24 h voyait son binaire supprimé et
          // sa fiche compagne survivre : à la reprise, le serveur annonçait
          // un décalage qui ne correspondait plus à rien, et le transfert
          // repartait corrompu. Mieux vaut repartir de zéro proprement.
          const compagnon = join(uploadsDir, `${file}.json`);
          if (existsSync(compagnon)) {
            try { await unlink(compagnon); } catch { /* déjà parti */ }
          }
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

// ----------------------------------------------------------------------------
// DELAYS & EXTENSIONS
// ----------------------------------------------------------------------------

export function getExtensions(weekId) {
  if (!db._extensions) return { global: null, requests: {} };
  return db._extensions[weekId] || { global: null, requests: {} };
}

export function requestExtension(weekId, countryId) {
  if (!db._extensions) db._extensions = {};
  if (!db._extensions[weekId]) db._extensions[weekId] = { global: null, requests: {} };
  
  const reqs = db._extensions[weekId].requests;
  if (!reqs[countryId]) {
    reqs[countryId] = {
      requestedAt: new Date().toISOString(),
      status: 'pending',
      durationMinutes: 0,
      extendedUntil: null
    };
    persistDb();
  }
  return reqs[countryId];
}

export function approveExtension(weekId, countryId, minutes) {
  if (!db._extensions) db._extensions = {};
  if (!db._extensions[weekId]) db._extensions[weekId] = { global: null, requests: {} };
  
  const cutoff = weekUploadCutoff(weekId);
  if (!cutoff) throw new Error('Invalid weekId for extension');
  
  const reqs = db._extensions[weekId].requests;
  const extendedDate = new Date();
  extendedDate.setMinutes(extendedDate.getMinutes() + minutes); // from now!

  reqs[countryId] = {
    ...reqs[countryId],
    status: 'approved',
    durationMinutes: minutes,
    extendedUntil: extendedDate.toISOString(),
    approvedAt: new Date().toISOString()
  };
  
  persistDb();
  return reqs[countryId];
}

export function setGlobalExtension(weekId, minutes) {
  if (!db._extensions) db._extensions = {};
  if (!db._extensions[weekId]) db._extensions[weekId] = { global: null, requests: {} };
  
  const cutoff = weekUploadCutoff(weekId);
  if (!cutoff) throw new Error('Invalid weekId for extension');
  
  const extendedDate = new Date();
  extendedDate.setMinutes(extendedDate.getMinutes() + minutes); // from now
  
  db._extensions[weekId].global = {
    durationMinutes: minutes,
    extendedUntil: extendedDate.toISOString(),
    setAt: new Date().toISOString()
  };
  
  persistDb();
  return db._extensions[weekId].global;
}

/**
 * Statistiques + demandes de délai, dans la forme EXACTE attendue par
 * StatsView (front) :
 *   {
 *     delaysByWeek:        { [weekId]: { global, requests } },  // par semaine
 *     lateUploadsByCountry:{ [countryId]: number },
 *     extensionsByCountry: { [countryId]: number },
 *     totalByCountry:      { [countryId]: number },
 *   }
 * Bug historique : cette fonction renvoyait un objet plat
 * `{ [countryId]: {...} }` → l'admin (Stats & Délais) lisait
 * `data.delaysByWeek[week]` qui n'existait pas → "Aucune demande de délai"
 * même quand un pays avait bien demandé un délai. Les monteurs ne
 * recevaient donc jamais les demandes à valider.
 */
export function getStats() {
  const lateUploadsByCountry = {};
  const totalByCountry = {};

  Object.keys(db).forEach((weekId) => {
    if (weekId.startsWith('20')) { // ressemble à un weekId (YYYY-wWW)
      const week = db[weekId];
      for (const [countryId, files] of Object.entries(week)) {
        if (countryId && typeof countryId === 'string' && !countryId.startsWith('_') && Array.isArray(files)) {
          totalByCountry[countryId] = (totalByCountry[countryId] || 0) + files.length;
          lateUploadsByCountry[countryId] = (lateUploadsByCountry[countryId] || 0) + files.filter((f) => f.isLate).length;
        }
      }
    }
  });

  const extensionsByCountry = {};
  if (db._extensions) {
    Object.keys(db._extensions).forEach((weekId) => {
      const requests = db._extensions[weekId]?.requests;
      if (requests) {
        Object.keys(requests).forEach((countryId) => {
          extensionsByCountry[countryId] = (extensionsByCountry[countryId] || 0) + 1;
        });
      }
    });
  }

  // Copie profonde pour ne jamais exposer une référence mutable du store.
  const delaysByWeek = db._extensions ? JSON.parse(JSON.stringify(db._extensions)) : {};

  return { delaysByWeek, lateUploadsByCountry, extensionsByCountry, totalByCountry };
}
