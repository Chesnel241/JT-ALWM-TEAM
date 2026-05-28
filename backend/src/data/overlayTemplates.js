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
const COL_BLUE = '&HC04600&'; // bleu info (#0046C0)
const COL_INK = '&H1A1A1A&'; // texte sombre sur fond clair
const COL_TICKER = '&H2F1A0A&'; // fond bandeau ticker (#0A1A2F)

// Familles de polices disponibles (doivent matcher les TTF de backend/fonts,
// nom name-table ID-1). Sert d'allowlist pour l'override \fn par overlay.
export const FONT_FAMILIES = [
  'Inter', 'Bebas Neue', 'Anton', 'Archivo Black', 'Barlow',
  'Fjalla One', 'PT Serif', 'PT Sans', 'Titillium Web',
];

// Tag \fn si la police demandée est valide, sinon vide (garde le défaut du modèle).
function fontTag(font) {
  return font && FONT_FAMILIES.includes(font) ? `\\fn${font}` : '';
}

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
function renderText(raw, animation, font, outline, glow) {
  const s = safe(raw);
  const fn = fontTag(font); // override police (placé après le \fn du modèle → gagne)
  // Tags style (contour + halo) optionnels.
  const ob = Number(outline);
  const gb = Number(glow);
  const fx = (Number.isFinite(ob) && ob > 0 ? `\\bord${Math.min(6, Math.max(0, ob))}` : '')
    + (Number.isFinite(gb) && gb > 0 ? `\\blur${Math.min(10, Math.max(0, gb))}` : '');
  const base = `${fn}${fx}`;
  switch (animation) {
    case 'scale':
      return { prefix: `${base}\\fscx40\\fscy40\\fad(150,150)\\t(0,400,\\fscx100\\fscy100)`, body: s };
    case 'sweep':
      return { prefix: `${base}\\1c${COL_GOLD}\\fad(200,200)\\t(0,600,\\1c${COL_WHITE})`, body: s };
    case 'typewriter':
      return {
        prefix: `${base}\\2a&HFF&`,
        body: [...s].map((c) => `{\\k3}${c === ' ' ? '\\h' : c}`).join(''),
      };
    case 'pop': // overshoot : 0 → 115% → 100%
      return { prefix: `${base}\\fscx0\\fscy0\\fad(120,150)\\t(0,180,\\fscx115\\fscy115)\\t(180,320,\\fscx100\\fscy100)`, body: s };
    case 'bounce': // rebond approximé sur l'échelle verticale
      return { prefix: `${base}\\fscy0\\fad(120,150)\\t(0,150,\\fscy112)\\t(150,260,\\fscy94)\\t(260,360,\\fscy104)\\t(360,440,\\fscy100)`, body: s };
    case 'blurin': // entrée floue → net
      return { prefix: `${base}\\blur8\\fad(150,200)\\t(0,450,\\blur0)`, body: s };
    case 'rotate': // léger redressement
      return { prefix: `${base}\\frz-12\\fad(120,150)\\t(0,400,\\frz0)`, body: s };
    case 'flip3d': // flip Y 90° → 0°
      return { prefix: `${base}\\fry90\\fad(120,200)\\t(0,500,\\fry0)`, body: s };
    case 'rotatex': // basculement axe X
      return { prefix: `${base}\\frx-60\\fad(120,150)\\t(0,450,\\frx0)`, body: s };
    case 'rotatey': // basculement axe Y
      return { prefix: `${base}\\fry-60\\fad(120,150)\\t(0,450,\\fry0)`, body: s };
    case 'fade':
    default:
      return { prefix: `${base}\\fad(300,250)`, body: s };
  }
}

// Liste unique des animations d'entrée valides (source de vérité pour le
// validateur de route + l'UI front).
export const TEXT_ANIMATIONS_IDS = [
  'fade', 'slide', 'scale', 'pop', 'bounce', 'blurin', 'rotate',
  'sweep', 'typewriter', 'flip3d', 'rotatex', 'rotatey',
  'cascade', 'charpop', 'wave',
];

// Animations qui nécessitent un split par caractère (N Dialogues per-char).
const PER_CHAR_ANIMS = new Set(['cascade', 'charpop', 'wave']);

