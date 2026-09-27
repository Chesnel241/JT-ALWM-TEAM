/**
 * Détection automatique du disque persistant (Docker volume / VPS).
 *
 * En production, un volume monté à `/app/uploads` (cf. docker-compose.yml)
 * est utilisé pour tout ce qui doit survivre aux redémarrages : store JSON,
 * fichiers uploadés, logs.
 *
 * Les variables d'environnement restent prioritaires pour les
 * environnements custom (CI, dev local avec docker compose, etc.).
 */

import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RENDER_DISK = '/app/uploads';
const HAS_RENDER_DISK = existsSync(RENDER_DISK);

export function storePath() {
  if (!HAS_RENDER_DISK && process.env.NODE_ENV === 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
    console.warn('⚠️ WARNING: No persistent disk detected and no Upstash Redis configured. Data will be lost on restart.');
  }
  if (process.env.JT_STORE_PATH) return process.env.JT_STORE_PATH;
  if (HAS_RENDER_DISK) return path.join(RENDER_DISK, 'store.json');
  return path.join(process.cwd(), 'uploads', 'store.json');
}

export function uploadsDir() {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  if (HAS_RENDER_DISK) return path.join(RENDER_DISK, 'files');
  return path.join(process.cwd(), 'uploads');
}

/**
 * Dossier des données du serveur : celui du store, sur le volume persistant
 * (`/app/uploads` dans l'image), mais **hors** de `uploadsDir()`.
 *
 * La distinction compte : `uploadsDir()` est servi sans authentification par
 * `/uploads` (app.js), parce que les rushes s'y lisent par URL. Un fichier
 * d'état rangé là devient téléchargeable par quiconque connaît son nom.
 */
export function dataDir() {
  return path.dirname(storePath());
}

export function logsDir() {
  if (process.env.LOG_DIR) return process.env.LOG_DIR;
  if (HAS_RENDER_DISK) return path.join(RENDER_DISK, 'logs');
  return path.join(__dirname, '../../logs');
}

/**
 * Diagnostic — utilisé au démarrage pour tracer les chemins
 * effectivement résolus dans les logs.
 */
export function pathsDiagnostic() {
  return {
    renderDiskDetected: HAS_RENDER_DISK,
    storePath: storePath(),
    uploadsDir: uploadsDir(),
    logsDir: logsDir(),
  };
}
