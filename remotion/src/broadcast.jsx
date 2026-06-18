import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { COL } from './theme.js';
import { WorldMap } from './worldmap.jsx';

// ===========================================================================
// ALWM TV — Broadcast Package v1.0 : primitives partagées.
// Règle motion : easeOutCubic, jamais de bounce/glitch/rotation rapide.
// ===========================================================================

export const EASE = Easing.out(Easing.cubic);

// interpolate avec easeOutCubic + clamp (sucre).
export function eo(frame, input, output) {
  return interpolate(frame, input, output, {
    easing: EASE,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

// Fond institutionnel commun : dégradé bleu nuit + globe semi-transparent
// à droite (rotation lente, loop) + lignes lumineuses horizontales lentes.
export function BackdropALWM({ globe = true, lines = true, globeOpacity = 0.12, darker = false }) {
  const frame = useCurrentFrame();
  const grad = darker
    ? 'linear-gradient(180deg, #02132B 0%, #04132A 100%)'
    : 'linear-gradient(180deg, #031A3A 0%, #071A33 100%)';
  return (
    <AbsoluteFill style={{ background: grad, overflow: 'hidden' }}>
      {globe && (
        <div style={{
          position: 'absolute', right: '-8%', top: '-12%',
          width: 1100, height: 1100, opacity: globeOpacity,
        }}>
          {/* rotation 360° / 120 s (3600 frames @30fps) */}
          <div style={{ width: '100%', height: '100%', transform: `rotate(${(frame / 3600) * 360}deg)`, transformOrigin: 'center' }}>
            <WorldMap rotateSpeed={0} opacity={1} color={COL.light} glow={COL.blue} />
          </div>
        </div>
      )}
      {lines && (
        <>
          {[0.32, 0.5, 0.68].map((y, i) => {
            const x = ((frame * (0.18 + i * 0.05)) % 140) - 20;
            return (
              <div key={i} style={{
                position: 'absolute', left: `${x}%`, top: `${y * 100}%`,
                width: '60%', height: 2,
                background: 'rgba(74,163,255,0.25)',
                transform: 'skewX(-20deg)',
              }} />
            );
          })}
        </>
      )}
    </AbsoluteFill>
  );
}

// Colombe ALWM (silhouette SVG) — signature symbolique forte. À n'utiliser
// que pour générique / rappel des titres / clôture (charte).
export function Dove({ size = 200, color = COL.white, style = {} }) {
  return (
    <svg viewBox="0 0 100 80" width={size} height={size * 0.8} style={style} aria-hidden="true">
      <path
        fill={color}
        d="M8 46c14 4 26 2 36-6 6-5 10-12 18-14 7-2 14 0 20 5-4-1-8 0-10 3 5 0 9 2 12 6-5-2-10-2-14 1 8 2 14 7 18 14-9-7-19-9-29-6-8 2-14 8-18 15-2-7-6-12-12-15-7-3-14-2-21 1l3-9-13 5 10-9-13 1z"
      />
      {/* aile haute */}
      <path
        fill={color}
        d="M44 30c5-9 13-16 23-18-5 6-7 13-7 20-4-3-10-4-16-2z"
        opacity="0.95"
      />
    </svg>
  );
}

// Colombe qui traverse l'écran de gauche → droite sur [fromF, toF].
export function DoveFlyThrough({ fromF, toF, y = 38, size = 220 }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  if (frame < fromF || frame > toF + 20) return null;
  const x = eo(frame, [fromF, toF], [-size, width + size]);
  const drift = Math.sin((frame - fromF) * 0.08) * 14; // léger vol ondulant
  // Garde-fou monotonie : si toF - fromF < 16, [fromF+8, toF-8] s'inverserait
  // et interpolate throw → crash renderMedia. Sur fenêtre courte on retombe
  // sur un fade triangulaire.
  const span = Math.max(0, toF - fromF);
  const op = span >= 16
    ? interpolate(frame, [fromF, fromF + 8, toF - 8, toF], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [fromF, fromF + span / 2, toF], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: 0, top: `${y}%`,
      transform: `translate(${x}px, ${drift}px)`,
      opacity: op,
      filter: 'drop-shadow(0 0 24px rgba(74,163,255,0.6))',
    }}>
      <Dove size={size} />
    </div>
  );
}
