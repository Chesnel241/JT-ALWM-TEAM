import { staticFile } from 'remotion';
import { COULEURS } from './identite.js';

/**
 * `COL` n'est plus une palette : c'est une table de correspondance vers la
 * charte (`identite.js`), gardée pour les habillages qui l'utilisent déjà.
 *
 * Trois palettes se contredisaient — celle-ci, une locale dans
 * overlays/index.jsx, et la charte web relevée sur le logo. Les teintes
 * viennent désormais toutes du logo ; seuls les rôles sont conservés, pour
 * qu'aucun habillage ne change de hiérarchie en cours de route.
 *
 * Les nouveaux habillages lisent `COULEURS` directement.
 */
export const COL = {
  white: COULEURS.papier,
  black: COULEURS.encre,
  ink: COULEURS.encre,
  // Fond pleine image : dégradés de générique, écrans d'alerte.
  navy: COULEURS.fond,
  dark: COULEURS.fond,
  // Bandeaux et cartouches pleins.
  band: COULEURS.structure,
  ticker: COULEURS.structure,
  // Accents, du plus soutenu au plus clair.
  blue: COULEURS.accentSoutenu,
  light: COULEURS.accent,
  grey: '#1E293B',
  red: COULEURS.alerte,
  // L'or reste un accent ponctuel, hors charte : il ne sert qu'aux habillages
  // « premium » (score, horloge, édition spéciale), tous non enregistrés.
  gold: '#FFD700',
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
  'Montserrat ExtraBold': 'Montserrat-ExtraBold.ttf',
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
export const WIDTH = 1920;
export const HEIGHT = 1080;
