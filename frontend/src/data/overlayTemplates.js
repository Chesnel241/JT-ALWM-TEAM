/**
 * Shared overlay template definitions for the frontend.
 * ALWM TV Graphic Templates
 */
export const OVERLAY_TEMPLATES = [
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
    id: 'nom_interview',
    label: 'Nom Interview (Lower Third)',
    emoji: '🗣️',
    preview: 'Style France 24 : le cartouche glisse, nom apparaît en fondu.',
    fields: [
      { key: 'nom', label: 'Prénom & Nom', placeholder: 'PRÉNOM NOM' },
      { key: 'fonction', label: 'Fonction / Qualité', placeholder: 'FONCTION / QUALITÉ' }
    ]
  },
  {
    id: 'signature_reportage',
    label: 'Signature Reportage',
    emoji: '✍️',
    preview: 'Apparition très rapide et sobre du nom du reporter.',
    fields: [
      { key: 'nom', label: 'Nom du journaliste', placeholder: 'PRÉNOM NOM' }
    ]
  },
  {
    id: 'grand_titre',
    label: 'Grands Titres du JT',
    emoji: '🎬',
    preview: 'Zoom, rotation 3D faible et reflet lumineux.',
    fields: [
      { key: 'titre', label: 'Titre', placeholder: 'LE JOURNAL' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'GRAND TITRE' }
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
    id: 'a_suivre',
    label: 'À Suivre',
    emoji: '⏩',
    preview: 'Carte blanche, barre bleue pousse le texte machine à écrire.',
    fields: [
      { key: 'texte', label: 'Texte d\'annonce', placeholder: 'VOTRE PROGRAMME' }
    ]
  },
  {
    id: 'tout_de_suite',
    label: 'Tout De Suite',
    emoji: '⚡',
    preview: 'Identique à À Suivre, mais plus rapide.',
    fields: [
      { key: 'texte', label: 'Texte d\'annonce', placeholder: 'VOTRE PROGRAMME' }
    ]
  },
  {
    id: 'publicite',
    label: 'Publicité',
    emoji: '📺',
    preview: 'Transition plein écran, fond globe, zoom léger.',
    fields: [
      { key: 'texte', label: 'Texte', placeholder: 'PUBLICITÉ' }
    ]
  },
  {
    id: 'compte_a_rebours',
    label: 'Compte à rebours',
    emoji: '⏳',
    preview: 'Décompte avec flip numérique ou transition verticale.',
    fields: [
      { key: 'texte', label: 'Texte', placeholder: 'NOUS REVENONS DANS UN INSTANT' },
      { key: 'secondes', label: 'Durée (sec)', placeholder: '45' }
    ]
  },
  {
    id: 'la_speciale',
    label: 'La Spéciale',
    emoji: '⭐',
    preview: 'Habillage premium, glissement croisé, scale impact.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'LA SPÉCIALE' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'ÉMISSION SPÉCIALE' }
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
    id: 'bandeau_infos',
    label: 'Bandeau Infos (Défilement)',
    emoji: '📜',
    scope: 'global',
    preview: 'Heure, info, texte qui défile lentement.',
    fields: [
      { key: 'heure', label: 'Heure', placeholder: '20:30' },
      { key: 'info', label: 'Catégorie', placeholder: 'INFO' },
      { key: 'texte', label: 'Texte défilant', placeholder: 'Texte de l\'information qui défile...' }
    ]
  },
  {
    id: 'flash_info',
    label: 'Flash Info',
    emoji: '🔴',
    scope: 'clip',
    preview: 'Flash rouge/bleu lumineux, tremblement, texte.',
    fields: [
      { key: 'titre', label: 'Titre', placeholder: 'FLASH INFO' },
      { key: 'texte', label: 'Texte', placeholder: 'Sujet du flash' }
    ]
  },
  {
    id: 'alerte_info',
    label: 'Alerte Info',
    emoji: '🚨',
    scope: 'clip',
    preview: 'Pulsation rouge, bandeau urgent.',
    fields: [
      { key: 'titre', label: 'Titre', placeholder: 'ALERTE' },
      { key: 'texte', label: 'Texte urgent', placeholder: 'Sujet urgent' }
    ]
  }
];

export const CLIP_TEMPLATES = OVERLAY_TEMPLATES.filter((t) => t.scope !== 'global');
export const GLOBAL_TEMPLATES = OVERLAY_TEMPLATES.filter((t) => t.scope === 'global');

export const FONT_FAMILIES = [
  'Montserrat Bold', 'Montserrat Medium',
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
