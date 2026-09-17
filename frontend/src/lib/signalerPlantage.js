/**
 * Signaler au serveur qu'un écran du studio s'est effondré.
 *
 * POURQUOI ICI, ET PAS PAR `@sentry/react`
 * ----------------------------------------
 * `VITE_SENTRY_DSN` était documenté dans trois fichiers sans qu'aucun code
 * Sentry n'existe côté navigateur : une variable fantôme de plus. Le studio
 * signale donc à **son propre backend**, qui relaie. Pas de script tiers chez
 * les monteurs, pas de second projet à surveiller, pas de poids supplémentaire
 * dans un paquet qui voyage jusqu'à des connexions médiocres.
 *
 * DEUX RÈGLES
 * -----------
 * 1. **Ne jamais lever.** Ce code s'exécute depuis `ErrorBoundary`, c'est-à-dire
 *    au pire moment. Un rapporteur qui échoue remplacerait l'écran d'erreur par
 *    une page blanche — le monteur ne saurait même plus quoi vous dire. C'est
 *    la convention `useOptionalToast` : une feuille n'abat pas son parent.
 * 2. **Ne dépendre de rien.** La base de l'API est relue ici plutôt
 *    qu'importée de `api/index.js`, qui tire axios, l'i18n et l'identité du
 *    correspondant. Si le plantage vient de l'un d'eux, le rapporteur doit
 *    quand même partir. La duplication d'une ligne est le prix de cette
 *    indépendance, et elle est voulue.
 *
 * Aucun en-tête d'authentification n'accompagne l'envoi : la route est
 * publique par nécessité (on peut planter avant l'écran de connexion), et lui
 * confier un mot de passe n'apporterait rien.
 */

const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

export const CHEMIN_SIGNALEMENT = '/api/client-error';

const BORNES = { message: 500, stack: 4000, composant: 200 };

function lireLangue() {
  try {
    const l = localStorage.getItem('jt-alwm-lang');
    return l === 'fr' || l === 'en' ? l : '';
  } catch {
    return '';
  }
}

/** Le corps envoyé. Pur : c'est lui qu'on teste. */
export function corpsDuSignalement(erreur, infos = {}) {
  const texte = (v, max) => String(v ?? '').slice(0, max);
  return {
    message: texte(erreur?.message ?? erreur, BORNES.message),
    stack: texte(erreur?.stack, BORNES.stack),
    composant: texte(infos?.componentStack, BORNES.composant),
    // Le chemin seul : la query string peut porter un jeton.
    url: typeof location !== 'undefined' ? String(location.pathname || '') : '',
    langue: lireLangue(),
  };
}

/**
 * Envoie le signalement. Retourne `true` si l'envoi a été tenté.
 * @param {unknown} erreur
 * @param {{componentStack?: string}} infos
 * @param {{fetch?: typeof fetch}} [options] - point d'injection pour les tests
 */
export function signalerPlantage(erreur, infos = {}, options = {}) {
  try {
    const envoyer = options.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!envoyer) return false;

    const promesse = envoyer(`${BASE}${CHEMIN_SIGNALEMENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpsDuSignalement(erreur, infos)),
      // La page est peut-être sur le point d'être rechargée par le monteur.
      keepalive: true,
    });
    // Un rejet asynchrone non traité ferait du bruit dans la console au moment
    // où l'on a le plus besoin de la lire.
    if (promesse && typeof promesse.catch === 'function') promesse.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export default signalerPlantage;
