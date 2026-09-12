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

export function saveAdminPassword(motDePasse) {
  try {
    sessionStorage.setItem(CLE, motDePasse);
  } catch {
    // Pas de stockage : le mot de passe reste en mémoire pour cette vue.
  }
}
