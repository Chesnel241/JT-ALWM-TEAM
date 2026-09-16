/**
 * Shared overlay template definitions for the frontend.
 * ALWM TV Graphic Templates
 */
/**
 * Ce qu'est un habillage, indépendamment de la langue dans laquelle on le lit.
 *
 * Identifiant, moment du JT, pictogramme, portée, et les clés de ses champs.
 * Pas un mot de texte : libellés, descriptions et intitulés de champ vivent
 * dans le dictionnaire (`i18n/translations.js`, bloc `studio`), en français et
 * en anglais. Le studio était intégralement en français codé en dur — un
 * monteur anglophone disposait d'une station entièrement française — et une
 * chaîne écrite à deux endroits finit toujours par diverger.
 */
export const OVERLAY_TEMPLATES = [
  {
    id: 'intro_jt',
    moment: 'ouverture',
    emoji: '🌍',
    scope: 'global',
    fields: [
      { key: 'titre' },
      { key: 'mots' }
    ]
  },
  {
    id: 'titre_reportage',
    moment: 'titrage',
    emoji: '📰',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'transition_reportage',
    moment: 'liaison',
    emoji: '🎬',
    scope: 'global',
    fields: [
      { key: 'titre' }
    ]
  },
  {
    id: 'envato_presenter',
    moment: 'identification',
    emoji: '🎙️',
    fields: [
      { key: 'context' },
      { key: 'name' },
      { key: 'title' }
    ]
  },
  {
    id: 'envato_news',
    moment: 'alerte',
    emoji: '🔥',
    fields: [
      { key: 'tag' },
      { key: 'headline' }
    ]
  },
  {
    id: 'envato_big_title',
    moment: 'ouverture',
    emoji: '💥',
    fields: [
      { key: 'titre' }
    ]
  },
  {
    id: 'envato_ticker',
    moment: 'liaison',
    emoji: '📜',
    scope: 'global',
    fields: [
      { key: 'tag' },
      { key: 'text1' },
      { key: 'text2' }
    ]
  },
  {
    id: 'envato_split_screen',
    moment: 'liaison',
    emoji: '✂️',
    fields: [
      { key: 'leftLocation' },
      { key: 'leftSub' },
      { key: 'rightLocation' },
      { key: 'rightSub' }
    ]
  },
  {
    id: 'nom_interview',
    moment: 'identification',
    emoji: '🗣️',
    fields: [
      { key: 'nom' },
      { key: 'fonction' }
    ]
  },
  {
    id: 'flash_info',
    moment: 'alerte',
    emoji: '🔴',
    scope: 'global',
    fields: [
      { key: 'titre' },
      { key: 'texte' }
    ]
  },
  {
    id: 'breaking_news',
    moment: 'alerte',
    emoji: '🚨',
    scope: 'global',
    fields: [
      { key: 'titre' },
      { key: 'texte' }
    ]
  },
  {
    id: 'rappel_titres',
    moment: 'cloture',
    emoji: '📑',
    fields: [
      { key: 'titre1' },
      { key: 'titre2' },
      { key: 'titre3' }
    ]
  },
  {
    id: 'fin_merci',
    moment: 'cloture',
    emoji: '👋',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_minimal',
    moment: 'titrage',
    emoji: '📏',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_skew',
    moment: 'titrage',
    emoji: '💥',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_swipe',
    moment: 'titrage',
    emoji: '🌈',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_glass',
    moment: 'titrage',
    emoji: '🪟',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_massif',
    moment: 'titrage',
    emoji: '⬛',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_lt_compact',
    moment: 'identification',
    emoji: '🏷️',
    fields: [
      { key: 'nom' }
    ]
  },
  {
    id: 'envato_lt_corporate',
    moment: 'identification',
    emoji: '🏢',
    fields: [
      { key: 'nom' },
      { key: 'fonction' }
    ]
  },
  {
    id: 'envato_lt_interview',
    moment: 'identification',
    emoji: '💬',
    fields: [
      { key: 'leftName' },
      { key: 'leftRole' },
      { key: 'rightName' },
      { key: 'rightRole' }
    ]
  },
  {
    id: 'envato_loc_pin',
    moment: 'identification',
    emoji: '📌',
    fields: [
      { key: 'location' }
    ]
  },
  {
    id: 'envato_quote',
    moment: 'identification',
    emoji: '❝',
    fields: [
      { key: 'quote' },
      { key: 'author' }
    ]
  }
];

/**
 * Les six moments d'un JT, dans l'ordre où ils arrivent à l'antenne.
 *
 * Le catalogue était rangé par portée technique — « clip » ou « global » —
 * c'est-à-dire par un détail d'implémentation que le monteur n'a aucune raison
 * de connaître. Vingt-trois vignettes en une seule liste, et il fallait les
 * parcourir toutes pour retrouver le bandeau nom.
 *
 * Un moment, lui, se cherche comme on pense : « j'ouvre un sujet »,
 * « je nomme quelqu'un », « j'alerte ». La portée technique reste dans les
 * données, elle sert au rendu ; elle ne sert plus de rangement.
 */
