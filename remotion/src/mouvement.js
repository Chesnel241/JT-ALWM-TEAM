import { Easing, interpolate, spring } from 'remotion';
import { CASCADE, MOUVEMENT, RESSORT, images } from './identite.js';

/**
 * Le vocabulaire de mouvement du texte à l'antenne.
 *
 * Ce fichier remplace `anim.js`, qui implémentait la même chose mais n'était
 * appelé par personne : son unique consommateur, un composant `Tx`, n'était
 * utilisé que par deux habillages absents du registre. Les trois menus
 * d'animation du studio ne commandaient donc rien depuis des mois.
 *
 * Ce qu'il fait, et ce qu'il ne fait pas
 * -------------------------------------
 * Il anime **le texte**, jamais le bloc qui le contient. Un habillage garde
 * l'arrivée qu'on lui a dessinée — sa révélation par masque, son ressort — et
 * le mouvement choisi par le monteur s'applique au texte à l'intérieur. C'est
 * l'intention d'origine du code, et c'est ce qui garantit qu'aucune
 * combinaison ne peut casser un habillage : les chaînes de transformation des
 * conteneurs, que plusieurs gabarits concatènent à la main, ne sont pas
 * touchées.
 *
 * Tous les timings viennent de `identite.js` et se calent sur la cadence
 * reçue. Rien n'est écrit en dur ici, et rien ne suppose 30 images par
 * seconde — les quinze habillages importés faisaient cette supposition.
 */

/**
 * Au-delà de ce seuil, la durée n'en est pas une.
 *
 * `JTMaster` donnait `durationInFrames = 99 999` à tout habillage dont la
 * durée n'est pas renseignée, alors que le champ du studio annonce « vide =
 * toute la vidéo ». Un test `frame > durationInFrames - 30` était alors faux
 * en permanence : la sortie ne se jouait jamais, et le bandeau était coupé net
 * à la fin du plan.
 *
 * Depuis le lot 5, `dureeHabillage()` ci-dessous fait hériter cet habillage de
 * ce qui reste de son plan — ou du montage pour les couches globales — et la
 * sortie retrouve un sens. Ce garde-fou reste pour le cas où une durée
 * aberrante arriverait quand même : un habillage sans fin n'a pas de sortie,
 * et c'est la seule réponse honnête.
 */
const SANS_FIN = 90000;

/**
 * La durée qu'un habillage reçoit quand le monteur n'en a pas fixé.
 *
 * « Vide = toute la vidéo » veut dire « jusqu'au bout de ce qui le porte » :
 * la fin de son plan pour un habillage de clip, la fin du montage pour un
 * habillage global. Pas 99 999 images, soit cinquante-cinq minutes.
 *
 * Une fonction plutôt que la même expression recopiée aux trois endroits de
 * `JTMaster` : c'est cette triplication qui avait laissé le défaut s'installer
 * sans que personne ne le voie, et c'est ce qui rend la règle testable sans
 * monter le moteur de rendu.
 *
 * Toutes les valeurs sont en images. `demandee` vient du monteur (`null`,
 * `0` ou absent = pas de durée), `porteuse` est la durée du plan ou du
 * montage, `debut` le décalage de l'habillage dans celui-ci.
 */
export function dureeHabillage(demandee, porteuse, debut = 0) {
  if (demandee > 0) return Math.max(1, Math.round(demandee));
  const restant = Math.round(porteuse) - Math.round(debut);
  // Une porteuse absurde (absente, négative, non finie) ne doit pas produire
  // une sortie qui se jouerait à la première image.
  if (!Number.isFinite(restant) || restant < 1) return 1;
  return restant;
}

/** Les mouvements qui se jouent lettre par lettre. */
export const PAR_LETTRE = new Set(['typewriter', 'cascade']);

/** Entrées proposées, groupées par intention comme dans le studio. */
export const ENTREES = {
  sobre: ['fade', 'slide', 'mask_reveal'],
  affirmee: ['pop', 'scale', 'cascade'],
  marquee: ['typewriter', 'glitch_in', 'blurin'],
};

