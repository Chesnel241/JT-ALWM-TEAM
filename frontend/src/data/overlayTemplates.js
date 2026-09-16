/**
 * Shared overlay template definitions for the frontend.
 * ALWM TV Graphic Templates
 */
export const OVERLAY_TEMPLATES = [
  {
    id: 'intro_jt',
    moment: 'ouverture',
    label: 'Générique d’ouverture',
    emoji: '🌍',
    scope: 'global',
    preview: 'Générique 10 s : réseau, globe, mots-clés, colombe + logo + LE JOURNAL.',
    fields: [
      { key: 'titre', label: 'Titre final', placeholder: 'LE JOURNAL' },
      { key: 'mots', label: 'Mots-clés (séparés par •)', placeholder: 'ACTUALITÉ • POLITIQUE • ÉCONOMIE • SPORT • CULTURE • MONDE' }
    ]
  },
  {
    id: 'titre_reportage',
    moment: 'titrage',
    label: 'Titre de reportage',
    emoji: '📰',
    preview: 'Barre bleue glissante, titre avec flou de mouvement.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Un sous-titre ou précision' }
    ]
  },
  {
    id: 'transition_reportage',
    moment: 'liaison',
    label: 'Transition',
    emoji: '🎬',
    scope: 'global',
    preview: 'Plein écran, globe lent, texte avec tracking très serré.',
    fields: [
      { key: 'titre', label: 'Texte Transition', placeholder: 'REPORTAGE' }
    ]
  },
  {
    id: 'envato_presenter',
    moment: 'identification',
    label: 'Présentateur',
    emoji: '🎙️',
    preview: 'Bandeau 3 lignes élégant avec masques de révélation.',
    fields: [
      { key: 'context', label: 'Contexte (Surtitre)', placeholder: 'TONY NIGHT SHOW' },
      { key: 'name', label: 'Prénom & Nom', placeholder: 'MARINA FORESTER' },
      { key: 'title', label: 'Fonction (Sous-titre)', placeholder: 'ADMINISTRATOR' }
    ]
  },
  {
    id: 'envato_news',
    moment: 'alerte',
    label: 'Alerte en bandeau',
    emoji: '🔥',
    preview: 'Bandeau bicolore à glissement pour les titres chauds.',
    fields: [
      { key: 'tag', label: 'Label (ex: BREAKING NEWS)', placeholder: 'BREAKING NEWS' },
      { key: 'headline', label: 'Gros titre', placeholder: 'LE GROS TITRE DE L\'ACTUALITÉ' }
    ]
  },
  {
    id: 'envato_big_title',
    moment: 'ouverture',
    label: 'Grand titre',
    emoji: '💥',
    preview: 'Titre massif plein écran avec animation élastique biseautée.',
    fields: [
      { key: 'titre', label: 'Gros Titre', placeholder: 'WHAT IS GOING ON IN THE WORLD?' }
    ]
  },
  {
    id: 'envato_ticker',
    moment: 'liaison',
    label: 'Barre défilante',
    emoji: '📜',
    scope: 'global',
    preview: 'Bandeau d\'information continu en bas de l\'écran.',
    fields: [
      { key: 'tag', label: 'Label (ex: LIVE)', placeholder: 'LIVE' },
      { key: 'text1', label: 'Info 1', placeholder: 'Texte défilant...' },
      { key: 'text2', label: 'Info 2', placeholder: 'Texte défilant...' }
    ]
  },
  {
    id: 'envato_split_screen',
    moment: 'liaison',
    label: 'Écran scindé',
    emoji: '✂️',
    preview: 'Séparation diagonale animée avec labels géographiques.',
    fields: [
      { key: 'leftLocation', label: 'Titre Gauche', placeholder: 'NEW YORK' },
      { key: 'leftSub', label: 'Sous-titre Gauche', placeholder: 'USA' },
      { key: 'rightLocation', label: 'Titre Droit', placeholder: 'CALIFORNIA' },
      { key: 'rightSub', label: 'Sous-titre Droit', placeholder: 'USA' }
    ]
  },
  {
    id: 'nom_interview',
    moment: 'identification',
    label: 'Nom et fonction',
    emoji: '🗣️',
    preview: 'Style France 24 : le cartouche glisse, nom apparaît en fondu.',
    fields: [
      { key: 'nom', label: 'Prénom & Nom', placeholder: 'PRÉNOM NOM' },
      { key: 'fonction', label: 'Fonction / Qualité', placeholder: 'FONCTION / QUALITÉ' }
    ]
  },
  {
    id: 'flash_info',
    moment: 'alerte',
    label: 'Flash info',
    emoji: '🔴',
    scope: 'global',
    preview: 'Flash rouge/bleu lumineux, tremblement, texte.',
    fields: [
      { key: 'titre', label: 'Titre', placeholder: 'FLASH INFO' },
      { key: 'texte', label: 'Texte', placeholder: 'Sujet du flash' }
    ]
  },
  {
    id: 'breaking_news',
    moment: 'alerte',
    label: 'Alerte plein écran',
    emoji: '🚨',
    scope: 'global',
    preview: 'Pulsation rouge, bandeau urgent.',
    fields: [
      { key: 'titre', label: 'Titre', placeholder: 'BREAKING NEWS' },
      { key: 'texte', label: 'Texte urgent', placeholder: 'Sujet urgent' }
    ]
  },
  {
    id: 'rappel_titres',
    moment: 'cloture',
    label: 'Rappel des titres',
    emoji: '📑',
    preview: 'Titres glissant séquentiellement en cascade.',
    fields: [
      { key: 'titre1', label: 'Titre 1', placeholder: 'TITRE DU SUJET À LA UNE' },
      { key: 'titre2', label: 'Titre 2', placeholder: 'AUTRE TITRE DU SUJET' },
      { key: 'titre3', label: 'Titre 3', placeholder: 'DERNIER TITRE DU JOURNAL' }
    ]
  },
  {
    id: 'fin_merci',
    moment: 'cloture',
    label: 'Carte de clôture',
    emoji: '👋',
    preview: 'Bandeau glisse doucement, texte fondu, logo ALWM.',
    fields: [
      { key: 'titre', label: 'Titre', placeholder: 'MERCI' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'DE NOUS AVOIR SUIVIS' }
    ]
  },
  {
    id: 'envato_rep_minimal',
    moment: 'titrage',
    label: 'Titre — filet fin',
    emoji: '📏',
    preview: 'Une fine ligne s\'étire et révèle le texte.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_skew',
    moment: 'titrage',
    label: 'Titre — double biseau',
    emoji: '💥',
    preview: 'Deux blocs obliques qui se croisent pour former le titre.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_swipe',
    moment: 'titrage',
    label: 'Titre — balayage lumineux',
    emoji: '🌈',
    preview: 'Un balayage lumineux avec un dégradé.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_glass',
    moment: 'titrage',
    label: 'Titre — verre dépoli',
    emoji: '🪟',
    preview: 'Un effet verre dépoli très élégant.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_massif',
    moment: 'titrage',
    label: 'Titre — bloc massif',
    emoji: '⬛',
    preview: 'Un titre lourd et impactant avec Drop Shadow profond.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_lt_compact',
    moment: 'identification',
    label: 'Nom — une ligne',
    emoji: '🏷️',
    preview: 'Prénom/nom très rapide, pour les micro-trottoirs.',
    fields: [
      { key: 'nom', label: 'Nom', placeholder: 'PRÉNOM NOM' }
    ]
  },
  {
    id: 'envato_lt_corporate',
    moment: 'identification',
    label: 'Nom — deux blocs',
    emoji: '🏢',
    preview: 'Affichage nom/fonction très carré.',
    fields: [
      { key: 'nom', label: 'Nom', placeholder: 'PRÉNOM NOM' },
      { key: 'fonction', label: 'Fonction', placeholder: 'FONCTION / QUALITÉ' }
    ]
  },
  {
    id: 'envato_lt_interview',
    moment: 'identification',
    label: 'Nom — interview à deux',
    emoji: '💬',
    preview: 'Bandeau double pour afficher qui parle face à qui.',
    fields: [
      { key: 'leftName', label: 'Nom Gauche', placeholder: 'JOURNALISTE' },
      { key: 'leftRole', label: 'Rôle Gauche', placeholder: 'HÔTE' },
      { key: 'rightName', label: 'Nom Droit', placeholder: 'INVITÉ' },
      { key: 'rightRole', label: 'Rôle Droit', placeholder: 'EXPERT' }
    ]
  },
  {
    id: 'envato_loc_pin',
    moment: 'identification',
    label: 'Lieu',
    emoji: '📌',
    preview: 'Petite animation de géolocalisation.',
    fields: [
      { key: 'location', label: 'Lieu', placeholder: 'Paris, France' }
    ]
  },
  {
    id: 'envato_quote',
    moment: 'identification',
    label: 'Citation',
    emoji: '❝',
    preview: 'Magnifique pavé avec des guillemets animés.',
    fields: [
      { key: 'quote', label: 'Citation', placeholder: 'Texte de la citation ici...' },
      { key: 'author', label: 'Auteur', placeholder: 'Nom de l\'auteur' }
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
export const MOMENTS = [
  { id: 'ouverture', label: 'Ouverture', aide: 'Lancer le journal ou un sujet.' },
  { id: 'titrage', label: 'Titrage', aide: 'Donner son titre à un reportage.' },
  { id: 'identification', label: 'Identification', aide: 'Dire qui parle, d’où, et ce qu’il a dit.' },
  { id: 'alerte', label: 'Alerte', aide: 'Interrompre pour une information urgente.' },
  { id: 'liaison', label: 'Liaison', aide: 'Passer d’un sujet au suivant, ou faire courir une info.' },
  { id: 'cloture', label: 'Clôture', aide: 'Récapituler et refermer le journal.' },
];

/** Les identifiants des moments, pour les tests et les garde-fous. */
export const MOMENTS_IDS = MOMENTS.map((m) => m.id);

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
  'Montserrat ExtraBold', 'Montserrat Bold', 'Montserrat Medium',
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
  { id: 'fade', label: 'Fondu', famille: 'sobre' },
  { id: 'slide', label: 'Glissé', famille: 'sobre' },
  { id: 'mask_reveal', label: 'Révélation', famille: 'sobre' },
  // Affirmée
  { id: 'pop', label: 'Ressort', famille: 'affirmee' },
  { id: 'scale', label: 'Rapproché', famille: 'affirmee' },
  { id: 'cascade', label: 'Cascade', famille: 'affirmee' },
  // Marquée
  { id: 'typewriter', label: 'Machine à écrire', famille: 'marquee' },
  { id: 'glitch_in', label: 'Saccade', famille: 'marquee' },
  { id: 'blurin', label: 'Flou', famille: 'marquee' },
];

export const TEXT_ANIMATIONS_LOOP = [
  { id: 'none', label: 'Immobile' },
  { id: 'float', label: 'Flottement' },
  { id: 'pulse', label: 'Pulsation' },
];

// « auto » reprend l'entrée : un texte entré en glissant repart en glissant.
// C'est ce qui ramène le choix courant à un seul geste au lieu de trois.
export const TEXT_ANIMATIONS_OUT = [
  { id: 'auto', label: "Comme l'entrée" },
  { id: 'fade', label: 'Fondu' },
  { id: 'scale_down', label: 'Rétréci' },
  { id: 'slide_out', label: 'Glissé' },
  { id: 'blurout', label: 'Flou' },
];

export const TEXT_ANIMATIONS = TEXT_ANIMATIONS_IN;
