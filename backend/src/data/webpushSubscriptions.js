import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE_PATH = join(__dirname, '../../../uploads/webpush_subscriptions.json');

/**
 * Abonnements push, indexés par endpoint.
 *
 * Chaque entrée porte désormais un contexte : à quelle équipe appartient
 * l'appareil, et pour quel pays s'il s'agit d'un correspondant. Sans ce
 * contexte, la seule diffusion possible était « tout le monde reçoit tout » :
 * un correspondant gabonais était réveillé à chaque dépôt de fichier ivoirien,
 * ce qui est du bruit et révèle au passage qui envoie quoi.
 *
 * Les entrées écrites avant cette version sont de simples objets
 * `PushSubscription` sans contexte. Elles sont lues avec l'audience
 * `unknown` : elles continuent de recevoir les annonces destinées à tous
 * (le JT est prêt) et plus jamais le détail du travail des autres.
 */

// In-memory cache
let subscriptions = {};

export const AUDIENCES = Object.freeze({
  EDITOR: 'editor',
  REPORTER: 'reporter',
  UNKNOWN: 'unknown',
});

function normalizeAudience(value) {
  const clean = String(value || '').trim().toLowerCase();
  return clean === AUDIENCES.EDITOR || clean === AUDIENCES.REPORTER
    ? clean
    : AUDIENCES.UNKNOWN;
}

function normalizeCountryId(value) {
  const clean = String(value || '').trim().toLowerCase();
  return /^[a-z0-9-]{2,12}$/.test(clean) ? clean : '';
}

// Une entrée du fichier → une forme unique { subscription, audience, countryId }.
function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.subscription && entry.subscription.endpoint) {
    return {
      subscription: entry.subscription,
      audience: normalizeAudience(entry.audience),
      countryId: normalizeCountryId(entry.countryId),
    };
  }
  // Ancien format : l'objet EST l'abonnement.
  if (entry.endpoint) {
    return { subscription: entry, audience: AUDIENCES.UNKNOWN, countryId: '' };
  }
  return null;
}

async function loadDb() {
  if (!existsSync(FILE_PATH)) {
    return;
  }
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    subscriptions = {};
    for (const [endpoint, entry] of Object.entries(parsed || {})) {
      const normalized = normalizeEntry(entry);
      if (normalized) subscriptions[endpoint] = normalized;
    }
  } catch (err) {
    logger.error('Failed to load webpush subscriptions', { error: err.message });
  }
}

async function persistDb() {
  try {
    const tmpPath = `${FILE_PATH}.${Date.now()}.${Math.floor(Math.random() * 10000)}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(subscriptions, null, 2));
    await fs.rename(tmpPath, FILE_PATH);
  } catch (err) {
    logger.error('Failed to persist webpush subscriptions', { error: err.message });
  }
}

export async function initWebPushDb() {
  await loadDb();
}

/**
 * @param {object} subscription  PushSubscription du navigateur
 * @param {{audience?: string, countryId?: string}} [context]
 */
export async function addSubscription(subscription, context = {}) {
  if (!subscription || !subscription.endpoint) return;
  subscriptions[subscription.endpoint] = {
    subscription,
    audience: normalizeAudience(context.audience),
    countryId: normalizeCountryId(context.countryId),
  };
  await persistDb();
}

export async function removeSubscription(endpoint) {
  if (!endpoint || !subscriptions[endpoint]) return;
  delete subscriptions[endpoint];
  await persistDb();
}

/**
 * Abonnements filtrés.
 *
 * @param {{audiences?: string[], countryId?: string}} [filter]
 *   `audiences` : équipes visées. Omis = tout le monde.
 *   `countryId` : restreint aux appareils déclarés sur ce pays.
 */
export function getSubscriptions(filter = {}) {
  const audiences = Array.isArray(filter.audiences) && filter.audiences.length
    ? new Set(filter.audiences.map(normalizeAudience))
    : null;
  const countryId = normalizeCountryId(filter.countryId);

  return Object.values(subscriptions).filter((entry) => {
    if (audiences && !audiences.has(entry.audience)) return false;
    if (countryId && entry.countryId !== countryId) return false;
    return true;
  });
}
