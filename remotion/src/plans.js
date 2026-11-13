/**
 * Les plans sans vidéo du JT : les « cartons ».
 *
 * Un carton est un plan de durée fixe, sans fichier, sur lequel s'affiche un
 * habillage plein écran : « Les titres », la fin du journal. Le fond des titres
 * est opaque ; posé sur un reportage, il en aurait masqué les images. Le
 * carton leur donne leur propre place dans le déroulé.
 *
 * Ce fichier ne dépend de rien : le studio, le serveur et le moteur le lisent.
 */

/** Le nom de fichier réservé d'un carton : jamais un vrai fichier. */
export const CARTON = '__carton__';

/** Un carton se rallonge jusqu'à dix minutes, pas au-delà. */
export const DUREE_MAX_CARTON = 600;

export const estCarton = (plan) => plan?.filename === CARTON;
