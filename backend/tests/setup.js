import { mkdtempSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Isolation des tests : store JSON + uploads dans un répertoire temporaire
// unique. On chdir dans ce dossier pour que les chemins relatifs utilisés
// par multer (`uploads/`) et par les routes (`process.cwd()/uploads`)
// pointent vers le tmpdir au lieu de polluer backend/uploads/.
const tmpRoot = mkdtempSync(join(tmpdir(), 'jt-alwm-tests-'));
mkdirSync(join(tmpRoot, 'uploads'), { recursive: true });

process.env.JT_STORE_PATH = join(tmpRoot, 'store.json');
process.env.LOG_DIR = join(tmpRoot, 'logs');
process.env.UPLOADS_DIR = join(tmpRoot, 'uploads');
process.env.NODE_ENV = 'test';
process.env.GLOBAL_RATE_LIMIT_MAX_REQUESTS = '10000';
process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
process.env.CREATE_RATE_LIMIT_MAX = '10000';
process.chdir(tmpRoot);

export const TEST_UPLOADS_DIR = join(tmpRoot, 'uploads');
