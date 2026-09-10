/**
 * Code couleur des reportages.
 *
 * La charte ALWM tient en deux bleus (logo), du blanc et du noir. Pour
 * distinguer plusieurs reportages d'un coup d'œil sans introduire de couleurs
 * étrangères, on décline ces deux bleus en cinq paliers de luminosité, du plus
 * profond au plus clair. Chaque palier porte la couleur de texte qui lui donne
 * un contraste conforme — vérifié : 8,6 / 5,9 / 7,7 / 10,8 / 13,6 contre 1.
 */
export const REPORTAGE_TONES = Object.freeze([
  { fill: '#0d4d8b', onFill: '#ffffff' },
  { fill: '#1668a8', onFill: '#ffffff' },
  { fill: '#51b5e7', onFill: '#111827' },
  { fill: '#8ed3f2', onFill: '#111827' },
  { fill: '#c4e7f8', onFill: '#111827' },
]);

/** Teinte d'un reportage à partir de son rang (0 = premier). */
export function reportageTone(index) {
  const i = Number.isFinite(index) && index >= 0 ? index : 0;
  return REPORTAGE_TONES[i % REPORTAGE_TONES.length];
}
