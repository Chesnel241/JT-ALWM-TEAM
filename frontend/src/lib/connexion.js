/**
 * Le mode « connexion faible », posé tout seul.
 *
 * LE BESOIN : beaucoup de correspondants envoient depuis une 3G partagée,
 * avec le mode économie de données activé. Les animations décoratives en
 * boucle (ciel qui dérive, bord de la zone de dépôt qui défile, reflets de
 * l'écran du JT) n'y apportent rien et coûtent de la batterie sur des
 * téléphones modestes. Quand le navigateur signale une connexion lente ou
 * l'économie de données, on pose `data-econome` sur <html> ; la feuille de
 * style coupe alors ces boucles. Les animations qui disent quelque chose —
 * l'envoi en cours, le compte à rebours — restent.
 */

const LENTS = new Set(['slow-2g', '2g', '3g']);

/** Pur : décide à partir de ce que le navigateur annonce. */
export function estConnexionFaible({ connection = null, donneesReduites = false } = {}) {
  if (donneesReduites) return true;
  if (!connection) return false;
  if (connection.saveData) return true;
  return LENTS.has(String(connection.effectiveType || ''));
}

/**
 * Suit l'état et pose l'attribut. Renvoie la fonction qui arrête le suivi.
 */
export function suivreConnexion(win = typeof window !== 'undefined' ? window : null) {
  if (!win?.document) return () => {};
  const racine = win.document.documentElement;
  const connection = win.navigator?.connection || null;
  const requete = win.matchMedia ? win.matchMedia('(prefers-reduced-data: reduce)') : null;

  const appliquer = () => {
    const faible = estConnexionFaible({ connection, donneesReduites: Boolean(requete?.matches) });
    if (faible) racine.setAttribute('data-econome', '');
    else racine.removeAttribute('data-econome');
  };

  appliquer();
  connection?.addEventListener?.('change', appliquer);
  requete?.addEventListener?.('change', appliquer);
  return () => {
    connection?.removeEventListener?.('change', appliquer);
    requete?.removeEventListener?.('change', appliquer);
  };
}
