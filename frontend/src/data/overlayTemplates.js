/**
 * Shared overlay template definitions for the frontend.
 * Mirrors backend/src/data/overlayTemplates.js (field definitions only — no FFmpeg code).
 */
export const OVERLAY_TEMPLATES = [
  {
    id: 'lower_third',
    label: 'Lower Third',
    emoji: '📺',
    preview: 'Nom et titre du journaliste en bas à gauche',
    fields: [
      { key: 'name',  label: 'Nom complet',       placeholder: 'Ex: Marie Dupont' },
      { key: 'title', label: 'Titre / Fonction',  placeholder: 'Ex: Correspondante à Paris' },
    ],
  },
  {
    id: 'grand_titre',
    label: 'Grand Titre JT',
    emoji: '🎬',
    preview: "Grand titre centré pour l'ouverture du journal",
    fields: [
      { key: 'title', label: 'Titre principal', placeholder: 'Ex: JOURNAL TÉLÉVISÉ' },
      { key: 'date',  label: 'Date / Édition',  placeholder: 'Ex: Semaine du 26 Mai 2025' },
    ],
  },
  {
    id: 'bandeau_pays',
    label: 'Bandeau Pays',
    emoji: '🌍',
    preview: 'Badge pays en haut à droite',
    fields: [
      { key: 'pays', label: 'Nom du pays', placeholder: 'Ex: CONGO' },
    ],
  },
  {
    id: 'titre_reportage',
    label: 'Titre Reportage',
    emoji: '📰',
    preview: 'Titre du sujet affiché en bas de l\'image',
    fields: [
      { key: 'sujet', label: 'Titre du sujet', placeholder: 'Ex: Élections présidentielles au Bénin' },
    ],
  },
];
