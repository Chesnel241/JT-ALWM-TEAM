/**
 * Overlay templates for the video editor.
 * Each template defines how FFmpeg's drawtext filter will render text over video.
 * Fields:
 *   id         - unique identifier
 *   label      - display name in the UI
 *   emoji      - icon for the UI
 *   fields     - list of text inputs the user must fill
 *   preview    - short description for the UI
 *   build(fields, w, h, fontPath) - returns FFmpeg drawtext filter strings
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
    build({ name, title }, fontPath) {
      const safe = (s) => (s || '').replace(/'/g, "\\'").replace(/:/g, '\\:');
      return [
        // White background bar
        `drawbox=x=0:y=ih-120:w=iw*0.55:h=70:color=0x000000AA:t=fill`,
        // Name (large, bold)
        `drawtext=fontfile='${fontPath}':text='${safe(name)}':fontcolor=white:fontsize=36:x=20:y=h-105:shadowcolor=black:shadowx=2:shadowy=2`,
        // Title (smaller, accent yellow)
        `drawtext=fontfile='${fontPath}':text='${safe(title)}':fontcolor=0xFFD700:fontsize=22:x=20:y=h-65:shadowcolor=black:shadowx=1:shadowy=1`,
      ];
    },
  },
  {
    id: 'grand_titre',
    label: 'Grand Titre JT',
    emoji: '🎬',
    preview: 'Grand titre centré pour l\'ouverture du journal',
    fields: [
      { key: 'title', label: 'Titre principal', placeholder: 'Ex: JOURNAL TÉLÉVISÉ' },
      { key: 'date',  label: 'Date / Édition',  placeholder: 'Ex: Semaine du 26 Mai 2025' },
    ],
    build({ title, date }, fontPath) {
      const safe = (s) => (s || '').replace(/'/g, "\\'").replace(/:/g, '\\:');
      return [
        // Dark gradient overlay for readability
        `drawbox=x=0:y=ih/2-80:w=iw:h=160:color=0x000000BB:t=fill`,
        // Main title
        `drawtext=fontfile='${fontPath}':text='${safe(title)}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2-20:shadowcolor=black:shadowx=3:shadowy=3`,
        // Subtitle/date
        `drawtext=fontfile='${fontPath}':text='${safe(date)}':fontcolor=0xFFD700:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2+50:shadowcolor=black:shadowx=2:shadowy=2`,
      ];
    },
  },
  {
    id: 'bandeau_pays',
    label: 'Bandeau Pays',
    emoji: '🌍',
    preview: 'Badge pays en haut à droite',
    fields: [
      { key: 'pays', label: 'Nom du pays', placeholder: 'Ex: CONGO' },
    ],
    build({ pays }, fontPath) {
      const safe = (s) => (s || '').replace(/'/g, "\\'").replace(/:/g, '\\:');
      return [
        `drawbox=x=iw-240:y=20:w=220:h=50:color=0xCC0000DD:t=fill`,
        `drawtext=fontfile='${fontPath}':text='${safe(pays)}':fontcolor=white:fontsize=30:x=iw-220:y=30:shadowcolor=black:shadowx=2:shadowy=2`,
      ];
    },
  },
  {
    id: 'titre_reportage',
    label: 'Titre Reportage',
    emoji: '📰',
    preview: 'Titre du sujet affiché en bas de l\'image',
    fields: [
      { key: 'sujet', label: 'Titre du sujet', placeholder: 'Ex: Élections présidentielles au Bénin' },
    ],
    build({ sujet }, fontPath) {
      const safe = (s) => (s || '').replace(/'/g, "\\'").replace(/:/g, '\\:');
      return [
        `drawbox=x=0:y=ih-80:w=iw:h=80:color=0x1A1A2EEE:t=fill`,
        `drawbox=x=0:y=ih-80:w=8:h=80:color=0xFF4500:t=fill`,
        `drawtext=fontfile='${fontPath}':text='${safe(sujet)}':fontcolor=white:fontsize=32:x=20:y=h-60:shadowcolor=black:shadowx=2:shadowy=2`,
      ];
    },
  },
];

export function getTemplate(id) {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
