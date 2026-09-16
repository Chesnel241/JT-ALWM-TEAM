/**
 * L'identité du JT ALWM, à l'antenne.
 *
 * Ce fichier est la seule source. Il est lu par les trois formes d'un même
 * habillage : le rendu Remotion (le master), l'aperçu du studio, et le
 * générateur ASS du repli libass. Il ne dépend donc de rien — surtout pas de
 * `remotion`, que le serveur ne peut pas importer.
 *
 * Pourquoi il existe
 * ------------------
 * Trois palettes se contredisaient : `COL` dans theme.js (navy #031A3A),
 * des constantes locales dans overlays/index.jsx (navy #14143C), et la charte
 * web de index.css (#0d4d8b, relevé sur le logo et dont les contrastes sont
 * mesurés). La typographie n'allait pas mieux : 31 tailles ad hoc, un
 * interlettrage en `em` d'un côté et en `px` de l'autre, et huit réglages de
 * ressort différents sans raison documentée.
 *
 * L'identité n'était pas à inventer : elle existait côté web et s'arrêtait à
 * la porte du studio. Ce fichier la prolonge jusqu'à l'antenne.
 */

/* ------------------------------------------------------------------ */
/* Couleurs                                                            */
/* ------------------------------------------------------------------ */

/**
 * Nommées par rôle et non par teinte : c'est le rôle qui dit où poser la
 * couleur, et c'est lui qui survit à un changement de charte.
 *
 * Les deux bleus viennent du logo (`frontend/public/logo-lwm.png`), comme la
 * charte web. Le fond profond est le même bleu poussé vers l'ombre : un JT
 * dont le fond appartient à une autre famille que ses bandeaux ne se lit pas
 * comme un tout.
 */
export const COULEURS = {
  /** Fond pleine image : générique, transition, écran d'alerte. */
  fond: '#05203C',
  /** Bandeaux, cartouches, blocs pleins. Le bleu du logo. */
  structure: '#0D4D8B',
  /** Accent soutenu : libellés, chiffres, éléments qui doivent ressortir. */
  accentSoutenu: '#1173C7',
  /** Filets, liserés, lueurs. Le bleu clair du logo. */
  accent: '#51B5E7',

  /**
   * Blanc et noir « sûrs à l'antenne ».
   *
   * Un blanc pur et un noir pur bavent au ré-encodage et sortent de la plage
   * légale d'un signal de diffusion. On plafonne les extrêmes : le texte
   * reste franc, sans halo sur les contours.
   */
  papier: '#F4F7FA',
  encre: '#0F1B2A',

  /** Texte secondaire sur fond clair : un nom de famille, une précision. */
  sourdine: '#6B7A8C',

  /** Réservé aux alertes. Jamais décoratif. */
  alerte: '#C62828',
};

/* ------------------------------------------------------------------ */
/* Typographie                                                         */
/* ------------------------------------------------------------------ */

/**
 * Les deux familles du JT.
 *
 * Dix-huit polices sont livrées avec le moteur de rendu. Ce n'est pas une
 * identité, c'est un menu : deux titres de la même semaine pouvaient sortir
 * dans deux caractères différents. Deux sont retenues ; les seize autres
 * restent disponibles, mais derrière un dépliant, jamais par défaut.
 */
export const CARACTERES = {
  /**
   * Titres, bandeaux, tout ce qui se lit de loin.
   *
   * Une condensée d'information gagne environ un tiers de caractères à
   * hauteur égale. C'est ce qui permet à « Le marché de Douala, un an après
   * la crue » de tenir sur une ligne au lieu d'être coupé — et les titres de
   * reportage du JT sont écrits pour être lus, pas pour être courts.
   *
   * La bascule tient en cette ligne, et s'annule en cette ligne : les
   * gabarits ne nomment plus aucune police, ils lisent tous cette charte.
   */
  titrage: 'Roboto Condensed',
  /** Noms, fonctions, sous-titres, textes courants. */
  courant: 'Inter',
};

/**
 * Les deux familles, prêtes à poser dans un `fontFamily`.
 *
 * `CARACTERES` existait depuis le lot 2 mais **aucun gabarit ne le lisait** :
 * les vingt-huit déclarations de police des habillages natifs nommaient
 * Montserrat en clair. La charte était donc décorative pour la typographie, et
 * la bascule « d'une seule ligne » annoncée n'aurait rien changé à l'image.
 *
 * Montserrat reste en second : si un fichier de fonte manque à l'appel côté
 * worker, le JT sort dans la police d'avant plutôt que dans celle du système.
 * C'est la leçon du lot 3, où une déclaration invalide avait fait retomber
 * quinze habillages en serif sans que personne ne s'en aperçoive.
 */
export const PILES = {
  titrage: `'${CARACTERES.titrage}', 'Montserrat ExtraBold', system-ui, sans-serif`,
  courant: `'${CARACTERES.courant}', 'Montserrat Medium', system-ui, sans-serif`,
};

