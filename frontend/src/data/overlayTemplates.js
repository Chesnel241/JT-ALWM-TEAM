/**
 * Shared overlay template definitions for the frontend.
 * Mirrors backend/src/data/overlayTemplates.js (field definitions only — no FFmpeg code).
 */
export const OVERLAY_TEMPLATES = [
  {
    id: 'lower_third',
    label: 'Lower Third',
    emoji: '📺',
    preview: 'Nom et titre du journaliste, glisse depuis la gauche',
    fields: [
      { key: 'name',  label: 'Nom complet',       placeholder: 'Ex: Marie Dupont' },
      { key: 'title', label: 'Titre / Fonction',  placeholder: 'Ex: Correspondante à Paris' },
    ],
  },
  {
    id: 'grand_titre',
    label: 'Grand Titre JT',
    emoji: '🎬',
    preview: 'Grand titre centré (révélation gauche→droite) pour l\'ouverture',
    fields: [
      { key: 'title', label: 'Titre principal', placeholder: 'Ex: JOURNAL TÉLÉVISÉ' },
      { key: 'date',  label: 'Date / Édition',  placeholder: 'Ex: Semaine du 26 Mai 2025' },
    ],
  },
  {
    id: 'bandeau_pays',
    label: 'Bandeau Pays',
    emoji: '🌍',
    preview: 'Badge pays en haut à droite, glisse depuis le haut',
    fields: [
      { key: 'pays', label: 'Nom du pays', placeholder: 'Ex: CONGO' },
    ],
  },
  {
    id: 'titre_reportage',
    label: 'Titre Reportage',
    emoji: '📰',
    preview: 'Titre du sujet en bas, glisse depuis le bas',
    fields: [
      { key: 'sujet', label: 'Titre du sujet', placeholder: 'Ex: Élections présidentielles au Bénin' },
    ],
  },
  {
    id: 'flash_info',
    label: 'Flash Info',
    emoji: '⚡',
    preview: 'Bandeau d\'alerte rouge en haut, façon édition spéciale',
    fields: [
      { key: 'texte', label: 'Texte de l\'alerte', placeholder: 'Ex: ÉDITION SPÉCIALE' },
    ],
  },
  {
    id: 'titre_karaoke',
    label: 'Titre Karaoké',
    emoji: '🎤',
    preview: 'Grand titre révélé lettre par lettre (machine à écrire)',
    fields: [
      { key: 'title', label: 'Titre', placeholder: 'Ex: LE GRAND JOURNAL' },
    ],
  },
  {
    id: 'sous_titre',
    label: 'Sous-titre Interview',
    emoji: '💬',
    preview: 'Sous-titre de parole, bas centré, fond sombre',
    fields: [
      { key: 'texte', label: 'Texte', placeholder: 'Ex: « Nous attendons les résultats… »' },
    ],
  },
  {
    id: 'score_resultat',
    label: 'Score / Résultat',
    emoji: '🏆',
    preview: 'Encadré résultat (deux camps + score)',
    fields: [
      { key: 'gauche', label: 'Camp gauche', placeholder: 'Ex: OUI' },
      { key: 'score',  label: 'Score / valeur', placeholder: 'Ex: 54% - 46%' },
      { key: 'droite', label: 'Camp droite', placeholder: 'Ex: NON' },
    ],
  },
  {
    id: 'horloge_date',
    label: 'Horloge / Date',
    emoji: '🕐',
    preview: 'Heure et date en coin haut-gauche',
    fields: [
      { key: 'heure', label: 'Heure', placeholder: 'Ex: 20:00' },
      { key: 'date',  label: 'Date',  placeholder: 'Ex: Lun. 26 Mai' },
    ],
  },
  {
    id: 'lower_third_pro',
    label: 'Lower-Third Pro (2 lignes)',
    emoji: '🟦',
    scope: 'clip',
    preview: 'Style France 24 : titre gras + sous-titre coloré, bas-gauche',
    fields: [
      { key: 'titre', label: 'Titre (gras)', placeholder: 'Ex: LE MAROC ACCROCHÉ' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Ex: Les Lions concèdent le nul (1-1)' },
    ],
  },
  {
    id: 'breaking_news',
    label: 'Breaking News',
    emoji: '🚨',
    scope: 'clip',
    preview: 'Bandeau rouge slanté « DERNIÈRE MINUTE » + sujet',
    fields: [
      { key: 'titre', label: 'Mention', placeholder: 'Ex: DERNIÈRE MINUTE' },
      { key: 'sujet', label: 'Sujet', placeholder: 'Ex: Coup d\'État au Gabon' },
    ],
  },
  {
    id: 'ticker',
    label: 'Bande défilante (ticker)',
    emoji: '📰',
    scope: 'global',
    preview: 'Infos défilant en continu en bas, sur tout le JT',
    fields: [
      { key: 'categorie', label: 'Catégorie (tag)', placeholder: 'Ex: ALERTE' },
      { key: 'texte', label: 'Texte défilant', placeholder: 'Ex: Sommet à Libreville • Élections au Bénin • …' },
    ],
  },
  {
    id: 'live_badge',
    label: 'Badge LIVE / DIRECT',
    emoji: '🔴',
    scope: 'global',
    preview: 'Pastille LIVE/DIRECT en haut à droite, sur tout le JT',
    fields: [
      { key: 'label', label: 'Texte', placeholder: 'Ex: DIRECT' },
    ],
  },
];

// Modèles par clip (liés à un intervenant/plan) vs habillage global (tout le JT).
export const CLIP_TEMPLATES = OVERLAY_TEMPLATES.filter((t) => t.scope !== 'global');
export const GLOBAL_TEMPLATES = OVERLAY_TEMPLATES.filter((t) => t.scope === 'global');

// Animations d'entrée du texte (doit matcher renderText() côté backend).
export const TEXT_ANIMATIONS = [
  { id: 'fade', label: 'Fondu' },
  { id: 'scale', label: 'Zoom' },
  { id: 'sweep', label: 'Balayage couleur' },
  { id: 'typewriter', label: 'Machine à écrire' },
];
