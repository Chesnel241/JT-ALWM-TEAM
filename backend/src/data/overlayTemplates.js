import fs from 'fs';
import path from 'path';

/**
 * Overlay templates for the video editor.
 * Using Advanced SubStation Alpha (.ass) format for better animations.
 */

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

export function generateAssFile(overlays, workDir) {
  const assFilename = `overlays_${Date.now()}_${Math.floor(Math.random() * 1000)}.ass`;
  const absoluteAssPath = path.join(workDir, assFilename);
  
  let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,36,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,7,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  overlays.forEach((overlay) => {
    const template = getTemplate(overlay.templateId);
    if (!template) return;
    
    const startSec = overlay.startTime ?? 0;
    const durSec = overlay.duration != null ? overlay.duration : 36000;
    const endSec = startSec + durSec;
    
    const startTimeStr = formatAssTime(startSec);
    const endTimeStr = formatAssTime(endSec);
    
    const dialogues = template.buildAss(overlay.fields || {}, startTimeStr, endTimeStr);
    for (const d of dialogues) {
      assContent += d + '\n';
    }
  });

  fs.writeFileSync(absoluteAssPath, assContent, 'utf8');
  return absoluteAssPath;
}

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
    buildAss({ name, title }, start, end) {
      const safe = (s) => (s || '').replace(/\n/g, ' ');
      const fade = '\\fad(300,300)';
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\pos(0,960)}{\\1c&H000000&}{\\1a&H55&}${fade}{\\p1}m 0 0 l 1056 0 l 1056 70 l 0 70{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\pos(20,975)}{\\an7}{\\fs36}{\\1c&HFFFFFF&}{\\3c&H000000&}{\\shad2}${fade}${safe(name)}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\pos(20,1015)}{\\an7}{\\fs22}{\\1c&H00D7FF&}{\\3c&H000000&}{\\shad1}${fade}${safe(title)}`,
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
    buildAss({ title, date }, start, end) {
      const safe = (s) => (s || '').replace(/\n/g, ' ');
      const fade = '\\fad(300,300)';
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\pos(0,460)}{\\1c&H000000&}{\\1a&H44&}${fade}{\\p1}m 0 0 l 1920 0 l 1920 160 l 0 160{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\pos(960,520)}{\\an8}{\\fs60}{\\1c&HFFFFFF&}{\\3c&H000000&}{\\shad3}${fade}${safe(title)}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\pos(960,590)}{\\an8}{\\fs28}{\\1c&H00D7FF&}{\\3c&H000000&}{\\shad2}${fade}${safe(date)}`,
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
    buildAss({ pays }, start, end) {
      const safe = (s) => (s || '').replace(/\n/g, ' ');
      const fade = '\\fad(300,300)';
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\pos(1680,20)}{\\1c&H0000CC&}{\\1a&H22&}${fade}{\\p1}m 0 0 l 220 0 l 220 50 l 0 50{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\pos(1700,30)}{\\an7}{\\fs30}{\\1c&HFFFFFF&}{\\3c&H000000&}{\\shad2}${fade}${safe(pays)}`,
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
    buildAss({ sujet }, start, end) {
      const safe = (s) => (s || '').replace(/\n/g, ' ');
      const fade = '\\fad(300,300)';
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\pos(0,1000)}{\\1c&H2E1A1A&}{\\1a&H11&}${fade}{\\p1}m 0 0 l 1920 0 l 1920 80 l 0 80{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\pos(0,1000)}{\\1c&H0045FF&}{\\1a&H00&}${fade}{\\p1}m 0 0 l 8 0 l 8 80 l 0 80{\\p0}`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\pos(20,1020)}{\\an7}{\\fs32}{\\1c&HFFFFFF&}{\\3c&H000000&}{\\shad2}${fade}${safe(sujet)}`,
      ];
    },
  },
];

export function getTemplate(id) {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
