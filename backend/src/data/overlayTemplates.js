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
  'Oswald', 'Roboto Condensed', 'Russo One', 'Playfair Display',
  'IBM Plex Sans', 'JetBrains Mono',
];

// Tag \fn si la police demandée est valide, sinon vide (garde le défaut du modèle).
function fontTag(font) {
  return font && FONT_FAMILIES.includes(font) ? `\\fn${font}` : '';
}

// Convertit un hex #RRGGBB en couleur ASS BGR &HBBGGRR&. Retourne null si invalide.
function hexToBgr(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const r = m[1].slice(0, 2).toUpperCase();
  const g = m[1].slice(2, 4).toUpperCase();
  const b = m[1].slice(4, 6).toUpperCase();
  return `&H${b}${g}${r}&`;
}

// Slots couleur configurables par overlay : text (texte principal), bg (bandeau/
// fond), accent (liseré/secondaire). Retourne BGR ASS ou fallback.
function pickColors(overlay) {
  const c = overlay?.colors || {};
  return {
    text: (txt) => hexToBgr(c.text) || txt,
    bg: (bg) => hexToBgr(c.bg) || bg,
    accent: (ac) => hexToBgr(c.accent) || ac,
  };
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
  // Animations Remotion-only. Libass legacy retombe sur 'fade'
  // (cf. default du switch dans renderText).
  'mask_reveal', 'outline_morph', 'letterspread', 'weight_pulse',
  'kerning_shake', 'glitch_in',
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

// Décale et met à l'échelle tous les \pos / \move d'une liste de Dialogue strings.
// Sert au drag de position et au redimensionnement.
function transformDialogues(lines, defX, defY, dx, dy, scale = 1) {
  if (!dx && !dy && scale === 1) return lines;
  
  // Transformation affine : on redimensionne par rapport au point d'ancrage par défaut, puis on translate.
  const rx = (n) => Math.round(defX + (Number(n) - defX) * scale + dx);
  const ry = (n) => Math.round(defY + (Number(n) - defY) * scale + dy);

  return lines.map((l) => {
    let out = l;
    if (scale !== 1) {
      // Met à l'échelle la police, les bordures et les ombres
      out = out.replace(/\\fs(\d+)/g, (m, val) => `\\fs${Math.round(Number(val) * scale)}`);
      out = out.replace(/\\bord([\d.]+)/g, (m, val) => `\\bord${+(Number(val) * scale).toFixed(1)}`);
      out = out.replace(/\\shad([\d.]+)/g, (m, val) => `\\shad${+(Number(val) * scale).toFixed(1)}`);
    }

    out = out
      .replace(/\\pos\(([\-\d.]+),([\-\d.]+)\)/g, (m, x, y) => `\\pos(${rx(x)},${ry(y)})`)
      .replace(/\\move\(([\-\d.]+),([\-\d.]+),([\-\d.]+),([\-\d.]+)((?:,[\d.]+){0,2})\)/g,
        (m, x1, y1, x2, y2, t) => `\\move(${rx(x1)},${ry(y1)},${rx(x2)},${ry(y2)}${t || ''})`);
        
    return out;
  });
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
    if (def) {
      const dxDrag = overlay.position && typeof overlay.position === 'object' ? Number(overlay.position.x) - def.x : 0;
      const dyDrag = overlay.position && typeof overlay.position === 'object' ? Number(overlay.position.y) - def.y : 0;
      const px = def.x + dxDrag + (Number(overlay.posX) || 0);
      const py = def.y + dyDrag + (Number(overlay.posY) || 0);
      const scale = overlay.scale != null ? Number(overlay.scale) / 100 : 1;
      
      if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(scale)) {
        dialogues = transformDialogues(dialogues, def.x, def.y, px - def.x, py - def.y, scale);
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
    id: 'intro_jt',
    label: 'Intro du JT (générique)',
    emoji: '🌍',
    scope: 'global',
    preview: 'Générique 10 s : réseau mondial, globe, mots-clés, colombe + logo + LE JOURNAL.',
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

export function getTemplate(id) {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
