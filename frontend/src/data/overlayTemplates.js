/**
 * Shared overlay template definitions for the frontend.
 * ALWM TV Graphic Templates
 */
export const OVERLAY_TEMPLATES = [
  {
    id: 'intro_jt',
    label: 'Intro du JT (générique)',
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
    label: 'Titre Reportage',
    emoji: '📰',
    preview: 'Barre bleue glissante, titre avec flou de mouvement.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Un sous-titre ou précision' }
    ]
  },
  {
    id: 'transition_reportage',
    label: 'Transition Reportage',
    emoji: '🎬',
    scope: 'global',
    preview: 'Plein écran, globe lent, texte avec tracking très serré.',
    fields: [
      { key: 'titre', label: 'Texte Transition', placeholder: 'REPORTAGE' }
    ]
  },
  {
    id: 'envato_presenter',
    label: 'Présentateur (Envato Premium)',
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
    label: 'Alerte News (Envato Premium)',
    emoji: '🔥',
    preview: 'Bandeau bicolore à glissement pour les titres chauds.',
    fields: [
      { key: 'tag', label: 'Label (ex: BREAKING NEWS)', placeholder: 'BREAKING NEWS' },
      { key: 'headline', label: 'Gros titre', placeholder: 'LE GROS TITRE DE L\'ACTUALITÉ' }
    ]
  },
  {
    id: 'envato_big_title',
    label: 'Grand Titre (Envato Premium)',
    emoji: '💥',
    preview: 'Titre massif plein écran avec animation élastique biseautée.',
    fields: [
      { key: 'titre', label: 'Gros Titre', placeholder: 'WHAT IS GOING ON IN THE WORLD?' }
    ]
  },
  {
    id: 'envato_ticker',
    label: 'Barre Défilante (Envato Premium)',
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
    label: 'Écran Scindé (Envato Premium)',
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
    label: 'Nom Personne (Lower Third)',
    emoji: '🗣️',
    preview: 'Style France 24 : le cartouche glisse, nom apparaît en fondu.',
    fields: [
      { key: 'nom', label: 'Prénom & Nom', placeholder: 'PRÉNOM NOM' },
      { key: 'fonction', label: 'Fonction / Qualité', placeholder: 'FONCTION / QUALITÉ' }
    ]
  },
  {
    id: 'flash_info',
    label: 'Flash Info',
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
    label: 'Breaking News',
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
    label: 'Rappel des Titres',
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
    label: 'Fin / Merci',
    emoji: '👋',
    preview: 'Bandeau glisse doucement, texte fondu, logo ALWM.',
    fields: [
      { key: 'titre', label: 'Titre', placeholder: 'MERCI' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'DE NOUS AVOIR SUIVIS' }
    ]
  },
  {
    id: 'envato_rep_minimal',
    label: 'Titre Reportage - Minimal Line',
    emoji: '📏',
    preview: 'Une fine ligne s\'étire et révèle le texte.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_skew',
    label: 'Titre Reportage - Double Skew',
    emoji: '💥',
    preview: 'Deux blocs obliques qui se croisent pour former le titre.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_swipe',
    label: 'Titre Reportage - Gradient Swipe',
    emoji: '🌈',
    preview: 'Un balayage lumineux avec un dégradé.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_glass',
    label: 'Titre Reportage - Glassmorphism',
    emoji: '🪟',
    preview: 'Un effet verre dépoli très élégant.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_massif',
    label: 'Titre Reportage - Bloc Massif',
    emoji: '⬛',
    preview: 'Un titre lourd et impactant avec Drop Shadow profond.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_lt_compact',
    label: 'Lower Third - Compact 1 Ligne',
    emoji: '🏷️',
    preview: 'Prénom/nom très rapide, pour les micro-trottoirs.',
    fields: [
      { key: 'nom', label: 'Nom', placeholder: 'PRÉNOM NOM' }
    ]
  },
  {
    id: 'envato_lt_corporate',
    label: 'Lower Third - Duo Corporate',
    emoji: '🏢',
    preview: 'Affichage nom/fonction très carré.',
    fields: [
      { key: 'nom', label: 'Nom', placeholder: 'PRÉNOM NOM' },
      { key: 'fonction', label: 'Fonction', placeholder: 'FONCTION / QUALITÉ' }
    ]
  },
  {
    id: 'envato_lt_interview',
    label: 'Lower Third - Interview',
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
    label: 'Location Pin (Lieu)',
    emoji: '📌',
    preview: 'Petite animation de géolocalisation.',
    fields: [
      { key: 'location', label: 'Lieu', placeholder: 'Paris, France' }
    ]
  },
  {
    id: 'envato_quote',
    label: 'Quote Block (Citation)',
    emoji: '❝',
    preview: 'Magnifique pavé avec des guillemets animés.',
    fields: [
      { key: 'quote', label: 'Citation', placeholder: 'Texte de la citation ici...' },
      { key: 'author', label: 'Auteur', placeholder: 'Nom de l\'auteur' }
    ]
  }
];

export const CLIP_TEMPLATES = OVERLAY_TEMPLATES.filter((t) => t.scope !== 'global');
export const GLOBAL_TEMPLATES = OVERLAY_TEMPLATES.filter((t) => t.scope === 'global');

export const FONT_FAMILIES = [
  'Montserrat ExtraBold', 'Montserrat Bold', 'Montserrat Medium',
  'Inter', 'Bebas Neue', 'Anton', 'Archivo Black', 'Barlow',
  'Fjalla One', 'PT Serif', 'PT Sans', 'Titillium Web',
  'Oswald', 'Roboto Condensed', 'Russo One', 'Playfair Display',
  'IBM Plex Sans', 'JetBrains Mono',
];

export const TEXT_ANIMATIONS_IN = [
  { id: 'fade', label: 'Fondu' },
  { id: 'scale', label: 'Scale' },
  { id: 'slide_left', label: 'Slide Left' },
  { id: 'slide_right', label: 'Slide Right' },
  { id: 'pop', label: 'Pop' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'blurin', label: 'Blur In' },
  { id: 'mask_reveal', label: 'Mask Reveal' },
  { id: 'neon_on', label: 'Allumage Néon' },
  { id: 'glitch_in', label: 'Glitch In' },
  { id: 'rotate', label: 'Rotate' },
  { id: 'flip3d', label: 'Flip 3D' },
  { id: 'letterspread', label: 'Letter Spread' },
  { id: 'typewriter', label: 'Machine à écrire' },
  { id: 'cascade', label: 'Cascade' },
];

export const TEXT_ANIMATIONS_LOOP = [
  { id: 'none', label: 'Aucun (statique)' },
  { id: 'float', label: 'Flottement (Float)' },
  { id: 'pulse', label: 'Pulsation (Pulse)' },
  { id: 'kerning_shake', label: 'Vibration tendue' },
  { id: 'neon_flicker', label: 'Grésillement Néon' },
];

export const TEXT_ANIMATIONS_OUT = [
  { id: 'fade', label: 'Fondu out' },
  { id: 'scale_down', label: 'Scale Down' },
  { id: 'slide_out', label: 'Slide Out (Left)' },
  { id: 'blurout', label: 'Blur Out' },
  { id: 'glitch_out', label: 'Glitch Out' },
  { id: 'typewriter_out', label: 'Machine à écrire (retour)' },
];

export const TEXT_ANIMATIONS = TEXT_ANIMATIONS_IN;
