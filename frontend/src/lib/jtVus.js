/**
 * Les JT déjà vus ou téléchargés sur CET appareil.
 *
 * Sert la pastille « Nouveau » : sur l'écran du JT comme sur l'accueil, elle
 * reste tant que l'appareil n'a ni regardé ni téléchargé le JT. Ce n'est pas
 * une mémoire de pays : un identifiant de fichier, rien d'autre.
 */

const CLE_VUS = 'jt-alwm-jt-vus';

export function lireVus() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_VUS) || '[]');
    return new Set(Array.isArray(brut) ? brut : []);
  } catch {
    return new Set();
  }
}

export function ecrireVus(vus) {
  try {
    // Les cinquante derniers suffisent : un an de JT, sans encombrer.
    localStorage.setItem(CLE_VUS, JSON.stringify([...vus].slice(-50)));
  } catch {
    // Stockage indisponible : la pastille reviendra, rien de plus.
  }
}

/** Vrai si au moins un des JT publiés n'a pas encore été vu ici. */
export function aDuNouveau(livraisons, vus = lireVus()) {
  return Array.isArray(livraisons) && livraisons.some((l) => l?.id && !vus.has(l.id));
}
