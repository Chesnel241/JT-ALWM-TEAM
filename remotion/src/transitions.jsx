import React from 'react';
import { AbsoluteFill } from 'remotion';

// Présentations broadcast custom pour <TransitionSeries.Transition presentation={...} />.
// Chaque factory renvoie { component, props } compatible @remotion/transitions.

// Whip pan : push horizontal + flou directionnel proportionnel à la vitesse.
export const whipPan = (props = {}) => ({
  component: WhipPanPresentation,
  props,
});

function WhipPanPresentation({ children, presentationProgress, presentationDirection }) {
  const p = presentationProgress; // 0 → 1
  // Vitesse instantanée (dérivée) approximée par la pente d'une cloche.
  const speed = Math.sin(p * Math.PI); // 0 → 1 → 0
  const blur = speed * 18;
  const x = presentationDirection === 'entering' ? (1 - p) * 100 : -p * 100;
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}%)`, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  );
}

// Glitch cut : 4 tranches horizontales décalées aléatoirement pendant la
// première moitié, puis stabilisation.
export const glitchCut = (props = {}) => ({
  component: GlitchCutPresentation,
  props,
});

function GlitchCutPresentation({ children, presentationProgress, presentationDirection }) {
  const p = presentationProgress;
  const intensity = Math.sin(p * Math.PI); // pic au milieu
  // Deux passes : RGB split + offset.
  const dx = intensity * 14;
  const opacity = presentationDirection === 'entering' ? p : 1 - p;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ transform: `translateX(${dx}px)`, filter: 'hue-rotate(120deg)', mixBlendMode: 'screen', opacity: intensity * 0.6 }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${-dx}px)`, filter: 'hue-rotate(-120deg)', mixBlendMode: 'screen', opacity: intensity * 0.6 }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

// RGB split : aberration chromatique qui pulse pendant la transition.
export const rgbSplit = (props = {}) => ({
  component: RGBSplitPresentation,
  props,
});

function RGBSplitPresentation({ children, presentationProgress, presentationDirection }) {
  const p = presentationProgress;
  const split = Math.sin(p * Math.PI) * 16;
  const opacity = presentationDirection === 'entering' ? p : 1 - p;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ transform: `translateX(${split}px)`, mixBlendMode: 'screen', filter: 'hue-rotate(0deg) saturate(2)', opacity: 0.5 }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${-split}px)`, mixBlendMode: 'screen', filter: 'hue-rotate(180deg) saturate(2)', opacity: 0.5 }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

// Light sweep : bande lumineuse diagonale qui balaye la frame entrante.
export const lightSweep = (props = {}) => ({
  component: LightSweepPresentation,
  props,
});

function LightSweepPresentation({ children, presentationProgress, presentationDirection }) {
  const p = presentationProgress;
  // Bande qui traverse de -30 % à 130 %.
  const pos = p * 160 - 30;
  const opacity = presentationDirection === 'entering' ? p : 1 - p;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(115deg, transparent ${pos - 12}%, rgba(255,255,255,0.85) ${pos}%, transparent ${pos + 12}%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
}

// Flash white : éclair plein écran au moment du cut.
export const flashWhite = (props = {}) => ({
  component: FlashWhitePresentation,
  props,
});

function FlashWhitePresentation({ children, presentationProgress, presentationDirection }) {
  const p = presentationProgress;
  const flash = Math.sin(p * Math.PI); // pic au milieu
  const opacity = presentationDirection === 'entering' ? p : 1 - p;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff', opacity: flash, mixBlendMode: 'screen', pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
}
