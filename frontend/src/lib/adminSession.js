/**
 * Mot de passe de l'équipe montage pour la session en cours.
 *
 * Il est posé par l'espace montage après connexion (DashboardView) et relu
 * par les écrans partagés entre les deux équipes, qui n'ont pas de formulaire
 * à eux. sessionStorage peut lever en navigation privée : l'absence de mot
 * de passe est un cas normal, jamais une erreur — l'écran se comporte alors
 * comme celui d'un correspondant.
 */
const CLE = 'jt-admin-pass';

export function readAdminPassword() {
  try {
    return sessionStorage.getItem(CLE) || '';
  } catch {
    return '';
  }
}

const EVENEMENT = 'jt-admin-session';

export function saveAdminPassword(motDePasse) {
  try {
    sessionStorage.setItem(CLE, motDePasse);
  } catch {
    // Pas de stockage : le mot de passe reste en mémoire pour cette vue.
  }
  // Les autres écrans du montage sont déjà montés, cachés : ils ont lu la
  // session à l'ouverture de la page, quand elle était encore vide. On les
  // prévient, avec le mot de passe (le stockage peut manquer).
  try {
    window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: motDePasse }));
  } catch {
    // Pas de fenêtre (tests, rendu hors navigateur) : rien à prévenir.
  }
}

/**
 * Prévient quand le mot de passe du montage vient d'être reconnu par un
 * écran, quel qu'il soit. Rend la fonction de désabonnement.
 *
 * L'INCIDENT (tests de bout en bout, e2e/montage.spec.js) : l'espace montage
 * déverrouillé, « Programmation » et « Stats & Délais » redemandaient le mot
 * de passe — et inversement. Chaque écran ne lisait la session qu'une fois, à
 * l'ouverture de la page.
 */
export function surSessionMontage(rappel) {
  const ecoute = (e) => {
    const motDePasse = (typeof e?.detail === 'string' && e.detail) || readAdminPassword();
    if (motDePasse) rappel(motDePasse);
  };
  window.addEventListener(EVENEMENT, ecoute);
  return () => window.removeEventListener(EVENEMENT, ecoute);
}
