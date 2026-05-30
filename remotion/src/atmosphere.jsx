import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

// Vignette douce : dégradé radial multiplié sur l'image. `strength` 0→1.
export function Vignette({ strength = 0 }) {
  const s = Math.max(0, Math.min(1, Number(strength) || 0));
  if (s <= 0) return null;
  // Plus s est fort, plus le centre reste clair et les bords sombres.
  const inner = 40 + (1 - s) * 20;
  const outerAlpha = 0.45 + s * 0.45;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, transparent ${inner}%, rgba(0,0,0,${outerAlpha}) 100%)`,
        mixBlendMode: 'multiply',
        pointerEvents: 'none',
      }}
    />
  );
}

// Grain léger via cellules SVG turbulence pré-cyclées. `strength` 0→1.
// On limite à 12 frames distinctes pour ne pas exploser le rendu Chromium.
export function Grain({ strength = 0 }) {
  const frame = useCurrentFrame();
  const s = Math.max(0, Math.min(1, Number(strength) || 0));
  if (s <= 0) return null;
  const seed = frame % 12;
  const opacity = 0.06 + s * 0.18;
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}

// Sweep lumineux diagonal (broadcast bumper) — un passage en boucle.
// `period` en secondes (défaut 8). `strength` 0→1.
export function LightSweep({ strength = 0, periodSec = 8, fps = 30 }) {
  const frame = useCurrentFrame();
  const s = Math.max(0, Math.min(1, Number(strength) || 0));
  if (s <= 0) return null;
  const period = Math.max(1, periodSec) * fps;
  const t = (frame % period) / period;
  const x = t * 200 - 50;
  const alpha = (0.08 + s * 0.18).toFixed(3);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(115deg, transparent ${x - 14}%, rgba(255,255,255,${alpha}) ${x}%, transparent ${x + 14}%)`,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );
}
