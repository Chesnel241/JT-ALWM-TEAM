import fs from 'fs';
import path from 'path';

/**
 * Overlay templates for the video editor.
 * Uses Advanced SubStation Alpha (.ass) rendered by libass for
 * broadcast-style animated JT graphics (slide-ins, fades, clip reveals).
 *
 * Fonts are referenced by their internal family name (name-table ID 1)
 * and resolved at render time via FFmpeg's `ass` filter `fontsdir`
 * option pointing at backend/fonts/. Available families:
 *   - "Inter"         (body / names — bundled)
 *   - "Bebas Neue"    (condensed display)
 *   - "Anton"         (heavy block display)
 *   - "Archivo Black" (ultra-bold sans)
 *   - "Barlow"        (clean sans, semibold)
 * The family string in each \fn tag MUST match the TTF exactly, otherwise
 * libass silently substitutes another font.
 */

// Colours are ASS BGR (&HBBGGRR&). Alpha is &HAA& (00 = opaque, FF = clear).
const COL_WHITE = '&HFFFFFF&';
const COL_BLACK = '&H000000&';
const COL_GOLD = '&H00D7FF&'; // #FFD700
const COL_NAVY = '&H3C1414&'; // deep blue band
const COL_RED = '&H1818D8&'; // alert red
const COL_DARK = '&H1A1A2E&'; // near-black band

