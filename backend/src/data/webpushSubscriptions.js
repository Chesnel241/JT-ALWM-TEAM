import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE_PATH = join(__dirname, '../../../uploads/webpush_subscriptions.json');

// In-memory cache
let subscriptions = {};

async function loadDb() {
  if (!existsSync(FILE_PATH)) {
    return;
  }
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf-8');
    subscriptions = JSON.parse(raw);
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

export async function addSubscription(subscription) {
  if (!subscription || !subscription.endpoint) return;
  subscriptions[subscription.endpoint] = subscription;
  await persistDb();
}

export async function removeSubscription(endpoint) {
  if (!endpoint || !subscriptions[endpoint]) return;
  delete subscriptions[endpoint];
  await persistDb();
}

export function getSubscriptions() {
  return Object.values(subscriptions);
}
