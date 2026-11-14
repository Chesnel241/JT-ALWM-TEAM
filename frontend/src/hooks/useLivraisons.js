import { useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';
import { useRafraichissement } from './useRafraichissement.js';

/**
 * Le JT publié pour la semaine, s'il l'est. Silencieux en cas d'échec :
 * l'accueil et l'espace du pays restent utilisables hors ligne.
 *
 * La liste est relue quand la page revient à l'écran, puis de temps en
 * temps (useRafraichissement.js) : « En préparation » devenait « Disponible »
 * seulement après un rechargement de la page.
 */
export function useLivraisons(weekId) {
  const [livraisons, setLivraisons] = useState([]);
  const semaine = useRef(weekId);
  semaine.current = weekId;

  useEffect(() => {
    if (!weekId || typeof api.getDeliveries !== 'function') {
      setLivraisons([]);
      return undefined;
    }
    let alive = true;
    Promise.resolve()
      .then(() => api.getDeliveries(weekId))
      .then((liste) => { if (alive) setLivraisons(Array.isArray(liste) ? liste : []); })
      .catch(() => { if (alive) setLivraisons([]); });
    return () => { alive = false; };
  }, [weekId]);

  useRafraichissement(() => {
    Promise.resolve()
      .then(() => api.getDeliveries(weekId))
      // Une relecture manquée garde la liste connue : mieux vaut un JT
      // affiché une minute de trop qu'un JT qui disparaît à chaque coupure.
      .then((liste) => { if (semaine.current === weekId && Array.isArray(liste)) setLivraisons(liste); })
      .catch(() => {});
  }, { actif: Boolean(weekId) && typeof api.getDeliveries === 'function' });

  return livraisons;
}
