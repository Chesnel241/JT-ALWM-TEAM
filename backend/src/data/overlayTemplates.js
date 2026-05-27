import fs from 'fs';
import path from 'path';

/**
 * Overlay templates for the video editor.
 * Uses Advanced SubStation Alpha (.ass) rendered by libass for
 * broadcast-style animated JT graphics (slide-ins, fades, clip reveals,
 * scale-in, karaoke/typewriter, colour sweeps).
 *
 * Fonts are referenced by their internal family name (name-table ID 1) and
 * resolved at render time via FFmpeg's `ass` filter `fontsdir` option
 * pointing at backend/fonts/. Available families:
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

// Entrée de texte selon overlay.animation. Retourne les tags à insérer juste
// avant le texte + le corps du texte (transformé pour la machine à écrire).
//   fade       — fondu (défaut)
//   scale      — apparition par zoom
//   sweep      — balayage couleur (or → blanc)
//   typewriter — révélation lettre par lettre (karaoké, secondaire invisible)
function renderText(raw, animation) {
  const s = safe(raw);
  switch (animation) {
    case 'scale':
      return { prefix: '\\fscx40\\fscy40\\fad(150,150)\\t(0,400,\\fscx100\\fscy100)', body: s };
    case 'sweep':
      return { prefix: `\\1c${COL_GOLD}\\fad(200,200)\\t(0,600,\\1c${COL_WHITE})`, body: s };
    case 'typewriter':
      return {
        prefix: '\\2a&HFF&',
        body: [...s].map((c) => `{\\k3}${c === ' ' ? '\\h' : c}`).join(''),
      };
    case 'fade':
    default:
      return { prefix: '\\fad(300,250)', body: s };
  }
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

    const dialogues = template.buildAss(overlay, startTimeStr, endTimeStr);
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
    buildAss(overlay, start, end) {
      const { name, title } = overlay.fields || {};
      const slide = '\\move(-1100,0,0,0,0,450)';
      const n = renderText(name, overlay.animation);
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,950)${slide}\\1c${COL_NAVY}\\1a&H22&\\bord0\\shad0\\p1}m 0 0 l 1060 0 1060 130 0 130{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,950)${slide}\\1c${COL_GOLD}\\bord0\\shad0\\p1}m 0 0 l 12 0 12 130 0 130{\\p0}`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(42,962)\\fnInter\\b1\\fs52\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad2${n.prefix}}${n.body}`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(44,1026)\\fnInter\\fs30\\1c${COL_GOLD}\\3c${COL_BLACK}\\bord1\\shad1\\fad(350,250)}${safe(title)}`,
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
    buildAss(overlay, start, end) {
      const { title, date } = overlay.fields || {};
      // Par défaut : révélation clip gauche→droite. Sinon, l'entrée choisie.
      const useReveal = !overlay.animation || overlay.animation === 'fade';
      const titleAnim = useReveal
        ? '\\fad(200,250)\\clip(0,0,0,1080)\\t(0,550,\\clip(0,0,1920,1080))'
        : renderText(title, overlay.animation).prefix;
      const titleBody = overlay.animation === 'typewriter'
        ? renderText(title, overlay.animation).body
        : safe(title);
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,448)\\1c${COL_BLACK}\\1a&H40&\\bord0\\shad0\\fad(300,300)\\p1}m 0 0 l 1920 0 1920 184 0 184{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an5\\pos(960,508)\\fnAnton\\fs100\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord2\\shad3${titleAnim}}${titleBody}`,
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
    buildAss(overlay, start, end) {
      const { pays } = overlay.fields || {};
      const drop = '\\move(1660,-74,1660,20,0,400)';
      const p = renderText(pays, overlay.animation);
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7${drop}\\1c${COL_RED}\\bord0\\shad0\\p1}m 0 0 l 260 0 260 64 0 64{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7${drop}\\1c${COL_GOLD}\\bord0\\shad0\\p1}m 0 64 l 260 64 260 70 0 70{\\p0}`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an5\\pos(1790,52)\\fnBebas Neue\\fs44\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1${p.prefix}}${p.body}`,
      ];
    },
  },
  {
    id: 'titre_reportage',
    label: 'Titre Reportage',
    emoji: '📰',
    preview: 'Titre du sujet en bas, glisse depuis le bas',
    fields: [
      { key: 'sujet', label: 'Titre du sujet', placeholder: 'Ex: Élections présidentielles au Bénin' },
    ],
    buildAss(overlay, start, end) {
      const { sujet } = overlay.fields || {};
      const rise = '\\move(0,180,0,0,0,420)';
      const s = renderText(sujet, overlay.animation);
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,1000)${rise}\\1c${COL_DARK}\\1a&H18&\\bord0\\shad0\\p1}m 0 0 l 1920 0 1920 80 0 80{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,1000)${rise}\\1c${COL_GOLD}\\bord0\\shad0\\p1}m 0 0 l 12 0 12 80 0 80{\\p0}`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(34,1018)\\fnInter\\b1\\fs40\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad2${s.prefix}}${s.body}`,
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
    buildAss(overlay, start, end) {
      const { texte } = overlay.fields || {};
      const x = renderText(texte, overlay.animation);
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,0)\\1c${COL_RED}\\bord0\\shad0\\fad(250,250)\\p1}m 0 0 l 1920 0 1920 72 0 72{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,0)\\1c${COL_BLACK}\\bord0\\shad0\\fad(250,250)\\p1}m 0 0 l 230 0 230 72 0 72{\\p0}`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an4\\pos(28,36)\\fnAnton\\fs40\\1c${COL_WHITE}\\bord0\\fad(250,250)\\t(0,600,\\1a&H60&)\\t(600,1200,\\1a&H00&)}FLASH`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an4\\pos(260,36)\\fnInter\\b1\\fs38\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1${x.prefix}}${x.body}`,
      ];
    },
  },
  {
    id: 'titre_karaoke',
    label: 'Titre Karaoké',
    emoji: '🎤',
    preview: 'Grand titre révélé lettre par lettre (machine à écrire)',
    fields: [
      { key: 'title', label: 'Titre', placeholder: 'Ex: LE GRAND JOURNAL' },
    ],
    buildAss(overlay, start, end) {
      const { title } = overlay.fields || {};
      // Toujours révélation type machine à écrire.
      const t = renderText(title, 'typewriter');
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an5\\pos(960,540)\\1c${COL_BLACK}\\1a&H50&\\bord0\\shad0\\fad(300,300)\\p1}m 0 0 l 1920 0 1920 170 0 170{\\p0}`,
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,540)\\1c${COL_GOLD}\\bord0\\shad0\\fad(300,300)\\p1}m 0 0 l 1920 0 1920 6 0 6{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an5\\pos(960,625)\\fnAnton\\fs92\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord2\\shad3${t.prefix}}${t.body}`,
      ];
    },
  },
  {
    id: 'sous_titre',
    label: 'Sous-titre Interview',
    emoji: '💬',
    preview: 'Sous-titre de parole, bas centré, fond sombre',
    fields: [
      { key: 'texte', label: 'Texte', placeholder: 'Ex: « Nous attendons les résultats… »' },
    ],
    buildAss(overlay, start, end) {
      const { texte } = overlay.fields || {};
      const x = renderText(texte, overlay.animation);
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an2\\pos(960,1010)\\1c${COL_BLACK}\\1a&H40&\\bord0\\shad0\\fad(200,200)\\p1}m -760 -42 l 760 -42 760 42 -760 42{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an2\\pos(960,1014)\\fnInter\\fs40\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1${x.prefix}}${x.body}`,
      ];
    },
  },
  {
    id: 'score_resultat',
    label: 'Score / Résultat',
    emoji: '🏆',
    preview: 'Encadré résultat (deux camps + score)',
    fields: [
      { key: 'gauche', label: 'Camp gauche', placeholder: 'Ex: OUI' },
      { key: 'score', label: 'Score / valeur', placeholder: 'Ex: 54% - 46%' },
      { key: 'droite', label: 'Camp droite', placeholder: 'Ex: NON' },
    ],
    buildAss(overlay, start, end) {
      const { gauche, score, droite } = overlay.fields || {};
      const drop = '\\move(0,-120,0,0,0,400)';
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an8\\pos(960,40)${drop}\\1c${COL_NAVY}\\1a&H1A&\\bord0\\shad0\\p1}m -460 0 l 460 0 460 130 -460 130{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an8\\pos(740,52)${drop}\\fnBebas Neue\\fs56\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1}${safe(gauche)}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an8\\pos(960,56)${drop}\\fnAnton\\fs48\\1c${COL_GOLD}\\3c${COL_BLACK}\\bord1\\shad2}${safe(score)}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an8\\pos(1180,52)${drop}\\fnBebas Neue\\fs56\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1}${safe(droite)}`,
      ];
    },
  },
  {
    id: 'horloge_date',
    label: 'Horloge / Date',
    emoji: '🕐',
    preview: 'Heure et date en coin haut-gauche',
    fields: [
      { key: 'heure', label: 'Heure', placeholder: 'Ex: 20:00' },
      { key: 'date', label: 'Date', placeholder: 'Ex: Lun. 26 Mai' },
    ],
    buildAss(overlay, start, end) {
      const { heure, date } = overlay.fields || {};
      const slide = '\\move(-340,20,20,20,0,400)';
      return [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(20,20)${slide}\\1c${COL_RED}\\bord0\\shad0\\p1}m 0 0 l 300 0 300 70 0 70{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an4\\pos(36,55)${slide}\\fnBebas Neue\\fs48\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1}${safe(heure)}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an4\\pos(150,52)${slide}\\fnInter\\fs26\\1c${COL_GOLD}\\3c${COL_BLACK}\\bord1}${safe(date)}`,
      ];
    },
  },
];

export function getTemplate(id) {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
