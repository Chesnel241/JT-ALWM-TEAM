/**
 * Les réglages partagés des tests de bout en bout : ports, mot de passe du
 * montage (propre aux tests, jamais celui d'un déploiement), dossiers.
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ICI = dirname(fileURLToPath(import.meta.url));

export const BANC = join(ICI, '../.banc');
export const DOSSIER_FICHIERS = join(BANC, 'fichiers');
export const PORT_API = Number(process.env.E2E_PORT_API || 3110);
export const PORT_APP = Number(process.env.E2E_PORT_APP || 5175);
export const URL_API = `http://127.0.0.1:${PORT_API}`;
export const URL_APP = `http://127.0.0.1:${PORT_APP}`;
export const MOT_DE_PASSE_MONTAGE = 'e2e-montage';