/**
 * La déclaration `font-family` des quinze habillages importés.
 *
 * Écrite ici, et plus dans chacun des cinq fichiers, parce que c'est
 * exactement le genre de déclaration qu'on ne peut pas laisser diverger.
 * Elle commence par une variable CSS que le répartiteur pose — c'est ce qui
 * rend la police choisissable depuis le studio — et **une variable mal formée
 * suffit à invalider toute la déclaration**. Le navigateur la jette alors et
 * retombe sur sa police par défaut, une serif : les quinze habillages
 * sortaient dans une police qui n'est pas celle du JT pendant que les huit
 * natifs étaient en Montserrat, et rien ne le signalait.
 */
export const POLICE_HABILLAGE =
  `var(--ov-font, "${CARACTERES.titrage}"), "${CARACTERES.titrage}", "Montserrat ExtraBold", system-ui, sans-serif`;

/**
 * La variable de police à poser sur le conteneur d'un habillage importé.
 *
 * **Sans virgule finale.** Elle en portait une, et la déclaration ci-dessus
 * devenait `font-family: 'Montserrat ExtraBold', , "Montserrat ExtraBold", …`
 * — une famille vide entre deux virgules, donc une déclaration invalide, donc
 * la serif par défaut. La virgule existait depuis longtemps mais la variable
 * n'était posée que si le monteur choisissait une police : le défaut ne
 * frappait que ce cas. La rendre toujours définie l'a rendu permanent.
 *
 * Un test compose les deux et vérifie qu'aucune famille de la liste n'est
 * vide, quelle que soit la police choisie.
 */
export function varPolice(overlay) {
  const choisie = (overlay && overlay.font) || CARACTERES.titrage;
  return { '--ov-font': `'${choisie}'` };
}

/**
 * L'échelle, en pixels sur une image de 1920 × 1080.
 *
 * Trente et une tailles circulaient dans `remotion/src`, de 16 à 180, sans
 * rapport entre elles. Quatre suffisent : un JT se lit à quelques mètres,
 * pas à la loupe.
 */
export const TYPO = {
  /** Titre plein écran : générique, breaking news. */
  fort: 96,
  /** Titre de reportage, nom d'un intervenant. */
  titre: 54,
  /** Sous-titre, fonction, lieu. */
  sous: 32,
  /** Surtitre, libellé, mention. Plancher de lisibilité à l'antenne. */
  mention: 22,
};

/**
 * L'interlettrage, en `em` — jamais en `px`, sinon il ne suit pas la taille.
 *
 * Les habillages natifs l'exprimaient en `em`, les habillages importés en
 * `px` : les deux systèmes ne pouvaient pas s'accorder.
 */
export const LETTRAGE = {
  /** Un grand titre serré tient la ligne. */
  titre: '0.01em',
  /** Un texte courant n'a besoin de rien. */
  courant: '0',
  /** Une mention en capitales respire. */
  mention: '0.08em',
};

/** L'interligne, par rôle. */
export const INTERLIGNE = {
  titre: 1.05,
  courant: 1.35,
};

/* ------------------------------------------------------------------ */
/* Mouvement                                                           */
/* ------------------------------------------------------------------ */

/**
 * Trois durées, exprimées en images à 30 i/s.
 *
 * Même principe que le socle de mouvement de l'interface web : une interface
 * paraît soignée quand des gestes de même nature durent le même temps. Les
 * valeurs, elles, ne sont pas les mêmes — un bandeau qui arrive à l'antenne
 * prend plus de temps qu'un bouton qui réagit sous le doigt.
 */
export const MOUVEMENT = {
  /** Un filet, une pastille, un détail. ~0,27 s */
  accent: 8,
  /** Un bandeau, un cartouche qui arrive. ~0,5 s */
  entree: 15,
  /** Un titre plein écran, un générique. ~0,83 s */
  ampleur: 25,
  /** La sortie, toujours plus courte que l'entrée. ~0,4 s */
  sortie: 12,
};

/**
 * Un seul réglage de ressort.
 *
 * Huit réglages distincts coexistaient sur onze appels — damping de 14 à 20,
 * stiffness de 80 à 150 — sans qu'une ligne n'explique pourquoi tel bandeau
 * rebondissait plus que son voisin. Trois seulement servaient à un habillage
 * vivant ; les autres étaient dans du code mort, ce qui n'arrange rien : on
 * hérite d'un désordre dont la moitié ne se voyait même pas à l'image.
 * Celui-ci arrive vite et s'arrête net, sans rebond : la règle de la maison
 * est « pas de rebond » (voir l'en-tête de broadcast.jsx).
 */
export const RESSORT = { damping: 18, stiffness: 110, mass: 1 };

/**
 * Le décalage entre deux éléments qui s'enchaînent, en images.
 * Assez pour qu'on lise une succession, trop peu pour qu'on attende.
 */
export const CASCADE = 4;

/* ------------------------------------------------------------------ */
/* Conversions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Convertit une couleur de la charte au format d'ASS, qui attend du BGR.
 *
 * Permet au générateur du repli libass de lire la même charte que Remotion,
 * plutôt que de recopier les valeurs une quatrième fois.
 */
export function versAss(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => m[1].slice(i, i + 2).toUpperCase());
  return `&H${b}${g}${r}&`;
}

/** Une durée de la charte, convertie pour une cadence autre que 30 i/s. */
export function images(duree, fps = 30) {
  return Math.max(1, Math.round((duree / 30) * fps));
}