/** Boucles proposées. */
export const BOUCLES = ['none', 'float', 'pulse'];

/** Sorties proposées. `auto` reprend l'entrée. */
export const SORTIES = ['auto', 'fade', 'scale_down', 'slide_out', 'blurout'];

/** Toutes les entrées, à plat. */
export const ENTREES_PLATES = Object.values(ENTREES).flat();

/** La sortie qui répond naturellement à une entrée donnée. */
const SORTIE_MIROIR = {
  fade: 'fade',
  slide: 'slide_out',
  mask_reveal: 'fade',
  pop: 'scale_down',
  scale: 'scale_down',
  cascade: 'fade',
  typewriter: 'fade',
  glitch_in: 'fade',
  blurin: 'blurout',
};

const sortante = (t) => interpolate(t, [0, 1], [0, 1], {
  easing: Easing.out(Easing.cubic),
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});

/** Progression 0 → 1 sur une fenêtre, amortie. */
function progression(frame, debut, duree) {
  if (duree <= 0) return 1;
  return sortante(Math.min(1, Math.max(0, (frame - debut) / duree)));
}

/** Un bruit déterministe, pour une saccade qui ne scintille pas au hasard. */
function secousse(frame, amplitude) {
  const n = Math.sin(frame * 12.9898) * 43758.5453;
  return (n - Math.floor(n) - 0.5) * 2 * amplitude;
}

/**
 * L'état d'un texte à une image donnée.
 *
 * Rend toujours un objet de style complet — jamais `undefined`, jamais un
 * texte invisible par accident. Un identifiant inconnu retombe sur le fondu :
 * une valeur enregistrée avant que ces menus ne fonctionnent ne doit pas faire
 * disparaître un titre.
 */
export function styleTexte({
  frame = 0,
  durationInFrames = SANS_FIN,
  fps = 30,
  animation = 'fade',
  boucle = 'none',
  sortie = 'auto',
  delai = 0,
} = {}) {
  // Le texte ne commence à bouger qu'au moment où la boîte qui le contient
  // s'ouvre. Un bandeau révèle ses lignes l'une après l'autre — surtitre à la
  // 10e image, nom à la 16e, fonction à la 22e — et sans ce décalage
  // l'animation se jouerait derrière un masque encore fermé : le monteur
  // choisit « Machine à écrire » et découvre un texte déjà tapé.
  const retard = Math.max(0, Number(delai) || 0);
  const f = Math.max(0, (Number(frame) || 0) - retard);
  const cadence = Number(fps) > 0 ? Number(fps) : 30;
  const duree = Number(durationInFrames);
  const bornee = Number.isFinite(duree) && duree > 0 && duree < SANS_FIN;

  const dEntree = images(MOUVEMENT.entree, cadence);
  const dSortie = images(MOUVEMENT.sortie, cadence);

  const entree = ENTREES_PLATES.includes(animation) ? animation : 'fade';
  const nomSortie = sortie === 'auto' || !SORTIES.includes(sortie)
    ? (SORTIE_MIROIR[entree] || 'fade')
    : sortie;

  // --- entrée ---
  const t = progression(f, 0, dEntree);
  let opacite = t;
  const transformations = [];
  let filtre = '';

  switch (entree) {
    case 'slide':
      transformations.push(`translateX(${((1 - t) * -40).toFixed(2)}px)`);
      break;
    case 'pop': {
      const s = spring({ frame: f, fps: cadence, config: RESSORT });
      transformations.push(`scale(${interpolate(s, [0, 1], [0.8, 1]).toFixed(3)})`);
      break;
    }
    case 'scale':
      transformations.push(`scale(${(1.18 - t * 0.18).toFixed(3)})`);
      break;
    case 'blurin':
      filtre = `blur(${((1 - t) * 10).toFixed(2)}px)`;
      break;
    case 'glitch_in':
      // La saccade se calme au lieu de s'arrêter net.
      if (t < 1) transformations.push(`translateX(${secousse(f, (1 - t) * 7).toFixed(2)}px)`);
      opacite = f < dEntree * 0.15 ? 0 : 1;
      break;
    case 'mask_reveal':
    case 'typewriter':
    case 'cascade':
      // Portés par le découpage du texte, pas par un style d'ensemble.
      opacite = 1;
      break;
    case 'fade':
    default:
      break;
  }

  // --- boucle, une fois l'entrée finie ---
  if (t >= 1) {
    if (boucle === 'float') {
      transformations.push(`translateY(${(Math.sin(f / (cadence * 0.7)) * 4).toFixed(2)}px)`);
    } else if (boucle === 'pulse') {
      transformations.push(`scale(${(1 + Math.sin(f / (cadence * 0.6)) * 0.02).toFixed(4)})`);
    }
  }

  // --- sortie, seulement si la fin existe ---
  // Elle se mesure sur l'image réelle : tous les textes d'un habillage
  // disparaissent ensemble, même s'ils sont arrivés en décalé.
  const fReelle = Math.max(0, Number(frame) || 0);
  if (bornee && fReelle > duree - dSortie) {
    const s = progression(fReelle, duree - dSortie, dSortie);
    switch (nomSortie) {
      case 'scale_down':
        transformations.push(`scale(${(1 - s * 0.15).toFixed(3)})`);
        opacite = Math.min(opacite, 1 - s);
        break;
      case 'slide_out':
        transformations.push(`translateX(${(s * -40).toFixed(2)}px)`);
        opacite = Math.min(opacite, 1 - s);
        break;
      case 'blurout':
        filtre = `blur(${(s * 10).toFixed(2)}px)`;
        opacite = Math.min(opacite, 1 - s);
        break;
      case 'fade':
      default:
        opacite = Math.min(opacite, 1 - s);
        break;
    }
  }

  const style = { opacity: Number(opacite.toFixed(4)) };
  if (transformations.length) style.transform = transformations.join(' ');
  if (filtre) style.filter = filtre;
  return style;
}