export const MOMENTS_IDS = [
  'ouverture', 'titrage', 'identification', 'alerte', 'liaison', 'cloture',
];

/**
 * Le mouvement de texte qui va par défaut avec chaque moment.
 *
 * Tout habillage naissait en « Fondu », quel qu'il soit. Le défaut n'était pas
 * mauvais, il était simplement le même partout : le monteur devait corriger à
 * chaque fois, ou ne rien corriger et livrer vingt-trois fondus.
 *
 * Ces valeurs ne sont pas des règles : le menu reste entier juste à côté.
 */
const RECOMMANDE_PAR_MOMENT = {
  ouverture: 'scale',
  titrage: 'slide',
  identification: 'fade',
  alerte: 'glitch_in',
  liaison: 'fade',
  cloture: 'fade',
};

/**
 * Trois habillages dérogent, parce que leur dessin porte déjà le mouvement.
 * Le générique et l'alerte plein écran ont leur propre chorégraphie ; leur
 * ajouter une entrée marquée ferait deux gestes qui se contrarient.
 */
const RECOMMANDE_PAR_HABILLAGE = {
  intro_jt: 'fade',
  breaking_news: 'fade',
  flash_info: 'fade',
};

/** Le mouvement d'entrée proposé d'emblée pour un habillage donné. */
export function animationRecommandee(templateId) {
  if (RECOMMANDE_PAR_HABILLAGE[templateId]) return RECOMMANDE_PAR_HABILLAGE[templateId];
  const modele = OVERLAY_TEMPLATES.find((t) => t.id === templateId);
  return RECOMMANDE_PAR_MOMENT[modele && modele.moment] || 'fade';
}

/** Les habillages d'un moment, dans l'ordre du catalogue. */
export function habillagesDuMoment(moment, liste = OVERLAY_TEMPLATES) {
  return liste.filter((t) => t.moment === moment);
}

export const CLIP_TEMPLATES = OVERLAY_TEMPLATES.filter((t) => t.scope !== 'global');
export const GLOBAL_TEMPLATES = OVERLAY_TEMPLATES.filter((t) => t.scope === 'global');

export const FONT_FAMILIES = [
  // Deux graisses Montserrat ont été retirées : les fichiers livrés sous
  // ces noms étaient des pages HTML, pas des polices. Les proposer était
  // promettre ce qui n'existe pas.
  'Montserrat ExtraBold',
  'Inter', 'Bebas Neue', 'Anton', 'Archivo Black', 'Barlow',
  'Fjalla One', 'PT Serif', 'PT Sans', 'Titillium Web',
  'Oswald', 'Roboto Condensed', 'Russo One', 'Playfair Display',
  'IBM Plex Sans', 'JetBrains Mono',
];

// Rien ici ne doit sortir de TEXT_ANIMATIONS_IDS côté serveur : le
// validateur de `/editor/concat` refuse le reste avec un 400, et c'est tout
// le master qui ne se génère pas. `animations-offertes.test.js` garde les deux
// listes d'accord.
//
// Et rien ici ne doit sortir de ce que `remotion/src/mouvement.js` implémente
// réellement : ces menus ont proposé vingt-quatre mouvements dont aucun ne
// changeait l'image, parce que le moteur qui les portait n'était appelé par
// personne. `mouvement.test.js` compare désormais les deux sens.
//
// Les mouvements sont groupés par intention : sobre pour le corps du journal,
// affirmée pour l'ouverture d'un sujet, marquée pour les alertes.
export const TEXT_ANIMATIONS_IN = [
  // Sobre
  { id: 'fade', famille: 'sobre' },
  { id: 'slide', famille: 'sobre' },
  { id: 'mask_reveal', famille: 'sobre' },
  // Affirmée
  { id: 'pop', famille: 'affirmee' },
  { id: 'scale', famille: 'affirmee' },
  { id: 'cascade', famille: 'affirmee' },
  // Marquée
  { id: 'typewriter', famille: 'marquee' },
  { id: 'glitch_in', famille: 'marquee' },
  { id: 'blurin', famille: 'marquee' },
];

export const TEXT_ANIMATIONS_LOOP = [
  { id: 'none' },
  { id: 'float' },
  { id: 'pulse' },
];

// « auto » reprend l'entrée : un texte entré en glissant repart en glissant.
// C'est ce qui ramène le choix courant à un seul geste au lieu de trois.
export const TEXT_ANIMATIONS_OUT = [
  { id: 'auto' },
  { id: 'fade' },
  { id: 'scale_down' },
  { id: 'slide_out' },
  { id: 'blurout' },
];

export const TEXT_ANIMATIONS = TEXT_ANIMATIONS_IN;
