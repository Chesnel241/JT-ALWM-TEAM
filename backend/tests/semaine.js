import { buildWeeks, weekUploadCutoff } from '../src/data/constants.js';

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

/**
 * La semaine où un envoi est accepté **à cet instant**.
 *
 * `semaineActive` ne suffit pas pour envoyer un fichier. La semaine active ne
 * bascule que le lundi à 00:00 (GMT+2), mais ses envois ferment le dimanche à
 * 10h30 (GMT+2). Entre les deux — treize heures et demie chaque semaine — elle
 * est toujours « active » et déjà close : un envoi y reçoit 423.
 *
 * C'est la même panne que celle décrite plus haut, déplacée du lundi au
 * dimanche après-midi. Constatée le dimanche 27 septembre 2026 à 16:39 UTC :
 * `tus-formats` et `portee-acces` échouaient sur 17 tests, avec 42 autres
 * sautés, sans qu'une ligne de code ait changé. L'intégration continue aurait
 * refusé ce jour-là n'importe quelle pull request.
 *
 * Passé la clôture, les envois vont donc à la semaine suivante — exactement
 * ce que fait un correspondant à qui l'écran annonce « Clôturé ».
 */
export function semaineOuverte(maintenant = new Date()) {
  const semaines = buildWeeks(maintenant);
  const active = semaines.find((w) => w.status === 'active');
  const cloture = active ? weekUploadCutoff(active.id) : null;
  if (active && (!cloture || maintenant <= cloture)) return active.id;
  return semaineSuivante(maintenant);
}

/** La semaine suivante, pour vérifier ce qui doit survivre d'une semaine à l'autre. */
export function semaineSuivante(maintenant = new Date()) {
  const semaine = buildWeeks(maintenant).find((w) => w.status === 'upcoming');
  if (!semaine) throw new Error('Aucune semaine à venir : buildWeeks() ne rend rien.');
  return semaine.id;
}