// Génère des Dialogue lines per-char pour kinetic typography. Approxime
// l'avance horizontale (font proportionnel) ≈ fs * 0.55.
function buildPerCharLines({ text, x, y, fontTagStr = '', baseTags = '', fs = 40, anim, startStr, endStr, anchor = '\\an7', delayMs = 45 }) {
  const s = safe(text);
  const chars = [...s];
  const advance = Math.max(8, Math.round(fs * 0.55));
  const lines = [];
  chars.forEach((c, i) => {
    if (c === ' ') return; // espaces : laisser le vide
    const cx = Math.round(x + i * advance);
    const d0 = i * delayMs;
    let tag;
    if (anim === 'cascade') {
      tag = `${anchor}\\pos(${cx},${y})${fontTagStr}${baseTags}\\1a&HFF&\\t(${d0},${d0 + 220},\\1a&H00&)\\fad(0,200)`;
    } else if (anim === 'charpop') {
      tag = `${anchor}\\pos(${cx},${y})${fontTagStr}${baseTags}\\fscx0\\fscy0\\t(${d0},${d0 + 220},\\fscx115\\fscy115)\\t(${d0 + 220},${d0 + 360},\\fscx100\\fscy100)\\fad(120,200)`;
    } else if (anim === 'wave') {
      tag = `${anchor}\\move(${cx},${y - 14},${cx},${y},${d0},${d0 + 280})${fontTagStr}${baseTags}\\fad(150,200)`;
    } else {
      tag = `${anchor}\\pos(${cx},${y})${fontTagStr}${baseTags}\\fad(180,200)`;
    }
    // Échappe caractères de contrôle ASS dans le glyphe.
    const safeChar = c.replace(/[\\{}]/g, '');
    lines.push(`Dialogue: 3,${startStr},${endStr},Default,,0,0,0,,{${tag}}${safeChar}`);
  });
  return lines;
}

// Ancrage par défaut de chaque template (coords PlayRes 1920×1080) pour le
// drag de repositionnement. Sert de référence pour calculer dx/dy.
const DEFAULT_ANCHOR = {
  lower_third: { x: 0, y: 950 },
  lower_third_pro: { x: 72, y: 892 },
  grand_titre: { x: 960, y: 540 },
  titre_karaoke: { x: 960, y: 540 },
  bandeau_pays: { x: 1660, y: 20 },
  titre_reportage: { x: 0, y: 1000 },
  flash_info: { x: 0, y: 0 },
  sous_titre: { x: 960, y: 1014 },
  score_resultat: { x: 960, y: 40 },
  horloge_date: { x: 20, y: 20 },
  breaking_news: { x: 120, y: 150 },
};

// Décale tous les \pos / \move d'une liste de Dialogue strings. Sert au
// drag de position : on déplace chaque template comme un bloc.
function shiftDialogues(lines, dx, dy) {
  if (!dx && !dy) return lines;
  const rx = (n) => Math.round(Number(n) + dx);
  const ry = (n) => Math.round(Number(n) + dy);
  return lines.map((l) =>
    l
      .replace(/\\pos\(([\-\d.]+),([\-\d.]+)\)/g, (m, x, y) => `\\pos(${rx(x)},${ry(y)})`)
      .replace(/\\move\(([\-\d.]+),([\-\d.]+),([\-\d.]+),([\-\d.]+)((?:,[\d.]+){0,2})\)/g,
        (m, x1, y1, x2, y2, t) => `\\move(${rx(x1)},${ry(y1)},${rx(x2)},${ry(y2)}${t || ''})`)
  );
}

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

// Tags ASS d'un sous-titre selon le style choisi (position bas/haut, taille,
// police). Blanc + contour noir épais (lisible sur n'importe quel fond).
function subtitleTags(style) {
  const align = style?.position === 'top' ? '\\an8' : '\\an2';
  const fs = { S: 30, M: 38, L: 48 }[style?.size] || 38;
  return `${align}${fontTag(style?.font)}\\fs${fs}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\shad1`;
}

