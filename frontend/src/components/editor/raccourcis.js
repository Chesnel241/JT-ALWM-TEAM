/**
 * Les gestes au clavier des stations de montage, en calcul pur.
 *
 * LE CONSTAT : pour raccourcir un plan, il fallait viser au pixel un bord de
 * clip, ou ouvrir le rognage précis et taper des secondes. Les monteurs
 * travaillent autrement : ils posent la tête de lecture sur l'image voulue,
 * puis disent « ici commence le plan » (I) ou « ici il s'arrête » (O). Et ils
 * sautent d'une coupe à l'autre (↑ ↓) plutôt que de faire défiler.
 */
import { MIN_CLIP_DURATION, getClipRange, roundToFrame } from './timelineModel.js';

/**
 * Le plan rogné à la tête de lecture : `debut` coupe ce qui précède, `fin` ce
 * qui suit. Rend la nouvelle plage, ou `null` si la tête n'est pas dans le plan
 * ou si le plan deviendrait trop court.
 */
export function rognerALaTete(clip, item, instant, cote) {
  if (!clip || !item) return null;
  const local = instant - item.start;
  if (local <= 0 || local >= item.duration) return null;
  const plage = getClipRange(clip);
  const coupe = roundToFrame(plage.inPoint + local);
  const inPoint = cote === 'debut' ? coupe : plage.inPoint;
  const outPoint = cote === 'debut' ? plage.outPoint : coupe;
  if (outPoint - inPoint < MIN_CLIP_DURATION) return null;
  return {
    inPoint,
    outPoint,
    durationSec: roundToFrame(outPoint - inPoint),
    sourceDurationSec: plage.sourceDurationSec ?? clip.sourceDurationSec,
  };
}

/** Les instants de coupe du JT : le début de chaque plan, et la fin du JT. */
export function pointsDeCoupe(layout) {
  const points = (layout?.items || []).map((item) => item.start);
  points.push(layout?.total || 0);
  return [...new Set(points.map((p) => roundToFrame(p)))].sort((a, b) => a - b);
}

/** La coupe suivante (`+1`) ou précédente (`-1`) depuis `instant`. */
export function coupeVoisine(layout, instant, sens) {
  const points = pointsDeCoupe(layout);
  const marge = 1e-3;
  if (sens > 0) return points.find((p) => p > instant + marge) ?? points[points.length - 1];
  return [...points].reverse().find((p) => p < instant - marge) ?? 0;
}
