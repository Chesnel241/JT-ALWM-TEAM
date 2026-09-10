/**
 * Transition d'écran native.
 *
 * `document.startViewTransition` laisse le navigateur photographier l'écran
 * avant et après un changement d'état, puis interpoler entre les deux. Le
 * fondu et le glissement sont décrits en CSS, ne coûtent aucun kilo-octet de
 * JavaScript et tournent sur le fil de composition — ce qui compte quand la
 * plateforme s'ouvre surtout sur des téléphones d'entrée de gamme.
 *
 * Trois raisons de s'en passer sans rien casser : le navigateur ne connaît
 * pas l'API, la personne a demandé moins de mouvement, ou une transition est
 * déjà en cours. Dans ces cas la mise à jour s'applique directement.
 */

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function supportsViewTransitions() {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
}

/**
 * Applique `update` dans une transition de vue quand c'est possible.
 * @param {() => void} update  mise à jour d'état, synchrone
 * @param {string} [name]      nom posé sur la racine, pour choisir l'animation
 */
export function withViewTransition(update, name = '') {
  if (!supportsViewTransitions() || prefersReducedMotion()) {
    update();
    return;
  }

  const root = document.documentElement;
  if (name) root.dataset.transition = name;

  try {
    const transition = document.startViewTransition(() => update());
    transition.finished
      .catch(() => {})
      .finally(() => {
        if (root.dataset.transition === name) delete root.dataset.transition;
      });
  } catch {
    // Une transition déjà en cours rejette l'appel : on applique quand même.
    if (name) delete root.dataset.transition;
    update();
  }
}