export function generateAssFile(overlays, workDir, ctx = {}, subtitles = null, subtitleStyle = null) {
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

    let dialogues = template.buildAss(overlay, startTimeStr, endTimeStr, { ...ctx, startSec, endSec, durSec });
    // Drag : si position custom, décaler le template comme un bloc.
    const def = DEFAULT_ANCHOR[overlay.templateId];
    if (def && overlay.position && typeof overlay.position === 'object') {
      const px = Number(overlay.position.x);
      const py = Number(overlay.position.y);
      if (Number.isFinite(px) && Number.isFinite(py)) {
        dialogues = shiftDialogues(dialogues, px - def.x, py - def.y);
      }
    }
    for (const d of dialogues) {
      assContent += d + '\n';
    }
  });

  // Sous-titres (timings déjà calés sur le clip). MarginV : au-dessus du ticker
  // en bas, marge réduite en haut.
  if (Array.isArray(subtitles) && subtitles.length > 0) {
    const tags = subtitleTags(subtitleStyle);
    const mv = subtitleStyle?.position === 'top' ? 40 : 70;
    for (const s of subtitles) {
      if (!s || !s.text || !(s.end > s.start)) continue;
      assContent += `Dialogue: 4,${formatAssTime(Math.max(0, s.start))},${formatAssTime(Math.max(0, s.end))},Default,,0,0,${mv},,{${tags}}${safe(s.text)}\n`;
    }
  }

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
      const lines = [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,950)${slide}\\1c${COL_NAVY}\\1a&H22&\\bord0\\shad0\\p1}m 0 0 l 1060 0 1060 130 0 130{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,950)${slide}\\1c${COL_GOLD}\\bord0\\shad0\\p1}m 0 0 l 12 0 12 130 0 130{\\p0}`,
      ];
      // Nom : per-char si demandé, sinon une seule Dialogue.
      if (PER_CHAR_ANIMS.has(overlay.animation)) {
        lines.push(...buildPerCharLines({
          text: name, x: 42, y: 962, fontTagStr: '\\fnInter', baseTags: `\\b1\\fs52\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad2`,
          fs: 52, anim: overlay.animation, startStr: start, endStr: end,
        }));
      } else {
        const n = renderText(name, overlay.animation, overlay.font, overlay.outline, overlay.glow);
        lines.push(`Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(42,962)\\fnInter\\b1\\fs52\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad2${n.prefix}}${n.body}`);
      }
      lines.push(`Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(44,1026)\\fnInter\\fs30\\1c${COL_GOLD}\\3c${COL_BLACK}\\bord1\\shad1\\fad(350,250)}${safe(title)}`);
      return lines;
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
      const lines = [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,448)\\1c${COL_BLACK}\\1a&H40&\\bord0\\shad0\\fad(300,300)\\p1}m 0 0 l 1920 0 1920 184 0 184{\\p0}`,
      ];
      // Per-char (cascade/charpop/wave) → split. Sinon : révélation clip ou animation choisie.
      if (PER_CHAR_ANIMS.has(overlay.animation)) {
        const txt = safe(title);
        const advance = Math.round(100 * 0.55);
        const totalW = [...txt].length * advance;
        const startX = Math.max(40, 960 - Math.round(totalW / 2));
        lines.push(...buildPerCharLines({
          text: title, x: startX, y: 508, fontTagStr: '\\fnAnton', baseTags: `\\fs100\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord2\\shad3`,
          fs: 100, anim: overlay.animation, startStr: start, endStr: end,
        }));
      } else {
        const useReveal = !overlay.animation || overlay.animation === 'fade';
        const titleAnim = useReveal
          ? '\\fad(200,250)\\clip(0,0,0,1080)\\t(0,550,\\clip(0,0,1920,1080))'
          : renderText(title, overlay.animation, overlay.font, overlay.outline, overlay.glow).prefix;
        const titleBody = overlay.animation === 'typewriter'
          ? renderText(title, overlay.animation, overlay.font, overlay.outline, overlay.glow).body
          : safe(title);
        lines.push(`Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an5\\pos(960,508)\\fnAnton\\fs100\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord2\\shad3${titleAnim}}${titleBody}`);
      }
      lines.push(`Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an5\\pos(960,602)\\fnBebas Neue\\fs46\\1c${COL_GOLD}\\3c${COL_BLACK}\\bord1\\shad2\\fad(450,300)}${safe(date)}`);
      return lines;
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
      const p = renderText(pays, overlay.animation, overlay.font, overlay.outline, overlay.glow);
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
      const lines = [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,1000)${rise}\\1c${COL_DARK}\\1a&H18&\\bord0\\shad0\\p1}m 0 0 l 1920 0 1920 80 0 80{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,1000)${rise}\\1c${COL_GOLD}\\bord0\\shad0\\p1}m 0 0 l 12 0 12 80 0 80{\\p0}`,
      ];
      if (PER_CHAR_ANIMS.has(overlay.animation)) {
        lines.push(...buildPerCharLines({
          text: sujet, x: 34, y: 1018, fontTagStr: '\\fnInter', baseTags: `\\b1\\fs40\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad2`,
          fs: 40, anim: overlay.animation, startStr: start, endStr: end, anchor: '\\an7', delayMs: 35
        }));
      } else {
        const s = renderText(sujet, overlay.animation, overlay.font, overlay.outline, overlay.glow);
        lines.push(`Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(34,1018)\\fnInter\\b1\\fs40\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad2${s.prefix}}${s.body}`);
      }
      return lines;
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
      const lines = [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,0)\\1c${COL_RED}\\bord0\\shad0\\fad(250,250)\\p1}m 0 0 l 1920 0 1920 72 0 72{\\p0}`,
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,0)\\1c${COL_BLACK}\\bord0\\shad0\\fad(250,250)\\p1}m 0 0 l 230 0 230 72 0 72{\\p0}`,
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an4\\pos(28,36)\\fnAnton\\fs40\\1c${COL_WHITE}\\bord0\\fad(250,250)\\t(0,600,\\1a&H60&)\\t(600,1200,\\1a&H00&)}FLASH`,
      ];
      if (PER_CHAR_ANIMS.has(overlay.animation)) {
        lines.push(...buildPerCharLines({
          text: texte, x: 260, y: 36, fontTagStr: '\\fnInter', baseTags: `\\b1\\fs38\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1`,
          fs: 38, anim: overlay.animation, startStr: start, endStr: end, anchor: '\\an4', delayMs: 30
        }));
      } else {
        const x = renderText(texte, overlay.animation, overlay.font, overlay.outline, overlay.glow);
        lines.push(`Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an4\\pos(260,36)\\fnInter\\b1\\fs38\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1${x.prefix}}${x.body}`);
      }
      return lines;
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
      const lines = [
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an2\\pos(960,1010)\\1c${COL_BLACK}\\1a&H40&\\bord0\\shad0\\fad(200,200)\\p1}m -760 -42 l 760 -42 760 42 -760 42{\\p0}`,
      ];
      if (PER_CHAR_ANIMS.has(overlay.animation)) {
        const txt = safe(texte);
        const advance = Math.round(40 * 0.55);
        const totalW = [...txt].length * advance;
        const startX = Math.max(40, 960 - Math.round(totalW / 2));
        lines.push(...buildPerCharLines({
          text: texte, x: startX, y: 1014, fontTagStr: '\\fnInter', baseTags: `\\fs40\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1`,
          fs: 40, anim: overlay.animation, startStr: start, endStr: end, anchor: '\\an2', delayMs: 40
        }));
      } else {
        const x = renderText(texte, overlay.animation, overlay.font, overlay.outline, overlay.glow);
        lines.push(`Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an2\\pos(960,1014)\\fnInter\\fs40\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord1\\shad1${x.prefix}}${x.body}`);
      }
      return lines;
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
    buildAss(overlay, start, end) {
      const { titre, sous_titre } = overlay.fields || {};
      const slideT = '\\move(-1100,892,72,892,0,380)';
      const slideS = '\\move(-1100,958,72,958,0,460)';
      return [
        // Barre titre blanche.
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(72,892)${slideT}\\1c${COL_WHITE}\\bord0\\shad3\\p1}m 0 0 l 980 0 980 64 0 64{\\p0}`,
        // Liseré bleu gauche.
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(72,892)${slideT}\\1c${COL_BLUE}\\bord0\\p1}m 0 0 l 14 0 14 64 0 64{\\p0}`,
        // Titre (Archivo Black, sombre).
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(100,902)\\fnArchivo Black\\fs44\\1c${COL_INK}\\bord0\\fad(420,250)}${safe(titre)}`,
        // Barre sous-titre bleue.
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(72,958)${slideS}\\1c${COL_BLUE}\\bord0\\shad2\\p1}m 0 0 l 820 0 820 52 0 52{\\p0}`,
        // Sous-titre (Inter, blanc).
        `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(92,968)\\fnInter\\b1\\fs30\\1c${COL_WHITE}\\3c${COL_BLACK}\\bord0\\fad(500,250)}${safe(sous_titre)}`,
      ];
    },
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
    buildAss(overlay, start, end) {
      const { titre, sujet } = overlay.fields || {};
      const t = (titre && titre.trim()) || 'DERNIÈRE MINUTE';
      return [
        // Bandeau rouge slanté (parallélogramme).
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(120,150)\\1c${COL_RED}\\bord0\\shad5\\fad(220,0)\\p1}m 60 0 l 900 0 840 132 0 132{\\p0}`,
        // Mention (Anton, blanc, italique léger).
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(180,168)\\fnAnton\\fs66\\1c${COL_WHITE}\\bord0\\shad2\\fad(260,0)}${safe(t)}`,
        // Bandeau sujet blanc sous le rouge.
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(120,290)\\1c${COL_WHITE}\\bord0\\shad3\\fad(380,0)\\clip(120,290,120,420)\\t(0,500,\\clip(120,290,1300,420))\\p1}m 0 0 l 1100 0 1100 70 0 70{\\p0}`,
        // Sujet (Inter gras, sombre).
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an7\\pos(150,302)\\fnInter\\b1\\fs40\\1c${COL_INK}\\bord0\\fad(560,250)}${safe(sujet)}`,
      ];
    },
  },
  {
    id: 'ticker',
    label: 'Bande défilante (ticker)',
    emoji: '📰',
    scope: 'global',
    preview: 'Bandeau d\'infos qui défile en continu en bas, sur tout le JT',
    fields: [
      { key: 'categorie', label: 'Catégorie (tag)', placeholder: 'Ex: ALERTE' },
      { key: 'texte', label: 'Texte défilant', placeholder: 'Ex: Sommet à Libreville • Élections au Bénin • …' },
    ],
    buildAss(overlay, start, end, ctx = {}) {
      const { categorie, texte } = overlay.fields || {};
      const durSec = Math.max(2, ctx.durSec || 30);
      const SPEED = 170; // px/s
      const FS = 32;
      const CHAR_W = 16;
      const sep = '       •       ';
      const unit = (safe(texte) || ' ') + sep;
      const unitW = unit.length * CHAR_W;
      const needW = SPEED * durSec + 1920;
      const repeats = Math.min(400, Math.max(1, Math.ceil(needW / Math.max(1, unitW))));
      const full = unit.repeat(repeats);
      const fullW = repeats * unitW;
      const durMs = Math.round(durSec * 1000);
      const tagW = 230;
      const lines = [
        // Fond de barre.
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,1012)\\1c${COL_TICKER}\\1a&H0A&\\bord0\\shad0\\fad(250,250)\\p1}m 0 0 l 1920 0 1920 68 0 68{\\p0}`,
        // Texte défilant (clip à droite du tag).
        `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an4\\move(1920,1046,${-Math.round(fullW)},1046,0,${durMs})\\clip(${tagW + 4},1010,1920,1080)\\fnInter\\fs${FS}\\1c${COL_WHITE}\\bord0\\shad0}${full}`,
      ];
      // Tag catégorie (rouge) par-dessus, à gauche.
      const tag = safe(categorie);
      if (tag) {
        lines.push(
          `Dialogue: 2,${start},${end},Default,,0,0,0,,{\\an7\\pos(0,1012)\\1c${COL_RED}\\bord0\\shad0\\fad(250,250)\\p1}m 0 0 l ${tagW} 0 ${tagW} 68 0 68{\\p0}`,
          `Dialogue: 3,${start},${end},Default,,0,0,0,,{\\an4\\pos(26,1046)\\fnInter\\b1\\fs30\\1c${COL_WHITE}\\bord0\\fad(250,250)}${tag}`
        );
      }
      return lines;
    },
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
    buildAss(overlay, start, end) {
      const label = (safe(overlay.fields?.label) || 'LIVE').toUpperCase();
      const w = 70 + label.length * 26;
      return [
        // Pastille rouge (clignote légèrement au début).
        `Dialogue: 6,${start},${end},Default,,0,0,0,,{\\an9\\pos(1900,30)\\1c${COL_RED}\\bord0\\shad2\\fad(200,0)\\t(0,700,\\1a&H40&)\\t(700,1400,\\1a&H00&)\\p1}m ${-w} 0 l 0 0 0 56 ${-w} 56{\\p0}`,
        // Point blanc.
        `Dialogue: 7,${start},${end},Default,,0,0,0,,{\\an5\\pos(${1900 - w + 30},58)\\1c${COL_WHITE}\\bord0\\p1}m 0 0 l 14 0 14 14 0 14{\\p0}`,
        // Label.
        `Dialogue: 7,${start},${end},Default,,0,0,0,,{\\an5\\pos(${1900 - w / 2 + 16},58)\\fnInter\\b1\\fs34\\1c${COL_WHITE}\\bord0\\fad(200,0)}${label}`,
      ];
    },
  },
];

export function getTemplate(id) {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
