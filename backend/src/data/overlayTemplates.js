import fs from 'fs';
import path from 'path';
import { COULEURS, versAss } from '../../../remotion/src/identite.js';

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
// Une quatrieme palette vivait ici, en BGR et sans rapport avec les trois
// autres : le bleu du JT y valait #0046C0 quand Remotion le rendait en
// #0057D9. Ces constantes derivent maintenant de la charte, comme le rendu
// Remotion et l'apercu du studio. `versAss` fait la conversion en BGR.
const COL_WHITE = versAss(COULEURS.papier);
const COL_BLACK = versAss(COULEURS.encre);
const COL_NAVY = versAss(COULEURS.structure);
const COL_RED = versAss(COULEURS.alerte);
const COL_DARK = versAss(COULEURS.fond);
const COL_BLUE = versAss(COULEURS.accentSoutenu);
const COL_INK = versAss(COULEURS.encre);
// L'or reste hors charte : accent ponctuel des habillages non enregistres.
const COL_GOLD = '&H00D7FF&';
const COL_TICKER = '&H2F1A0A&'; // fond bandeau ticker (#0A1A2F)

// Familles de polices disponibles (doivent matcher les TTF de backend/fonts,
// nom name-table ID-1). Sert d'allowlist pour l'override \fn par overlay.
export const FONT_FAMILIES = [
  'Inter', 'Bebas Neue', 'Anton', 'Archivo Black', 'Barlow',
  'Fjalla One', 'PT Serif', 'PT Sans', 'Titillium Web',
  'Oswald', 'Roboto Condensed', 'Russo One', 'Playfair Display',
  'IBM Plex Sans', 'JetBrains Mono',
  // Pack Montserrat (charte ALWM TV).
  'Montserrat ExtraBold', 'Montserrat Bold', 'Montserrat Medium',
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

/**
 * Animations que l'interface a proposées sans que le serveur les accepte.
 *
 * Le studio offrait « Slide Left », « Slide Right » et « Allumage Néon » ;
 * le validateur de `/editor/concat` les refusait avec un 400, et le monteur
 * voyait « Générer le master » échouer sans comprendre pourquoi. Elles ne
 * sont plus proposées, mais un montage enregistré avant cette correction les
 * porte encore : les refuser aujourd'hui rendrait ce montage définitivement
 * inexportable.
 *
 * On les accepte donc en entrée et on les ramène à leur équivalent connu.
 * Aucune n'était rendue de toute façon : le moteur retombe sur un fondu.
 */
export const ANIMATIONS_HERITEES = {
  // Proposées par le studio sans que le serveur les accepte (lot 1).
  slide_left: 'slide',
  slide_right: 'slide',
  neon_on: 'fade',
  // Retirées du menu quand le moteur d'animation est devenu réel : elles
  // n'ont jamais rien produit à l'image, faute de moteur pour les lire.
  // Chacune retombe sur le mouvement retenu le plus proche.
  bounce: 'pop',
  rotate: 'scale',
  flip3d: 'scale',
  letterspread: 'cascade',
  // Boucles retirées, jamais implémentées nulle part.
  kerning_shake: 'fade',
  neon_flicker: 'fade',
};

const ANIMATIONS_HERITEES_IDS = Object.keys(ANIMATIONS_HERITEES);

/** Ramène une animation héritée à sa remplaçante. Laisse tout le reste intact. */
export function normaliserAnimation(id) {
  return ANIMATIONS_HERITEES[id] || id;
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
  // Valeurs héritées, tolérées mais plus proposées (voir ANIMATIONS_HERITEES).
  // Dédoublonnées : plusieurs d'entre elles figuraient déjà ci-dessus — elles
  // étaient acceptées par le serveur, simplement jamais rendues à l'image.
  ...ANIMATIONS_HERITEES_IDS,
].filter((id, i, tous) => tous.indexOf(id) === i);

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
  nom_interview: { x: 0, y: 950 },
  envato_presenter: { x: 0, y: 900 },
  envato_news: { x: 0, y: 900 },
  envato_big_title: { x: 960, y: 540 },
  envato_ticker: { x: 0, y: 1000 },
  envato_split_screen: { x: 960, y: 540 },
  envato_rep_minimal: { x: 0, y: 1000 },
  envato_rep_skew: { x: 0, y: 1000 },
  envato_rep_swipe: { x: 0, y: 1000 },
  envato_rep_glass: { x: 0, y: 1000 },
  envato_rep_massif: { x: 0, y: 1000 },
  envato_lt_compact: { x: 0, y: 950 },
  envato_lt_corporate: { x: 0, y: 950 },
  envato_lt_interview: { x: 0, y: 950 },
  envato_loc_pin: { x: 50, y: 50 },
  envato_quote: { x: 960, y: 540 },
  grand_titre: { x: 960, y: 540 },
  titre_reportage: { x: 0, y: 1000 },
  transition_reportage: { x: 960, y: 540 },
  flash_info: { x: 0, y: 0 },
  breaking_news: { x: 120, y: 150 },
  rappel_titres: { x: 0, y: 0 },
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

/**
 * Rend n'importe quel habillage en lignes ASS, à partir des champs qu'il déclare.
 *
 * Chaque modèle portait autrefois son propre `buildAss`. Ces constructeurs ont
 * disparu lors d'une réécriture du catalogue, mais `generateAssFile` a continué
 * de les appeler : toute liste d'habillages non vide levait
 * « template.buildAss is not a function ». Côté clip l'erreur était avalée et
 * les titres disparaissaient en silence ; côté habillage global elle faisait
 * échouer l'assemblage entier. Les tests ne passaient qu'un tableau vide, donc
 * l'intégration continue ne voyait rien.
 *
 * Ce rendu est volontairement sobre : `libass` est le repli de secours, pas la
 * référence visuelle — celle-ci est Remotion (RENDERER=remotion en production,
 * cf. docs/CLOUD_RUN.md). Il doit produire un JT regardable, avec un texte
 * lisible et bien placé, pas une copie au pixel des habillages Remotion.
 */
function buildAssGenerique(template, overlay, startStr, endStr) {
  const ancre = DEFAULT_ANCHOR[template.id] || { x: 0, y: 950 };
  const C = pickColors(overlay);
  const couleurTexte = C.text(COL_WHITE);

  // Un habillage ancré au centre de l'image se compose centré ; les autres
  // s'alignent à gauche, comme les bandeaux bas dont ils viennent.
  const centre = ancre.x > 600;
  const alignement = centre ? '\\an5' : '\\an7';
  const echelle = overlay.fontSize != null ? Number(overlay.fontSize) / 100 : 1;
  const facteur = Number.isFinite(echelle) && echelle > 0 ? echelle : 1;

  const valeurs = (template.fields || [])
    .map((champ) => ({ cle: champ.key, texte: safe(overlay?.fields?.[champ.key]) }))
    .filter((v) => v.texte);

  if (!valeurs.length) return [];

  // Hauteur du bloc, calculée avant de placer quoi que ce soit : empiler
  // naïvement vers le bas depuis un ancrage déjà situé à y=1000 poussait la
  // deuxième ligne à y=1073, hors d'une image qui s'arrête à 1080.
  const tailles = valeurs.map((_, i) => Math.round((i === 0 ? 54 : 34) * facteur));
  const interlignes = tailles.map((t) => Math.round(t * 1.35));
  const hauteur = interlignes.reduce((a, b) => a + b, 0) - (interlignes.at(-1) - tailles.at(-1));

  const MARGE_BASSE = 1080 - 40;
  let y = centre
    ? ancre.y - Math.round(hauteur / 2) + Math.round(tailles[0] / 2)
    : Math.min(ancre.y, MARGE_BASSE - hauteur);
  y = Math.max(40, y);

  const lignes = [];
  valeurs.forEach((v, i) => {
    // Le premier champ est le titre, les suivants le précisent.
    const taille = tailles[i];
    const { prefix, body } = renderText(
      v.texte, overlay.animation, overlay.font, overlay.outline, overlay.glow
    );
    const x = centre ? ancre.x : ancre.x + 60;
    lignes.push(
      `Dialogue: 3,${startStr},${endStr},Default,,0,0,0,,`
      + `{${alignement}\\pos(${Math.round(x)},${Math.round(y)})\\fs${taille}`
      + `\\1c${couleurTexte}${prefix}}${body}`
    );
    y += interlignes[i];
  });

  return lignes;
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

    // Un modèle peut fournir son propre constructeur ; aucun ne le fait
    // aujourd'hui, et le rendu générique prend le relais.
    let dialogues = typeof template.buildAss === 'function'
      ? template.buildAss(overlay, startTimeStr, endTimeStr, { ...ctx, startSec, endSec, durSec })
      : buildAssGenerique(template, overlay, startTimeStr, endTimeStr);
    if (!Array.isArray(dialogues)) dialogues = [];
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

/**
 * Le catalogue cote serveur.
 *
 * Il ne sert qu'a deux choses : valider l'identifiant d'un habillage recu du
 * studio, et retrouver son gabarit pour le repli ASS. Il ne porte donc que ce
 * que le rendu lit — identifiant, portee, cles de champ — et plus aucune
 * donnee d'affichage.
 *
 * Il en portait : libelles, emojis, apercus, intitules et exemples de champ,
 * recopies du studio et deja divergents. Une donnee d'affichage que rien
 * n'affiche ne peut que pourrir, et c'est cette famille de derive qui avait
 * laisse deux habillages lire des champs que le catalogue ne declarait pas.
 * `data-mirror.test.js` compare maintenant les deux catalogues sur ce qui
 * compte : les identifiants, la portee et les cles de champ.
 */
export const OVERLAY_TEMPLATES = [
  {
    id: 'intro_jt',
    scope: 'global',
    fields: [
      { key: 'titre' },
      { key: 'mots' }
    ]
  },
  {
    id: 'titre_reportage',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'transition_reportage',
    scope: 'global',
    fields: [
      { key: 'titre' }
    ]
  },
  {
    id: 'envato_presenter',
    fields: [
      { key: 'context' },
      { key: 'name' },
      { key: 'title' }
    ]
  },
  {
    id: 'envato_news',
    fields: [
      { key: 'tag' },
      { key: 'headline' }
    ]
  },
  {
    id: 'envato_big_title',
    fields: [
      { key: 'titre' }
    ]
  },
  {
    id: 'envato_ticker',
    scope: 'global',
    fields: [
      { key: 'tag' },
      { key: 'text1' },
      { key: 'text2' }
    ]
  },
  {
    id: 'envato_split_screen',
    fields: [
      { key: 'leftLocation' },
      { key: 'leftSub' },
      { key: 'rightLocation' },
      { key: 'rightSub' }
    ]
  },
  {
    id: 'nom_interview',
    fields: [
      { key: 'nom' },
      { key: 'fonction' }
    ]
  },
  {
    id: 'flash_info',
    scope: 'global',
    fields: [
      { key: 'titre' },
      { key: 'texte' }
    ]
  },
  {
    id: 'breaking_news',
    scope: 'global',
    fields: [
      { key: 'titre' },
      { key: 'texte' }
    ]
  },
  {
    id: 'rappel_titres',
    fields: [
      { key: 'titre1' },
      { key: 'titre2' },
      { key: 'titre3' }
    ]
  },
  {
    id: 'fin_merci',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_minimal',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_skew',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_swipe',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_glass',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_rep_massif',
    fields: [
      { key: 'titre' },
      { key: 'sous_titre' }
    ]
  },
  {
    id: 'envato_lt_compact',
    fields: [
      { key: 'nom' }
    ]
  },
  {
    id: 'envato_lt_corporate',
    fields: [
      { key: 'nom' },
      { key: 'fonction' }
    ]
  },
  {
    id: 'envato_lt_interview',
    fields: [
      { key: 'leftName' },
      { key: 'leftRole' },
      { key: 'rightName' },
      { key: 'rightRole' }
    ]
  },
  {
    id: 'envato_loc_pin',
    fields: [
      { key: 'location' }
    ]
  },
  {
    id: 'envato_quote',
    fields: [
      { key: 'quote' },
      { key: 'author' }
    ]
  }
];

export function getTemplate(id) {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
