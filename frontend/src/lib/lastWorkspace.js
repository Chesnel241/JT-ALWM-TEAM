import { WORKSPACES } from './routing.js';

/**
 * Dernier espace utilisé sur cet appareil.
 *
 * Une application installée démarre toujours sur la même adresse : un
 * manifeste ne sait pas qui l'ouvre. Or `/` est historiquement l'entrée de
 * l'équipe montage, si bien qu'un correspondant qui ajoutait la plateforme à
 * son écran d'accueil retombait dans le studio à chaque lancement.
 *
 * On mémorise donc l'espace fréquenté, et `/` — et lui seul — s'y réfère.
 * Une adresse explicite (`/monteurs`, `/journalistes/ga`) reste souveraine :
 * elle n'est jamais réécrite d'après ce souvenir.
 */

const KEY = 'last_workspace';

export function readLastWorkspace() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === WORKSPACES.REPORTER || saved === WORKSPACES.EDITOR ? saved : '';
  } catch {
    return '';
  }
}

export function saveLastWorkspace(workspace) {
  if (workspace !== WORKSPACES.REPORTER && workspace !== WORKSPACES.EDITOR) return;
  try {
    localStorage.setItem(KEY, workspace);
  } catch {
    /* stockage indisponible : `/` garde son comportement historique */
  }
}
