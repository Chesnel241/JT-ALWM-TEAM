/**
 * Les chutiers de l'espace montage : où ranger « Rushes reçus ».
 *
 * L'espace montage a quatre onglets — Rushes reçus, Montage du JT, Jingles,
 * Livraison — et un seul état pour dire où l'on est : le « chutier » ouvert.
 * Un pays, le conducteur ou le Mot du JT sont des chutiers de rushes ; le
 * studio, les jingles et la livraison sont d'autres écrans.
 *
 * L'INCIDENT (tests de bout en bout, e2e/montage.spec.js) : l'onglet Jingles,
 * ajouté après les autres, n'avait pas été retiré de ce que « Rushes reçus »
 * considère comme un chutier. Après un passage par Jingles, cliquer « Rushes
 * reçus » rouvrait… les jingles, et l'onglet restait souligné au mauvais
 * endroit. Il n'y avait plus moyen de revenir aux rushes sans recharger.
 */
export const ECRANS_HORS_RUSHES = ['studio', 'delivery', 'jingles'];

/** Vrai pour un pays ou une rubrique, faux pour le studio, les jingles, la livraison. */
export function estChutier(bin) {
  return Boolean(bin) && !ECRANS_HORS_RUSHES.includes(bin);
}

/**
 * Le chutier que « Rushes reçus » doit rouvrir : le dernier consulté pendant
 * cette visite, sinon celui gardé en mémoire pour la semaine, sinon le premier
 * pays qui a envoyé quelque chose, sinon `defaut`.
 */
export function chutierARouvrir({ dernier, memorise, avecEnvois = [], estValide = () => true, defaut }) {
  return [dernier, memorise, ...avecEnvois].find((bin) => estChutier(bin) && estValide(bin)) || defaut;
}

/**
 * Faut-il rouvrir l'écran mémorisé à la place de l'écran courant, qui n'a
 * rien à montrer ?
 *
 * Oui à l'ouverture de la page (rien n'est encore choisi) : on retrouve
 * l'écran où l'on était. Non quand le monteur vient de demander les rushes et
 * que la mémoire désigne les jingles, le studio ou la livraison : sans cette
 * garde, tant qu'aucun pays n'avait envoyé de fichier, « Rushes reçus »
 * renvoyait aussitôt au dernier écran visité.
 */
export function doitRestaurer({ courant, memorise, estValide = () => true }) {
  if (!memorise || !estValide(memorise)) return false;
  return !estChutier(courant) || estChutier(memorise);
}
