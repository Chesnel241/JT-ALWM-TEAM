import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COULEURS } from './identite.js';

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

/* ------------------------------------------------------------------ */
/* Les transitions de la chaîne                                        */
/* ------------------------------------------------------------------ */
//
// LE BESOIN : les transitions disponibles étaient celles d'un logiciel de
// montage (fondus, volets, effets). Une chaîne a les siennes, reconnaissables,
// aux couleurs de son habillage. Celles-ci suivent la courbe du paquet
// d'antenne : rapides au départ, posées sans rebond.

const poser = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

/**
 * Le volet de la chaîne : un pan bleu incliné, bordé d'un liseré clair,
 * traverse l'image et découvre le plan suivant derrière lui.
 */
export const voletAntenne = (props = {}) => ({ component: VoletAntenne, props });

function VoletAntenne({ children, presentationProgress, presentationDirection }) {
  if (presentationDirection !== 'entering') return <AbsoluteFill>{children}</AbsoluteFill>;
  const p = poser(presentationProgress);
  // Le bord du volet, en % de la largeur ; l'inclinaison décale haut et bas.
  const bord = p * 150 - 25;
  const penche = 14;
  const decoupe = `polygon(0 0, ${bord + penche}% 0, ${bord - penche}% 100%, 0 100%)`;
  const pan = (avance, largeur) => `polygon(${bord + penche + avance}% 0, ${bord + penche + avance + largeur}% 0, ${bord - penche + avance + largeur}% 100%, ${bord - penche + avance}% 100%)`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: decoupe, WebkitClipPath: decoupe }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(165deg, ${COULEURS.fond}, ${COULEURS.structure})`, clipPath: pan(0, 16), WebkitClipPath: pan(0, 16) }} />
      <AbsoluteFill style={{ background: COULEURS.accent, clipPath: pan(16, 2.2), WebkitClipPath: pan(16, 2.2) }} />
      <AbsoluteFill style={{ background: COULEURS.papier, opacity: 0.85, clipPath: pan(-0.9, 0.9), WebkitClipPath: pan(-0.9, 0.9) }} />
    </AbsoluteFill>
  );
}

/**
 * Les lames : le plan suivant arrive par bandes verticales, l'une après
 * l'autre, de gauche à droite.
 */
export const lames = (props = {}) => ({ component: Lames, props });

function Lames({ children, presentationProgress, presentationDirection }) {
  if (presentationDirection !== 'entering') return <AbsoluteFill>{children}</AbsoluteFill>;
  const N = 7;
  const points = [];
  for (let i = 0; i < N; i += 1) {
    // Chaque lame part un peu après la précédente et s'ouvre de gauche à droite.
    const ouverture = poser((presentationProgress - i * 0.075) / 0.5);
    const x0 = (i / N) * 100;
    const x1 = x0 + (100 / N) * ouverture + 0.05;
    points.push(`${x0}% 100%`, `${x0}% 0`, `${x1}% 0`, `${x1}% 100%`);
  }
  const decoupe = `polygon(${points.join(', ')})`;
  return <AbsoluteFill style={{ clipPath: decoupe, WebkitClipPath: decoupe }}>{children}</AbsoluteFill>;
}

/**
 * Le zoom rapide : le plan qui sort fonce vers la caméra et se dissout dans
 * son élan, le suivant arrive de loin et se pose. Sec, sans fioriture.
 */
export const zoomRapide = (props = {}) => ({ component: ZoomRapide, props });

function ZoomRapide({ children, presentationProgress, presentationDirection }) {
  const p = presentationProgress;
  const elan = Math.sin(p * Math.PI); // nul aux extrémités, maximal au milieu
  if (presentationDirection === 'entering') {
    // Le plan suivant arrive de trop près et recule à sa place : jamais plus
    // petit que l'image, donc jamais de cadre visible.
    return (
      <AbsoluteFill style={{ opacity: Math.min(1, p * 2.4), transform: `scale(${(1.22 - 0.22 * poser(p)).toFixed(4)})`, filter: `blur(${(elan * 12).toFixed(2)}px)` }}>
        {children}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ transform: `scale(${(1 + 0.42 * p * p).toFixed(4)})`, filter: `blur(${(elan * 14).toFixed(2)}px)` }}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * Le rideau : le plan suivant arrive en deux moitiés, la haute par la gauche,
 * la basse par la droite, qui se rejoignent au centre.
 */
export const rideau = (props = {}) => ({ component: Rideau, props });

function Rideau({ children, presentationProgress, presentationDirection }) {
  // Le plan qui sort reste en place : c'est le suivant qui vient le couvrir.
  if (presentationDirection !== 'entering') return <AbsoluteFill>{children}</AbsoluteFill>;
  const ecart = (1 - poser(presentationProgress)) * 104;
  const haut = 'inset(0 0 50% 0)';
  const bas = 'inset(50% 0 0 0)';
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${(-ecart).toFixed(2)}%)` }}>
        <AbsoluteFill style={{ clipPath: haut, WebkitClipPath: haut }}>{children}</AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${ecart.toFixed(2)}%)` }}>
        <AbsoluteFill style={{ clipPath: bas, WebkitClipPath: bas }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
