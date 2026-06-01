import React from 'react';
import { useCurrentFrame } from 'remotion';
import { COL } from './theme.js';

// Globe filaire animé ALWM TV : sphère (méridiens + parallèles) qui tourne
// lentement, halo, points lumineux (réseau mondial) + arcs qui pulsent.
// 100 % SVG → rendu stable en Chromium headless (pas d'image externe lourde).
//
// Props :
//  - rotateSpeed : deg/frame de la rotation des méridiens (défaut 0.25)
//  - color / glow : couleurs des lignes / du halo
//  - opacity : opacité globale (0→1)
export function WorldMap({ rotateSpeed = 0.25, color = COL.light, glow = COL.blue, opacity = 0.5 }) {
  const frame = useCurrentFrame();
  const rot = (frame * rotateSpeed) % 360;
  // Pulsation des nœuds réseau.
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.08);

  // Méridiens : ellipses dont la largeur varie selon l'angle (effet 3D).
  const meridians = [];
  for (let i = 0; i < 6; i++) {
    const ang = (rot + i * 30) * (Math.PI / 180);
    const rx = Math.abs(Math.cos(ang)) * 300 + 2;
    meridians.push(
      <ellipse key={`m${i}`} cx="500" cy="500" rx={rx} ry="300" fill="none" stroke={color} strokeWidth="1.5" opacity={0.25 + Math.abs(Math.cos(ang)) * 0.5} />
    );
  }
  // Parallèles (latitudes) fixes.
  const parallels = [-220, -120, 0, 120, 220].map((dy, i) => {
    const ry = Math.sqrt(Math.max(0, 1 - (dy / 300) ** 2)) * 300;
    const rx = ry * 1.0;
    return <ellipse key={`p${i}`} cx="500" cy={500 + dy} rx={rx} ry={rx * 0.18} fill="none" stroke={color} strokeWidth="1.2" opacity="0.35" />;
  });

  // Nœuds "réseau" lumineux sur le globe.
  const nodes = [
    [380, 380], [620, 340], [700, 520], [450, 600], [560, 660], [340, 520], [640, 440],
  ];

  return (
    <svg viewBox="0 0 1000 1000" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, opacity }}>
      <defs>
        <radialGradient id="globeHalo" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor={glow} stopOpacity="0" />
          <stop offset="100%" stopColor={glow} stopOpacity="0.35" />
        </radialGradient>
        <filter id="nodeGlow"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {/* halo */}
      <circle cx="500" cy="500" r="320" fill="url(#globeHalo)" />
      {/* contour du globe */}
      <circle cx="500" cy="500" r="300" fill="none" stroke={color} strokeWidth="2" opacity="0.55" />
      {parallels}
      {meridians}
      {/* arcs réseau qui pulsent */}
      <path d="M 380 380 Q 550 250 700 520" fill="none" stroke={glow} strokeWidth="2" opacity={0.3 + pulse * 0.4} />
      <path d="M 450 600 Q 600 560 640 440" fill="none" stroke={glow} strokeWidth="2" opacity={0.2 + (1 - pulse) * 0.4} />
      {nodes.map(([x, y], i) => (
        <circle key={`n${i}`} cx={x} cy={y} r={3 + pulse * 2} fill={COL.white} filter="url(#nodeGlow)" opacity={0.5 + pulse * 0.5} />
      ))}
    </svg>
  );
}
