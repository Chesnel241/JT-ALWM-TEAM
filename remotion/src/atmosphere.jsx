import React, { useId } from 'react';
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
  const uid = useId().replace(/:/g, '');
  const s = Math.max(0, Math.min(1, Number(strength) || 0));
  if (s <= 0) return null;
  const seed = frame % 12;
  const opacity = 0.06 + s * 0.18;
  // ID unique par instance (uid) + variant par frame (seed) pour éviter
  // les collisions si plusieurs Grain coexistent sur la même page.
  const filterId = `grain-${uid}-${seed}`;
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
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

export function GlobalAtmosphere({ strength = 1, fps = 30 }) {
  const frame = useCurrentFrame();
  if (strength <= 0) return null;

  const lineOffset = (frame * 0.5) % 40;
  const sweep = (frame % (10 * fps)) / (10 * fps);
  const sweepX = sweep * 200 - 50;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 1 }}>
      <AbsoluteFill style={{
        background: 'linear-gradient(135deg, rgba(0, 0, 128, 0.4) 0%, rgba(0, 191, 255, 0.3) 100%)',
        mixBlendMode: 'overlay',
      }} />

      <AbsoluteFill style={{ mixBlendMode: 'screen', opacity: 0.3 * strength, transform: `translateY(${(frame * 0.2) % 100}px)` }}>
         <svg width="100%" height="120%" preserveAspectRatio="none">
           <filter id="particles-atm">
             <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="1" seed="42" />
             <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 5 -2" />
           </filter>
           <rect width="100%" height="100%" filter="url(#particles-atm)" />
         </svg>
      </AbsoluteFill>

      <AbsoluteFill style={{
        background: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255, 255, 255, 0.05) 2px, rgba(255, 255, 255, 0.05) 4px)`,
        backgroundSize: '40px 40px',
        backgroundPosition: `${lineOffset}px ${lineOffset}px`,
        opacity: strength * 0.8
      }} />

      <AbsoluteFill style={{
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
      }} />

      <AbsoluteFill style={{
        background: `linear-gradient(115deg, transparent ${sweepX - 10}%, rgba(255, 255, 255, 0.15) ${sweepX}%, transparent ${sweepX + 10}%)`,
        mixBlendMode: 'screen'
      }} />
    </AbsoluteFill>
  );
}
