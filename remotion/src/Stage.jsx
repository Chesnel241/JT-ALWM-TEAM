import React from 'react';
import { AbsoluteFill } from 'remotion';
import { WIDTH, HEIGHT } from './theme.js';

// Conteneur en coordonnées PlayRes 1920×1080 (comme les modèles ASS), mis à
// l'échelle pour remplir la composition (1280×720). Les overlays se
// positionnent en px dans cet espace 1920×1080 → parité avec libass.
export function Stage({ children }) {
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1920,
          height: 1080,
          transform: `scale(${WIDTH / 1920})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}
