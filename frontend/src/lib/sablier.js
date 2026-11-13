/**
 * La géométrie du sablier du compte à rebours (Sablier.jsx).
 *
 * Le liquide ne descend pas « en ligne droite » : c'est un VOLUME qui passe
 * d'une ampoule à l'autre. Dans la partie large d'une ampoule, le niveau
 * bouge à peine ; près du goulot, il file. C'est ce qui rend le sablier
 * crédible — et c'est ce que ce module calcule, une fois pour toutes, à
 * partir du profil du verre (un solide de révolution).
 *
 * Calcul pur, sans React : il se teste seul.
 *
 * Repère : viewBox 0 0 160 240. Le goulot est en (80, 120) ; chaque ampoule
 * s'étend sur 88 unités au-dessus et au-dessous.
 */

export const CX = 80;
export const GOULOT_Y = 120;
/** Hauteur d'une ampoule, du goulot au culot. */
export const H = 88;
/** Demi-largeur maximale d'une ampoule, et du goulot. */
export const R = 50;
export const N = 3.2;
/** Le liquide ne remplit pas l'ampoule jusqu'au culot : il reste de l'air. */
export const REMPLISSAGE_MAX = 0.84;

/**
 * La demi-largeur de l'ampoule, à la distance relative `t` du goulot
 * (0 au goulot, 1 au culot) : elle s'ouvre vite, s'arrondit en panse, puis
 * se resserre un peu avant le culot, comme un verre soufflé.
 */
export function profil(t) {
  const u = Math.max(0, Math.min(1, t));
  const PANSE = 0.72;
  const forme = u <= PANSE
    ? Math.sin((Math.PI / 2) * (u / PANSE)) ** 0.75
    : 1 - 0.12 * ((u - PANSE) / (1 - PANSE)) ** 2;
  return N + (R - N) * forme;
}

// Les volumes cumulés, du goulot vers le culot (en unités arbitraires : seul
// le rapport compte). Intégration par trapèzes sur 400 tranches.
const PAS = 400;
const CUMUL_GOULOT = (() => {
  const v = [0];
  for (let i = 1; i <= PAS; i += 1) {
    const a = profil((i - 1) / PAS) ** 2;
    const b = profil(i / PAS) ** 2;
    v.push(v[i - 1] + ((a + b) / 2) / PAS);
  }
  return v;
})();

/** Volume entre le goulot et la distance relative `t`. */
export const volumeDepuisGoulot = (t) => {
  const x = Math.max(0, Math.min(1, t)) * PAS;
  const i = Math.floor(x);
  if (i >= PAS) return CUMUL_GOULOT[PAS];
  return CUMUL_GOULOT[i] + (CUMUL_GOULOT[i + 1] - CUMUL_GOULOT[i]) * (x - i);
};

/** Volume entre le culot et la distance relative `t` (mesurée depuis le goulot). */
export const volumeDepuisCulot = (t) => CUMUL_GOULOT[PAS] - volumeDepuisGoulot(t);

/** Le volume total de liquide : l'ampoule du haut, remplie à 84 %. */
export const VOLUME_TOTAL = volumeDepuisGoulot(REMPLISSAGE_MAX);

/** Cherche `t` tel que `f(t) = cible`, `f` monotone sur [0, 1]. */
function inverser(f, cible, croissante) {
  let bas = 0;
  let haut = 1;
  for (let k = 0; k < 40; k += 1) {
    const m = (bas + haut) / 2;
    const v = f(m);
    if (croissante ? v < cible : v > cible) bas = m;
    else haut = m;
  }
  return (bas + haut) / 2;
}

/**
 * Les deux niveaux, pour une part de temps restant (`fraction`, 1 = tout le
 * temps, 0 = clos) : la hauteur relative du liquide dans l'ampoule du haut
 * (depuis le goulot), et celle de l'ampoule du bas (depuis le culot).
 */
export function niveaux(fraction) {
  const f = Math.max(0, Math.min(1, Number(fraction) || 0));
  const haut = f <= 0 ? 0 : inverser(volumeDepuisGoulot, f * VOLUME_TOTAL, true);
  const volumeBas = (1 - f) * VOLUME_TOTAL;
  // Dans l'ampoule du bas, le liquide monte du culot (t = 1) vers le goulot.
  const tSurface = volumeBas <= 0 ? 1 : inverser(volumeDepuisCulot, volumeBas, false);
  return { haut, bas: 1 - tSurface };
}

