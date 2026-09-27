/**
 * Compteur d'échecs du mot de passe montage, par adresse.
 *
 * L'INCIDENT : aucune limite ne portait sur les échecs. `requireAdmin` ne
 * subissait que la limite globale (500 requêtes par minute et par adresse), et
 * `/api/auth/check-admin` — qui répond oui ou non, rien d'autre — celle de
 * 100 par minute : plus de 140 000 essais par jour depuis une seule machine,
 * contre le mot de passe qui permet de supprimer des envois, de publier le JT
 * et d'émettre les liens des correspondants.
 *
 * Seuls les ÉCHECS comptent : l'équipe qui travaille n'est jamais freinée,
 * quel que soit son nombre d'actions. Passé le seuil, l'adresse est bloquée
 * jusqu'à ce que ses échecs sortent de la fenêtre — même avec le bon mot de
 * passe, sans quoi le blocage servirait d'oracle.
 *
 * Module pur, comme `fenetreErreurs.js` : le temps est passé en argument,
 * jamais lu ici.
 */

export const FENETRE_ECHECS_MS = 15 * 60 * 1000;
export const MAX_ECHECS = 20;
// Une adresse coûte au plus MAX_ECHECS horodatages. Au-delà de ce nombre
// d'adresses, la moins récemment fautive est oubliée : la mémoire reste bornée
// même face à une rotation d'adresses.
export const MAX_ADRESSES = 10000;

export function creerCompteur({
  fenetreMs = FENETRE_ECHECS_MS,
  max = MAX_ECHECS,
  maxAdresses = MAX_ADRESSES,
} = {}) {
  return { fenetreMs, max, maxAdresses, echecs: new Map() };
}

function recents(compteur, cle, maintenant) {
  const liste = compteur.echecs.get(cle);
  if (!liste) return [];
  const encore = liste.filter((t) => maintenant - t < compteur.fenetreMs);
  if (encore.length > 0) compteur.echecs.set(cle, encore);
  else compteur.echecs.delete(cle);
  return encore;
}

/** Vrai si cette adresse a épuisé ses essais dans la fenêtre. */
export function estBloque(compteur, cle, maintenant) {
  return recents(compteur, cle, maintenant).length >= compteur.max;
}

/** Retient un échec. */
export function noterEchec(compteur, cle, maintenant) {
  const liste = recents(compteur, cle, maintenant);
  liste.push(maintenant);
  if (liste.length > compteur.max) liste.splice(0, liste.length - compteur.max);
  // Retirer puis remettre : la Map garde l'ordre d'insertion, la clé passe
  // donc en dernière position — la plus récemment fautive.
  compteur.echecs.delete(cle);
  compteur.echecs.set(cle, liste);
  if (compteur.echecs.size > compteur.maxAdresses) {
    compteur.echecs.delete(compteur.echecs.keys().next().value);
  }
}

/** Secondes avant que l'adresse puisse réessayer ; 0 si elle n'est pas bloquée. */
export function secondesRestantes(compteur, cle, maintenant) {
  const liste = recents(compteur, cle, maintenant);
  if (liste.length < compteur.max) return 0;
  const liberation = liste[liste.length - compteur.max] + compteur.fenetreMs;
  return Math.max(1, Math.ceil((liberation - maintenant) / 1000));
}