/**
 * L'état d'une lettre, pour les mouvements qui se jouent caractère par
 * caractère. Le décalage est plafonné : sur un titre long, un décalage
 * constant ferait attendre plusieurs secondes avant la dernière lettre.
 */
export function styleLettre({
  index = 0,
  total = 1,
  frame = 0,
  fps = 30,
  animation = 'typewriter',
  delai = 0,
} = {}) {
  const cadence = Number(fps) > 0 ? Number(fps) : 30;
  const f = Math.max(0, (Number(frame) || 0) - Math.max(0, Number(delai) || 0));
  const n = Math.max(1, Number(total) || 1);

  const dEntree = images(MOUVEMENT.entree, cadence);
  // Le pas peut être fractionnaire : plafonner à une image par lettre ferait
  // durer un titre de quatre-vingts caractères quatre-vingts images, soit près
  // de trois secondes avant que la dernière lettre n'apparaisse.
  const pas = Math.min(images(CASCADE, cadence), dEntree / n);
  const debut = index * pas;

  if (animation === 'typewriter') {
    // Binaire : une lettre est là ou elle ne l'est pas.
    return { opacity: f >= debut ? 1 : 0 };
  }

  // cascade : chaque lettre monte à son tour.
  const t = progression(f, debut, images(MOUVEMENT.accent, cadence));
  return {
    opacity: Number(t.toFixed(4)),
    transform: `translateY(${((1 - t) * 18).toFixed(2)}px)`,
  };
}

/** La révélation par masque, qui agit sur la boîte et non sur le texte. */
export function styleMasque({ frame = 0, fps = 30, delai = 0 } = {}) {
  const cadence = Number(fps) > 0 ? Number(fps) : 30;
  const f = Math.max(0, (Number(frame) || 0) - Math.max(0, Number(delai) || 0));
  const t = progression(f, 0, images(MOUVEMENT.entree, cadence));
  return { clipPath: `inset(0 ${((1 - t) * 100).toFixed(2)}% 0 0)` };
}
