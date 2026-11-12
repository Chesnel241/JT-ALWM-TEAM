/**
 * Le niveau sonore du master, à la norme de diffusion.
 *
 * LE CONSTAT : aucune étape ne réglait le niveau du JT. Chaque reportage
 * sortait au niveau que lui avait donné le correspondant, et la voix off était
 * poussée à −14 LUFS (la cible des plateformes web), soit environ 9 LU
 * au-dessus de la norme de diffusion européenne.
 *
 * La norme : EBU R 128 — programme à −23 LUFS (tolérance ±1 LU), crête vraie
 * maximale à −1 dBTP, mesurées selon l'ITU-R BS.1770.
 *
 * La méthode : deux passes du filtre `loudnorm` de ffmpeg. La première mesure
 * le programme entier ; la seconde applique un gain fixe calculé sur cette
 * mesure (`linear=true`). Un gain fixe ne déforme pas la dynamique : une voix
 * reste une voix, un applaudissement reste un applaudissement. La passe unique,
 * elle, corrige en continu et fait « pomper » le son.
 *
 * Ce fichier ne dépend de rien : le moteur de rendu (worker) et le serveur
 * (repli libass) l'utilisent tous les deux.
 */

export const CIBLE_SON = Object.freeze({
  /** Niveau intégré du programme, en LUFS. */
  integre: -23,
  /** Crête vraie maximale, en dBTP. */
  crete: -1,
  /** Bornes de la plage de loudness visée, en LU. */
  plageMin: 7,
  plageMax: 20,
});

/** En dessous, le programme est muet : on n'amplifie pas un silence. */
const SEUIL_SILENCE = -70;

const nombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const borner = (v, min, max) => Math.min(max, Math.max(min, v));

/** Dernier objet JSON de la sortie de ffmpeg qui contient la clé voulue. */
function dernierJson(sortie, cle) {
  const texte = String(sortie || '');
  let fin = texte.lastIndexOf('}');
  while (fin >= 0) {
    const debut = texte.lastIndexOf('{', fin);
    if (debut < 0) return null;
    const bloc = texte.slice(debut, fin + 1);
    if (bloc.includes(`"${cle}"`)) {
      try { return JSON.parse(bloc); } catch { return null; }
    }
    fin = texte.lastIndexOf('}', debut - 1);
  }
  return null;
}

/**
 * Arguments ffmpeg de la passe de mesure. Seul le son est décodé : l'image ne
 * coûte rien.
 */
export function argsMesure(entree, { concat = false } = {}) {
  return [
    '-hide_banner', '-nostats',
    ...(concat ? ['-f', 'concat', '-safe', '0'] : []),
    '-i', entree,
    '-map', '0:a:0', '-vn',
    '-af', `loudnorm=I=${CIBLE_SON.integre}:TP=${CIBLE_SON.crete}:LRA=11:print_format=json`,
    '-f', 'null', '-',
  ];
}

/**
 * La mesure lue dans la sortie de la première passe, ou `null` si elle est
 * illisible ou si le programme est muet.
 */
export function lireMesure(sortie) {
  const json = dernierJson(sortie, 'input_i');
  if (!json) return null;
  const mesure = {
    integre: nombre(json.input_i),
    crete: nombre(json.input_tp),
    plage: nombre(json.input_lra),
    seuil: nombre(json.input_thresh),
    decalage: nombre(json.target_offset),
  };
  if (Object.values(mesure).some((v) => v === null)) return null;
  if (mesure.integre < SEUIL_SILENCE) return null;
  return mesure;
}

/**
 * Le filtre de la seconde passe : gain fixe calculé sur la mesure, puis retour
 * à 48 kHz (loudnorm travaille en interne à 192 kHz).
 *
 * La plage visée suit celle du programme : si elle était plus étroite que la
 * plage mesurée, loudnorm abandonnerait le gain fixe pour une correction
 * continue.
 */
export function filtreCorrection(mesure) {
  const plage = borner(Math.ceil(mesure.plage), CIBLE_SON.plageMin, CIBLE_SON.plageMax);
  const f = (v) => Number(v).toFixed(2);
  return [
    `loudnorm=I=${CIBLE_SON.integre}:TP=${CIBLE_SON.crete}:LRA=${plage}`,
    `measured_I=${f(mesure.integre)}:measured_TP=${f(mesure.crete)}`,
    `measured_LRA=${f(mesure.plage)}:measured_thresh=${f(mesure.seuil)}`,
    `offset=${f(mesure.decalage)}:linear=true:print_format=json`,
  ].join(':') + ',aresample=48000';
}

/**
 * Ce que la seconde passe a réellement produit : niveau et crête en sortie,
 * et le mode employé (`linear` attendu ; `dynamic` si ffmpeg a dû corriger
 * en continu pour tenir la crête).
 */
export function lireResultat(sortie) {
  const json = dernierJson(sortie, 'output_i');
  if (!json) return null;
  const integre = nombre(json.output_i);
  const crete = nombre(json.output_tp);
  if (integre === null || crete === null) return null;
  return { integre, crete, mode: String(json.normalization_type || '').toLowerCase() || null };
}

/** Vrai si le niveau mesuré est dans la tolérance de la norme (±1 LU). */
export function dansLaNorme(integre) {
  return Number.isFinite(integre) && Math.abs(integre - CIBLE_SON.integre) <= 1;
}
