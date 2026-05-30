import { spring, interpolate } from 'remotion';

// Style d'entrée d'un texte/bloc selon overlay.animation, calculé à `frame`.
// Retourne un objet style CSS (transform/opacity/filter). Les per-char sont
// gérés séparément (voir CharText). springs natifs Remotion.
export function entranceStyle(animation, frame, fps, delayFrames = 0) {
  const f = Math.max(0, frame - delayFrames);
  const sp = (cfg) => spring({ frame: f, fps, config: cfg });
  const op = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  switch (animation) {
    case 'scale': {
      const s = interpolate(sp({ damping: 12 }), [0, 1], [0.4, 1]);
      return { opacity: op, transform: `scale(${s})` };
    }
    case 'pop': {
      const s = sp({ damping: 9, stiffness: 140 });
      return { opacity: op, transform: `scale(${interpolate(s, [0, 1], [0.2, 1])})` };
    }
    case 'bounce': {
      const s = spring({ frame: f, fps, config: { damping: 6, stiffness: 120 } });
      return { opacity: op, transform: `translateY(${interpolate(s, [0, 1], [-40, 0])}px)` };
    }
    case 'blurin': {
      const b = interpolate(f, [0, 15], [8, 0], { extrapolateRight: 'clamp' });
      return { opacity: op, filter: `blur(${b}px)` };
    }
    case 'rotate': {
      const r = interpolate(sp({ damping: 12 }), [0, 1], [-12, 0]);
      return { opacity: op, transform: `rotate(${r}deg)` };
    }
    case 'flip3d': {
      const r = interpolate(sp({ damping: 14 }), [0, 1], [90, 0]);
      return { opacity: op, transform: `perspective(800px) rotateY(${r}deg)` };
    }
    case 'rotatex': {
      const r = interpolate(sp({ damping: 14 }), [0, 1], [-60, 0]);
      return { opacity: op, transform: `perspective(800px) rotateX(${r}deg)` };
    }
    case 'rotatey': {
      const r = interpolate(sp({ damping: 14 }), [0, 1], [-60, 0]);
      return { opacity: op, transform: `perspective(800px) rotateY(${r}deg)` };
    }
    case 'slide': {
      const x = interpolate(sp({ damping: 14 }), [0, 1], [-120, 0]);
      return { opacity: op, transform: `translateX(${x}%)` };
    }
    case 'mask_reveal': {
      // Wipe latéral via clip-path (révèle de gauche à droite).
      const p = interpolate(f, [0, 18], [100, 0], { extrapolateRight: 'clamp' });
      return { opacity: 1, clipPath: `inset(0 ${p}% 0 0)` };
    }
    case 'outline_morph': {
      // Contour seul → rempli (impact "newsflash").
      const fill = interpolate(f, [6, 22], [0, 1], { extrapolateRight: 'clamp' });
      const op2 = interpolate(f, [0, 4], [0, 1], { extrapolateRight: 'clamp' });
      return {
        opacity: op2,
        WebkitTextStrokeWidth: '2px',
        WebkitTextStrokeColor: 'currentColor',
        WebkitTextFillColor: `rgba(255,255,255,${fill})`,
      };
    }
    case 'letterspread': {
      // Tracking large → normal, comme un titre cinéma.
      const ls = interpolate(sp({ damping: 18 }), [0, 1], [0.35, 0]);
      return { opacity: op, letterSpacing: `${ls}em`, display: 'inline-block' };
    }
    case 'weight_pulse': {
      // Pulsation poids variable (nécessite font variable — sinon visuellement neutre).
      const w = interpolate(Math.sin((f / fps) * Math.PI * 2), [-1, 1], [500, 900]);
      return { opacity: op, fontVariationSettings: `"wght" ${w}`, fontWeight: Math.round(w) };
    }
    case 'kerning_shake': {
      // Vibration tracking ±0.04em (impact / breaking).
      const k = (Math.sin(f * 0.8) + Math.sin(f * 1.3)) * 0.02;
      return { opacity: op, letterSpacing: `${k}em`, display: 'inline-block' };
    }
    case 'glitch_in': {
      // Sauts horizontaux aléatoires sur les 8 premières frames puis stable.
      const settled = f > 8;
      const o = settled ? 0 : (Math.sin(f * 7.3) * 12);
      const skew = settled ? 0 : (Math.cos(f * 5.1) * 3);
      return {
        opacity: op,
        transform: `translateX(${o}px) skewX(${skew}deg)`,
        textShadow: settled ? 'none' : `2px 0 #f0f, -2px 0 #0ff`,
      };
    }
    case 'fade':
    default:
      return { opacity: op };
  }
}

export const PER_CHAR = new Set(['cascade', 'charpop', 'wave']);

// Style d'un caractère à l'index i pour les animations per-char.
export function charStyle(animation, frame, fps, i) {
  const delay = i * 1.4; // ~45 ms à 30 fps
  const f = Math.max(0, frame - delay);
  const op = interpolate(f, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  if (animation === 'charpop') {
    const s = spring({ frame: f, fps, config: { damping: 9, stiffness: 150 } });
    return { opacity: op, display: 'inline-block', transform: `scale(${interpolate(s, [0, 1], [0, 1])})` };
  }
  if (animation === 'wave') {
    const s = spring({ frame: f, fps, config: { damping: 8 } });
    return { opacity: op, display: 'inline-block', transform: `translateY(${interpolate(s, [0, 1], [-14, 0])}px)` };
  }
  // cascade
  return { opacity: op, display: 'inline-block' };
}
