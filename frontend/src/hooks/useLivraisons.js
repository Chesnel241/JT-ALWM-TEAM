import { useEffect, useState } from 'react';
import { api } from '../api/index.js';

/**
 * Le JT publié pour la semaine, s'il l'est. Silencieux en cas d'échec :
 * l'accueil et l'espace du pays restent utilisables hors ligne.
 */
export function useLivraisons(weekId) {
  const [livraisons, setLivraisons] = useState([]);
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
  return livraisons;
}
