/**
 * Les habillages posés sur les plans, et ce qu'on peut glisser sur la timeline.
 *
 * LE CONSTAT : un nom à l'écran, un lieu, un chiffre clé appartiennent à leur
 * plan, et leur début et leur durée se comptent en secondes depuis le début du
 * plan. La timeline ne les montrait nulle part : pour qu'un bandeau commence
 * sur la bonne image, il fallait calculer la seconde exacte et la taper. Sur un
 * JT de vingt minutes, c'était pénible et faux une fois sur deux.
 *
 * Ce fichier ne contient que le calcul, sans React : il se teste seul.
 */
import { MIN_CLIP_DURATION, roundToFrame } from './timelineModel.js';

const borner = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

/** Le texte qui dit de quel habillage il s'agit, sur son bloc. */
export function texteHabillage(overlay) {
  const f = overlay?.fields || {};
  return String(f.nom || f.texte || f.titre || f.lieu || f.chiffre || f.citation || '').trim();
}

/**
 * Chaque habillage de plan, à sa place dans le JT.
 *
 * Un habillage sans durée dure « tout le plan » : il s'étend jusqu'à la fin de
 * son plan, comme au rendu. Un habillage qui déborde de son plan (plan rogné
 * après coup) est montré coupé à la fin du plan, comme au rendu aussi.
 */
export function habillagesDesPlans(layout) {
  const liste = [];
  for (const item of layout?.items || []) {
    (item.clip?.overlays || []).forEach((overlay, rang) => {
      const debut = borner(Number(overlay.startTime) || 0, 0, Math.max(0, item.duration - MIN_CLIP_DURATION));
      const reste = Math.max(MIN_CLIP_DURATION, item.duration - debut);
      const voulue = overlay.duration == null ? reste : Number(overlay.duration) || reste;
      liste.push({
        cle: `${item.id}:${overlay.id || rang}`,
        planId: item.id,
        rang,
        overlay,
        debut,
        duree: Math.min(reste, Math.max(MIN_CLIP_DURATION, voulue)),
        debutPlan: item.start,
        dureePlan: item.duration,
      });
    });
  }
  return liste;
}

/**
 * La nouvelle place d'un habillage de plan après un glissé de `delta`
 * secondes. Temps locaux au plan. `mode` : `move` (tout le bloc), `left` (le
 * début), `right` (la fin). `accrocher` aimante un temps local (bords de plans,
 * tête de lecture). L'habillage ne sort jamais de son plan.
 */
export function nouvellePlace({ debut, duree, dureePlan }, mode, delta, accrocher = (x) => x) {
  const fin = debut + duree;
  if (mode === 'move') {
    const vise = accrocher(roundToFrame(debut + delta));
    return { debut: roundToFrame(borner(vise, 0, dureePlan - duree)), duree };
  }
  if (mode === 'left') {
    const vise = accrocher(roundToFrame(debut + delta));
    const nouveauDebut = roundToFrame(borner(vise, 0, fin - MIN_CLIP_DURATION));
    return { debut: nouveauDebut, duree: roundToFrame(fin - nouveauDebut) };
  }
  const vise = accrocher(roundToFrame(fin + delta));
  const nouvelleFin = roundToFrame(borner(vise, debut + MIN_CLIP_DURATION, dureePlan));
  return { debut, duree: roundToFrame(nouvelleFin - debut) };
}

/** Écrit la place d'un habillage dans son plan, sans toucher au reste. */
export function placerHabillage(clips, planId, rang, { debut, duree }) {
  let change = false;
  const suite = clips.map((clip, index) => {
    const id = clip?.instanceId || clip?.id || String(index);
    if (id !== planId || !clip.overlays?.[rang]) return clip;
    change = true;
    const overlays = clip.overlays.slice();
    overlays[rang] = { ...overlays[rang], startTime: debut, duration: duree };
    return { ...clip, overlays };
  });
  return change ? suite : clips;
}

/** Retire un habillage de son plan. */
export function retirerHabillage(clips, planId, rang) {
  let change = false;
  const suite = clips.map((clip, index) => {
    const id = clip?.instanceId || clip?.id || String(index);
    if (id !== planId || !clip.overlays?.[rang]) return clip;
    change = true;
    return { ...clip, overlays: clip.overlays.filter((_, i) => i !== rang) };
  });
  return change ? suite : clips;
}

/* ------------------------------------------------------------------ */
/* Glisser-déposer                                                     */
/* ------------------------------------------------------------------ */

/** Les seuls types que la timeline accepte : jamais un fichier venu du bureau. */
export const TYPE_MEDIA = 'application/x-jt-media';
export const TYPE_HABILLAGE = 'application/x-jt-habillage';

/** Pose ce qu'on glisse : un rush ou un jingle (par son nom de fichier), ou un modèle. */
export function ecrireGlisse(dataTransfer, type, valeur) {
  if (!dataTransfer) return;
  dataTransfer.setData(type, JSON.stringify(valeur));
  dataTransfer.effectAllowed = 'copy';
}

/** Vrai si ce qu'on survole vient du studio (lisible pendant le survol). */
export function glisseDuStudio(dataTransfer) {
  const types = Array.from(dataTransfer?.types || []);
  return types.includes(TYPE_MEDIA) || types.includes(TYPE_HABILLAGE);
}

/** Un nom de fichier tel que le serveur les range : jamais un chemin. */
const NOM_FICHIER = /^[^/\\\0]{1,255}$/;

/**
 * Ce qu'on vient de déposer, vérifié. Un dépôt est une donnée venue d'ailleurs
 * — une autre page peut glisser n'importe quoi dans la nôtre — : seuls nos deux
 * types passent, un nom de fichier n'est jamais un chemin, et un modèle doit
 * figurer dans le catalogue. Tout le reste rend `null`.
 */
export function lireGlisse(dataTransfer, modelesConnus = []) {
  if (!dataTransfer) return null;
  const lire = (type) => {
    try {
      const brut = dataTransfer.getData(type);
      return brut ? JSON.parse(brut) : null;
    } catch {
      return null;
    }
  };
  const media = lire(TYPE_MEDIA);
  if (media && typeof media.filename === 'string' && NOM_FICHIER.test(media.filename) && !media.filename.startsWith('.')) {
    return { type: 'media', filename: media.filename };
  }
  const habillage = lire(TYPE_HABILLAGE);
  if (habillage && typeof habillage.templateId === 'string' && modelesConnus.includes(habillage.templateId)) {
    return { type: 'habillage', templateId: habillage.templateId };
  }
  return null;
}

/** Le rang où insérer un plan lâché à `instant` : avant le premier plan dont le milieu est après. */
export function rangInsertion(layout, instant) {
  const items = layout?.items || [];
  const rang = items.findIndex((item) => item.start + item.duration / 2 > instant);
  return rang < 0 ? items.length : rang;
}

/** Le début du rang d'insertion, pour dessiner le repère pendant le survol. */
export function instantDuRang(layout, rang) {
  const items = layout?.items || [];
  if (rang <= 0) return 0;
  if (rang >= items.length) return layout?.total || 0;
  return items[rang].start;
}

/** Le plan sous un instant donné (le plan entrant gagne dans une transition). */
export function planSous(layout, instant) {
  const items = layout?.items || [];
  let trouve = null;
  for (const item of items) {
    if (item.start <= instant && instant < item.start + item.duration) trouve = item;
  }
  return trouve;
}
