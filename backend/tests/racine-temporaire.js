import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Une seule racine temporaire pour toute la suite, supprimée à la fin.
 *
 * L'INCIDENT : `setup.js` s'exécute une fois par fichier de test et créait
 * chaque fois son dossier dans /tmp, sans jamais le retirer — 71 dossiers
 * par passage, plus de 6 600 accumulés sur la machine de développement.
 * `setup.js` crée désormais ses dossiers sous cette racine, que le
 * `teardown` efface d'un coup.
 */
export default function preparer(projet) {
  const racine = mkdtempSync(join(tmpdir(), 'jt-alwm-tests-'));
  projet.provide('racineTests', racine);
  return () => rmSync(racine, { recursive: true, force: true });
}