const arrondi = (n) => Math.round(n * 100) / 100;

/** Les points d'un bord de l'ampoule, du goulot (t0) au culot (t1). */
function bord(t0, t1, cote, versLeHaut, retrait = 0, pas = 28) {
  const points = [];
  for (let i = 0; i <= pas; i += 1) {
    const t = t0 + ((t1 - t0) * i) / pas;
    const x = CX + cote * Math.max(N * 0.4, profil(t) - retrait);
    const y = GOULOT_Y + (versLeHaut ? -1 : 1) * t * H;
    points.push(`${arrondi(x)},${arrondi(y)}`);
  }
  return points;
}

/** Le contour du verre, les deux ampoules d'un seul trait. */
export function cheminVerre() {
  const gaucheHaut = bord(1, 0, -1, true);
  const gaucheBas = bord(0, 1, -1, false).slice(1);
  const droiteBas = bord(1, 0, 1, false);
  const droiteHaut = bord(0, 1, 1, true).slice(1);
  return `M ${[...gaucheHaut, ...gaucheBas, ...droiteBas, ...droiteHaut].join(' L ')} Z`;
}

/**
 * Une ampoule seule, pour la découpe du sable. `retrait` : l'épaisseur du
 * verre — le sable reste à l'intérieur.
 */
export function cheminAmpoule(versLeHaut, retrait = 0) {
  const gauche = bord(1, 0, -1, versLeHaut, retrait);
  const droite = bord(0, 1, 1, versLeHaut, retrait).slice(1);
  return `M ${[...gauche, ...droite].join(' L ')} Z`;
}

/** La demi-largeur intérieure à la hauteur `y` du dessin. */
export function demiLargeurA(y, retrait = 0) {
  const t = Math.abs(y - GOULOT_Y) / H;
  return Math.max(N * 0.4, profil(t) - retrait);
}

/** L'épaisseur du verre : le sable reste à l'intérieur. */
export const RETRAIT = 1.8;
/** Le culot de l'ampoule du bas. */
export const CULOT = GOULOT_Y + H;
/**
 * Le sablier est vu d'un peu au-dessus : un cercle horizontal (le plateau,
 * la surface du sable) y devient une ellipse aplatie de ce rapport.
 */
export const PERSPECTIVE = 0.12;
/** La hauteur du cône de sable du bas, une fois formé. */
export const TAS_MAX = 12;

/**
 * Ce que le composant dessine, pour une part de temps restant :
 *
 * - `surfaceHaut` : la surface du sable de l'ampoule du haut (hauteur,
 *   demi-largeur intérieure), absente quand elle est vide ;
 * - `tas` : le cône de l'ampoule du bas, posé sur le niveau « à plat » qui
 *   garde le volume (un tiers sous ce niveau, deux tiers au-dessus) ;
 * - `filet` : le sable qui tombe, du goulot au sommet du tas — absent une fois
 *   tout passé.
 */
export function etatSablier(fraction) {
  const { haut, bas } = niveaux(fraction);
  const coule = haut > 0.002;
  const yHaut = GOULOT_Y - haut * H;
  const surfaceHaut = coule ? { y: arrondi(yHaut), demiLargeur: arrondi(demiLargeurA(yHaut, RETRAIT)) } : null;

  let tas = null;
  if (bas > 0) {
    const yPlat = GOULOT_Y + (1 - bas) * H;
    const hauteur = TAS_MAX * Math.min(1, bas / 0.12);
    const yBord = Math.min(CULOT, yPlat + hauteur / 3);
    tas = {
      yBord: arrondi(yBord),
      ySommet: arrondi(yPlat - (2 * hauteur) / 3),
      demiLargeur: arrondi(demiLargeurA(yBord, RETRAIT)),
    };
  }

  return {
    haut,
    bas,
    surfaceHaut,
    tas,
    coule,
    filet: coule ? { y1: GOULOT_Y, y2: tas ? tas.ySommet : CULOT } : null,
  };
}
