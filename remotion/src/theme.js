import { staticFile } from 'remotion';

// Palette ALWM TV (brand officiel) :
// - navy : bleu marine (fond habillage principal)
// - blue : bleu électrique (accent CTA / barres / chiffres)
// - light : bleu clair (highlights, dégradés)
// Le rouge reste réservé à FLASH INFO / ALERTE INFO ; le gold est un accent
// premium ponctuel (LA SPÉCIALE, score, horloge).
// Palette officielle ALWM TV — Broadcast Package v1.0.
// 60% bleu · 30% blanc · 10% noir. Globe + colombe + bleu = signature.
export const COL = {
  white: '#FFFFFF',
  black: '#0A0A0A',
  gold: '#FFD700',          // accent premium ponctuel (rétro-compat)
  navy: '#031A3A',          // alwm-dark-blue (fond bleu nuit)
  red: '#D81818',           // rétro-compat (anciens templates)
  dark: '#031A3A',
  blue: '#0057D9',          // alwm-blue (principal)
  light: '#4AA3FF',         // alwm-blue-light (highlights, lignes)
  grey: '#1E293B',          // alwm-grey
  ink: '#0A0A0A',
  ticker: '#031A3A',
};

// Polices bundlées → familles CSS. Chargées via @font-face injecté (loadFonts).
export const FONT_FILES = {
  Inter: 'Inter.ttf',
  'Bebas Neue': 'BebasNeue-Regular.ttf',
  Anton: 'Anton-Regular.ttf',
  'Archivo Black': 'ArchivoBlack-Regular.ttf',
  Barlow: 'Barlow-SemiBold.ttf',
  'Fjalla One': 'FjallaOne-Regular.ttf',
  'PT Serif': 'PTSerif-Bold.ttf',
  'PT Sans': 'PTSans-Bold.ttf',
  'Titillium Web': 'TitilliumWeb-Bold.ttf',
  // Pack broadcast 2026 : condensé display, monospace ticker, serif éditorial,
  // sport, breaking urgent, body neutre.
  Oswald: 'Oswald-SemiBold.ttf',
  'Roboto Condensed': 'RobotoCondensed-Bold.ttf',
  'Russo One': 'RussoOne-Regular.ttf',
  'Playfair Display': 'PlayfairDisplay-ExtraBold.ttf',
  'IBM Plex Sans': 'IBMPlexSans-SemiBold.ttf',
  'JetBrains Mono': 'JetBrainsMono-Medium.ttf',
  'Montserrat Bold': 'Montserrat-Bold.ttf',
  'Montserrat Medium': 'Montserrat-Medium.ttf',
};

export const FONT_FAMILIES = Object.keys(FONT_FILES);

// Injecte les @font-face une seule fois (worker + studio + player).
let injected = false;
export function loadFonts() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const css = Object.entries(FONT_FILES)
    .map(
      ([family, file]) =>
        `@font-face{font-family:'${family}';src:url('${staticFile('fonts/' + file)}') format('truetype');font-display:block;}`
    )
    .join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// Résout la police effective (override overlay.font sinon défaut modèle).
export const ff = (font, fallback) => (font && FONT_FAMILIES.includes(font) ? `'${font}', ${fallback}` : fallback);

// Couleurs custom par overlay (text/bg/accent) avec fallback.
export function pickColors(overlay) {
  const c = (overlay && overlay.colors) || {};
  return {
    text: (fb) => c.text || fb,
    bg: (fb) => c.bg || fb,
    accent: (fb) => c.accent || fb,
  };
}

// Effet contour + halo (libass \bord + \blur) → text-stroke + text-shadow.
export function fxStyle(outline = 0, glow = 0) {
  const out = {};
  if (outline > 0) {
    out.WebkitTextStroke = `${outline}px ${COL.black}`;
    out.paintOrder = 'stroke fill';
  }
  if (glow > 0) out.textShadow = `0 0 ${glow * 2}px currentColor, 0 0 ${glow}px rgba(0,0,0,.7)`;
  return out;
}

// Ancrage par défaut (coords 1920×1080) pour le drag de position.
export const DEFAULT_ANCHOR = {
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

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 720;
