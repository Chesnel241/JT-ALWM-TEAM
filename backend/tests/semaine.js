import { buildWeeks } from '../src/data/constants.js';

/**
 * La semaine sur laquelle une suite de tests doit travailler.
 *
 * Les tests figeaient `2026-w37`. C'était la semaine active le jour où ils ont
 * été écrits — et ils ont commencé à échouer le dimanche suivant, dès que sa
 * clôture est passée : un envoi y recevait 423 au lieu de 201. Quelques jours
 * plus tard, la semaine sort de la fenêtre glissante de `buildWeeks()` et les
 * routes répondent 404, ce qui casse tout le reste.
 *
 * Une suite qui ne passe que la semaine de son écriture ne teste rien : elle
 * annonce une panne tous les lundis, et on finit par ne plus la lire.
 */

/** La semaine en cours de collecte. C'est celle où un envoi est accepté. */
export function semaineActive(maintenant = new Date()) {
  const semaine = buildWeeks(maintenant).find((w) => w.status === 'active');
  if (!semaine) throw new Error('Aucune semaine active : buildWeeks() ne rend rien.');
  return semaine.id;
}

/** La semaine suivante, pour vérifier ce qui doit survivre d'une semaine à l'autre. */
export function semaineSuivante(maintenant = new Date()) {
  const semaine = buildWeeks(maintenant).find((w) => w.status === 'upcoming');
  if (!semaine) throw new Error('Aucune semaine à venir : buildWeeks() ne rend rien.');
  return semaine.id;
}
