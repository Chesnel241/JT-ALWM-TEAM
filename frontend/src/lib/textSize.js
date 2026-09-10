/**
 * Taille de lecture, mémorisée par appareil.
 *
 * Une partie des correspondants sont des personnes âgées qui consultent la
 * plateforme sur un téléphone. Le réglage agit sur la taille de base du
 * document plutôt que sur des tailles de police isolées : les espacements et
 * les hauteurs étant en rem, les boutons grandissent avec le texte au lieu de
 * le laisser déborder de cadres figés.
 */

const KEY = 'reader_text_size';
export const TEXT_SIZES = Object.freeze({ NORMAL: 'normal', LARGE: 'large' });

export function readTextSize() {
  try {
    return localStorage.getItem(KEY) === TEXT_SIZES.LARGE
      ? TEXT_SIZES.LARGE
      : TEXT_SIZES.NORMAL;
  } catch {
    return TEXT_SIZES.NORMAL;
  }
}

export function saveTextSize(size) {
  try {
    if (size === TEXT_SIZES.LARGE) localStorage.setItem(KEY, TEXT_SIZES.LARGE);
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le réglage vaut pour la session en cours */
  }
}

/** Applique le réglage au document. */
export function applyTextSize(size) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (size === TEXT_SIZES.LARGE) root.setAttribute('data-text-size', TEXT_SIZES.LARGE);
  else root.removeAttribute('data-text-size');
}
