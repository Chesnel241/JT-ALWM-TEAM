/**
 * L'installation de la plateforme sur l'écran d'accueil (Android).
 *
 * Chrome n'émet `beforeinstallprompt` qu'une fois, tôt, au chargement : il
 * faut l'écouter dès le démarrage et garder l'événement pour le moment où le
 * correspondant touche « Ajouter à l'écran d'accueil ». Sur iPhone, rien de
 * tout cela n'existe : on affiche le geste à faire dans Safari.
 */
let differe = null;
const abonnes = new Set();

function prevenir() {
  for (const f of abonnes) f(Boolean(differe));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    differe = e;
    prevenir();
  });
  window.addEventListener('appinstalled', () => {
    differe = null;
    prevenir();
  });
}

export function peutInstaller() {
  return Boolean(differe);
}

/** S'abonne aux changements ; renvoie la fonction de désabonnement. */
export function suivreInstallation(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/** Ouvre la fenêtre d'installation du navigateur. Vrai si acceptée. */
export async function installer() {
  if (!differe) return false;
  const e = differe;
  differe = null;
  prevenir();
  try {
    await e.prompt();
    const choix = await e.userChoice;
    return choix?.outcome === 'accepted';
  } catch {
    return false;
  }
}

/** iPhone ou iPad : on y décrit le geste au lieu de proposer un bouton. */
export function estAppareilApple(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && typeof document !== 'undefined' && 'ontouchend' in document);
}
