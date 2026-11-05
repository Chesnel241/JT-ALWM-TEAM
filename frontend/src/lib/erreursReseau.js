/**
 * Ce qu'on dit quand un envoi ou une requête échoue.
 *
 * L'INCIDENT : un correspondant voyait s'afficher, tel quel, le message
 * technique de la bibliothèque d'envoi — « tus: failed to upload chunk at
 * offset 0, caused by [object ProgressEvent], originated from request
 * (method: PATCH, url: …, response code: n/a…) ». En anglais, sans dire
 * quoi faire. Ici, un message par cas, dans la langue de l'écran, qui dit
 * ce qui se passe et ce qu'on peut faire.
 *
 * `e` est le bloc `errors` du dictionnaire (`tStatic().errors`).
 */
export function messageErreur(statut, e) {
  const s = Number(statut) || 0;
  if (s === 0) return e.horsLigne;
  if (s === 401) return e.lienInvalide;
  if (s === 403) return e.horsPays;
  if (s === 404) return e.introuvable;
  if (s === 413) return e.tropGros;
  if (s === 415) return e.formatRefuse;
  if (s === 423) return e.delaiPasse;
  if (s === 429) return e.tropDeDemandes;
  if (s === 502 || s === 503 || s === 504) return e.miseAJour;
  if (s >= 500) return e.serveurIndisponible;
  return e.envoiEchoue;
}
