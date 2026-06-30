/**
 * Détection automatique du disque persistant Render.
 *
 * Render monte le disque à `/app/uploads` (cf. render.yaml). Si ce
 * dossier existe, on l'utilise pour tout ce qui doit survivre aux
 * redéploiements : store JSON, fichiers uploadés, logs.
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
    console.warn('⚠️ WARNING: No persistent Render disk detected and no Upstash Redis configured. Data will be lost on restart.');
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

export function logsDir() {
  if (process.env.LOG_DIR) return process.env.LOG_DIR;
  if (HAS_RENDER_DISK) return path.join(RENDER_DISK, 'logs');
  return path.join(__dirname, '../../logs');
}

/**
 * Diagnostic — utilisé au démarrage pour tracer les chemins
 * effectivement résolus dans les logs Render.
 */
export function pathsDiagnostic() {
  return {
    renderDiskDetected: HAS_RENDER_DISK,
    storePath: storePath(),
    uploadsDir: uploadsDir(),
    logsDir: logsDir(),
  };
}
