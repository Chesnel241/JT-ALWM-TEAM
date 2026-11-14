import { useEffect, useRef } from 'react';

/**
 * Relit des informations quand elles ont pu changer, sans que la personne ait
 * à recharger la page.
 *
 * L'INCIDENT (tests de bout en bout, e2e/journalistes.spec.js) : l'espace
 * d'un correspondant ne lisait le serveur qu'à l'ouverture. Un fichier validé
 * ou refusé par le montage, un délai accordé, le JT publié : rien ne
 * s'affichait tant qu'il ne rechargeait pas la page — et beaucoup ne savent
 * pas le faire sur un téléphone. Le montage, lui, reçoit ces nouvelles en
 * direct ; les correspondants n'ont pas ce canal (il demande le mot de passe
 * de l'équipe).
 *
 * Trois moments suffisent, et coûtent une requête légère chacun :
 *
 * - la page redevient visible (on revient de WhatsApp, on rallume l'écran) ;
 * - la connexion revient ;
 * - toutes les minutes tant que la page est à l'écran — toutes les trois
 *   minutes en mode économe (lib/connexion.js).
 *
 * Jamais quand la page est cachée ou hors ligne, et jamais deux fois en moins
 * de cinq secondes (un retour au premier plan déclenche souvent `focus` et
 * `visibilitychange` ensemble).
 */
export const INTERVALLE_MS = 60_000;
export const INTERVALLE_ECONOME_MS = 180_000;
export const ECART_MIN_MS = 5_000;

export function useRafraichissement(relire, { actif = true, intervalle = INTERVALLE_MS } = {}) {
  // La fonction change à chaque rendu ; l'abonnement, lui, ne doit pas être
  // refait pour autant.
  const derniere = useRef(relire);
  derniere.current = relire;

  useEffect(() => {
    if (!actif) return undefined;
    // L'ouverture de la page vient de tout lire : on part de maintenant.
    let dernierPassage = Date.now();
    const passer = () => {
      if (document.visibilityState === 'hidden') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const maintenant = Date.now();
      if (maintenant - dernierPassage < ECART_MIN_MS) return;
      dernierPassage = maintenant;
      try {
        derniere.current?.();
      } catch {
        // Une relecture manquée n'est pas une panne : la suivante la rattrape.
      }
    };
    const econome = document.documentElement.hasAttribute('data-econome');
    const minuteur = setInterval(passer, econome ? Math.max(intervalle, INTERVALLE_ECONOME_MS) : intervalle);
    document.addEventListener('visibilitychange', passer);
    window.addEventListener('focus', passer);
    window.addEventListener('online', passer);
    return () => {
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', passer);
      window.removeEventListener('focus', passer);
      window.removeEventListener('online', passer);
    };
  }, [actif, intervalle]);
}