// Neutralise ASS control characters so user text can never break the
// override-tag syntax or inject tags.
function safe(s) {
  return (s || '')
    .replace(/\\/g, '/')
    .replace(/[{}]/g, '')
    .replace(/\r?\n/g, ' ')
    .trim();
}

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
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,40,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,7,20,20,20,1

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
    preview: 'Nom et titre du journaliste, glisse depuis la gauche',
    fields: [
      { key: 'name', label: 'Nom complet', placeholder: 'Ex: Marie Dupont' },
      { key: 'title', label: 'Titre / Fonction', placeholder: 'Ex: Correspondante à Paris' },
    ],
    buildAss({ name, title }, start, end) {
      const slide = '\\move(-1100,0,0,0,0,450)';
      return [
        // Bande de fond (navy, semi-transparente) qui glisse de la gauche.
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,950)${slide}\\1c${COL_NAVY}\\1a&H22&\\bord0\\shad0\\p1}m 0 0 l 1060 0 1060 130 0 130{\\p0}`,
        // Liseré doré.
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,950)${slide}\\1c${COL_GOLD}\\bord0\\shad0\\p1}m 0 0 l 12 0 12 130 0 130{\\p0}`,
        // Nom (Inter gras).
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(42,962)\\fnInter\\b1\\fs52\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad2\\fad(300,250)}${safe(name)}`,
        // Fonction (Inter, doré).
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(44,1026)\\fnInter\\fs30\\1c${COL_GOLD}\\3c${COL_BLACK}\\bord1\\shad1\\fad(300,250)}${safe(title)}`,
      ];
    },
  },
  {
    id: 'grand_titre',
    label: 'Grand Titre JT',
    emoji: '🎬',
    preview: "Grand titre centré (révélation gauche→droite) pour l'ouverture",
    fields: [
      { key: 'title', label: 'Titre principal', placeholder: 'Ex: JOURNAL TÉLÉVISÉ' },
      { key: 'date', label: 'Date / Édition', placeholder: 'Ex: Semaine du 26 Mai 2025' },
    ],
    buildAss({ title, date }, start, end) {
      const reveal = '\\clip(0,0,0,1080)\\t(0,550,\\clip(0,0,1920,1080))';
      return [
        // Bandeau central sombre, pleine largeur (coords absolues \an7).
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,448)\\1c${COL_BLACK}\\1a&H40&\\bord0\\shad0\\fad(300,300)\\p1}m 0 0 l 1920 0 1920 184 0 184{\\p0}`,
        // Titre principal (Anton) avec révélation gauche→droite.
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an5\\pos(960,508)\\fnAnton\\fs100\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord2\\shad3\\fad(200,250)${reveal}}${safe(title)}`,
        // Sous-titre date (Bebas Neue, doré).
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an5\\pos(960,602)\\fnBebas Neue\\fs46\\1c${COL_GOLD}\\3c${COL_BLACK}\\bord1\\shad2\\fad(450,300)}${safe(date)}`,
      ];
    },
  },
  {
    id: 'bandeau_pays',
    label: 'Bandeau Pays',
    emoji: '🌍',
    preview: 'Badge pays en haut à droite, glisse depuis le haut',
    fields: [
      { key: 'pays', label: 'Nom du pays', placeholder: 'Ex: CONGO' },
    ],
    buildAss({ pays }, start, end) {
      // Badge ancré en haut à droite (x 1660→1920), glisse depuis le haut.
      const drop = '\\move(1660,-74,1660,20,0,400)';
      return [
        // Badge rouge qui descend.
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7${drop}\\1c${COL_RED}\\bord0\\shad0\\p1}m 0 0 l 260 0 260 64 0 64{\\p0}`,
        // Liseré doré sous le badge.
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7${drop}\\1c${COL_GOLD}\\bord0\\shad0\\p1}m 0 64 l 260 64 260 70 0 70{\\p0}`,
        // Texte pays (Bebas Neue) centré dans le badge.
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an5\\pos(1790,52)\\fnBebas Neue\\fs44\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1\\fad(400,250)}${safe(pays)}`,
      ];
    },
  },
  {
    id: 'titre_reportage',
    label: 'Titre Reportage',
    emoji: '📰',
    preview: "Titre du sujet en bas, glisse depuis le bas",
    fields: [
      { key: 'sujet', label: 'Titre du sujet', placeholder: 'Ex: Élections présidentielles au Bénin' },
    ],
    buildAss({ sujet }, start, end) {
      const rise = '\\move(0,180,0,0,0,420)';
      return [
        // Bandeau bas sombre.
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,1000)${rise}\\1c${COL_DARK}\\1a&H18&\\bord0\\shad0\\p1}m 0 0 l 1920 0 1920 80 0 80{\\p0}`,
        // Liseré doré gauche.
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,1000)${rise}\\1c${COL_GOLD}\\bord0\\shad0\\p1}m 0 0 l 12 0 12 80 0 80{\\p0}`,
        // Texte sujet (Inter gras).
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(34,1018)\\fnInter\\b1\\fs40\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad2\\fad(420,250)}${safe(sujet)}`,
      ];
    },
  },
  {
    id: 'flash_info',
    label: 'Flash Info',
    emoji: '⚡',
    preview: "Bandeau d'alerte rouge en haut, façon édition spéciale",
    fields: [
      { key: 'texte', label: "Texte de l'alerte", placeholder: 'Ex: ÉDITION SPÉCIALE' },
    ],
    buildAss({ texte }, start, end) {
      return [
        // Bandeau rouge plein largeur (fond).
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,0)\\1c${COL_RED}\\bord0\\shad0\\fad(250,250)\\p1}m 0 0 l 1920 0 1920 72 0 72{\\p0}`,
        // Pastille noire "FLASH" (Anton) qui pulse.
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,0)\\1c${COL_BLACK}\\bord0\\shad0\\fad(250,250)\\p1}m 0 0 l 230 0 230 72 0 72{\\p0}`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an4\\pos(28,36)\\fnAnton\\fs40\\1c${COL_WHITE}\\bord0\\fad(250,250)\\t(0,600,\\1a&H60&)\\t(600,1200,\\1a&H00&)}FLASH`,
        // Texte de l'alerte (Inter gras).
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an4\\pos(260,36)\\fnInter\\b1\\fs38\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1\\fad(350,250)}${safe(texte)}`,
      ];
    },
  },
];

export function getTemplate(id) {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
