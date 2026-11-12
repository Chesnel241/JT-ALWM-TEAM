/**
 * La piste son du JT : voix off, musique, ou tout autre fichier audio, posés
 * sur la timeline comme des plans.
 *
 * LE CONSTAT : le JT n'acceptait qu'une seule voix off, dont on tapait l'heure
 * de départ en secondes, et une musique de fond. Impossible de poser deux voix
 * off, de les voir, de les caler sur l'image ou de les raccourcir.
 *
 * Ce fichier ne dépend de rien : le studio, le serveur et le moteur de rendu
 * le lisent tous les trois (comme identite.js). C'est ce qui garantit que
 * l'aperçu, la sauvegarde et le master comprennent la même piste.
 */

/** Ce qu'est un son : il ne change que son nom à l'écran, pas son rendu. */
export const ROLES_SON = Object.freeze(['voix', 'musique', 'son']);

/** Assez pour un JT chargé ; borne ce qu'un client peut faire écrire. */
export const MAX_SONS = 200;

/** Le son des plans sous une voix off : −12 dB environ, assez pour comprendre la voix. */
export const ATTENUATION_SOUS_VOIX = 0.25;

/** La baisse se fait en un quart de seconde, sans à-coup. */
export const RAMPE_SOUS_VOIX = 0.25;

const DUREE_MAX = 36000; // dix heures
const ID = /^[\w-]{1,64}$/;
const NOM_FICHIER = /^[^/\\\0]{1,255}$/;

const nombre = (v, min, max) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Vrai si `nom` désigne un fichier du dossier des envois : jamais un chemin. */
export function nomDeFichierSur(nom) {
  return typeof nom === 'string' && NOM_FICHIER.test(nom) && !nom.startsWith('.');
}

/**
 * La piste telle qu'on accepte de la garder et de la rendre.
 *
 * Les données viennent du navigateur : on ne garde que les champs connus, aux
 * bornes connues. Un son sans fichier valide est retiré, une valeur hors bornes
 * revient à son défaut. Rien d'autre ne passe.
 */
export function nettoyerPisteAudio(liste) {
  if (!Array.isArray(liste)) return [];
  const propres = [];
  for (const brut of liste.slice(0, MAX_SONS)) {
    if (!brut || typeof brut !== 'object' || !nomDeFichierSur(brut.filename)) continue;
    const role = ROLES_SON.includes(brut.role) ? brut.role : 'son';
    const inPoint = nombre(brut.inPoint, 0, DUREE_MAX) ?? 0;
    const outPoint = nombre(brut.outPoint, 0, DUREE_MAX);
    const source = nombre(brut.sourceDurationSec, 0, DUREE_MAX);
    propres.push({
      id: typeof brut.id === 'string' && ID.test(brut.id) ? brut.id : `son-${propres.length + 1}`,
      filename: brut.filename,
      name: typeof brut.name === 'string' ? brut.name.slice(0, 200) : brut.filename,
      role,
      startTime: nombre(brut.startTime, 0, DUREE_MAX) ?? 0,
      inPoint,
      outPoint: outPoint !== null && outPoint > inPoint ? outPoint : null,
      sourceDurationSec: source,
      volume: nombre(brut.volume, 0, 2) ?? 1,
      // Une voix off baisse le son des plans qu'elle recouvre, sauf avis contraire.
      attenuer: typeof brut.attenuer === 'boolean' ? brut.attenuer : role === 'voix',
    });
  }
  return propres;
}

/** La durée jouée d'un son, en secondes (0 si elle n'est pas encore connue). */
export function dureeSon(son) {
  const debut = Number(son?.inPoint) || 0;
  const fin = son?.outPoint != null ? Number(son.outPoint) : Number(son?.sourceDurationSec);
  return Number.isFinite(fin) && fin > debut ? fin - debut : 0;
}

/** Les moments du JT où une voix off demande qu'on baisse le son des plans. */
export function plagesSousVoix(sons) {
  return (Array.isArray(sons) ? sons : [])
    .filter((s) => s && s.attenuer && dureeSon(s) > 0)
    .map((s) => ({ debut: Number(s.startTime) || 0, fin: (Number(s.startTime) || 0) + dureeSon(s) }));
}

/**
 * Le gain à appliquer au son des plans à l'instant `t` (secondes du JT) :
 * 1 hors des voix off, `attenuation` pendant, avec une rampe douce de part et
 * d'autre pour ne pas couper le son net.
 */
export function gainSousVoix(t, plages, { attenuation = ATTENUATION_SOUS_VOIX, rampe = RAMPE_SOUS_VOIX } = {}) {
  let gain = 1;
  for (const { debut, fin } of plages || []) {
    let present;
    if (t >= debut && t <= fin) present = 1;
    else if (t < debut && t > debut - rampe) present = 1 - (debut - t) / rampe;
    else if (t > fin && t < fin + rampe) present = 1 - (t - fin) / rampe;
    else continue;
    gain = Math.min(gain, 1 - (1 - attenuation) * present);
  }
  return gain;
}
