import { getWeekUploads, getCustomCountries } from '../data/store.js';
import { COUNTRIES, SPECIAL_BUCKETS } from '../data/constants.js';

/**
 * Ce qui manque, pays par pays, pour la semaine en cours.
 *
 * Le rappel automatique ne visait que les pays dont le chutier était
 * COMPLÈTEMENT vide. Un pays qui avait déposé une photo, ou un script sans
 * vidéo, était considéré comme servi et n'était jamais relancé — alors
 * qu'aucun de ces envois ne fait un reportage.
 *
 * La règle retenue est celle du journal : un pays est en règle quand il a
 * envoyé au moins une VIDÉO. Le reste est utile, mais ne se monte pas.
 *
 * Une seule définition, partagée par le rappel automatique et par le panneau
 * de relance de l'équipe montage : les deux disaient sinon deux choses
 * différentes du même pays.
 */

export const MANQUE = Object.freeze({
  RIEN_RECU: 'rien_recu',
  SANS_VIDEO: 'sans_video',
  COMPLET: 'complet',
});

/** Les pays réellement attendus : ni tiroir technique, ni rubrique du journal. */
export function paysAttendus() {
  const custom = getCustomCountries();
  const tous = [...COUNTRIES, ...(Array.isArray(custom) ? custom : [])];
  const vus = new Set();
  return tous.filter((c) => {
    if (!c || !c.id) return false;
    if (c.id === 'tj' || SPECIAL_BUCKETS.has(c.id)) return false;
    if (vus.has(c.id)) return false;
    vus.add(c.id);
    return true;
  });
}

/**
 * État de chaque pays attendu pour une semaine.
 *
 * Rend une liste, pas un objet : l'ordre des pays est celui de la
 * configuration, et c'est celui que la rédaction lit.
 */
export function etatDesPays(weekId) {
  const envois = getWeekUploads(weekId) || {};

  return paysAttendus().map((pays) => {
    const fichiers = Array.isArray(envois[pays.id]) ? envois[pays.id] : [];
    const videos = fichiers.filter((f) => f?.type === 'video').length;

    let manque = MANQUE.COMPLET;
    if (fichiers.length === 0) manque = MANQUE.RIEN_RECU;
    else if (videos === 0) manque = MANQUE.SANS_VIDEO;

    return {
      countryId: pays.id,
      nom: pays.name,
      nbFichiers: fichiers.length,
      nbVideos: videos,
      manque,
    };
  });
}

/** Les seuls pays à relancer : ceux qui n'ont pas de quoi être montés. */
export function paysARelancer(weekId) {
  return etatDesPays(weekId).filter((p) => p.manque !== MANQUE.COMPLET);
}
