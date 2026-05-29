import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { COL, ff } from './theme.js';

// Bande défilante (ticker) continue — translateX en boucle.
export function Ticker({ ticker }) {
  const frame = useCurrentFrame();
  if (!ticker || !ticker.enabled || !ticker.texte) return null;
  const sep = '       •       ';
  const unit = ticker.texte + sep;
  // Défilement : ~170 px/s à 30 fps. Texte doublé pour boucle sans couture.
  const speed = 170 / 30;
  const x = -((frame * speed) % 2000);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 76, background: COL.ticker, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      {ticker.categorie && (
        <span style={{ background: COL.red, color: COL.white, fontWeight: 800, height: '100%', display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0, fontFamily: ff(null, 'Inter, sans-serif'), fontSize: 30 }}>{ticker.categorie}</span>
      )}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', height: '100%' }}>
        <div style={{ position: 'absolute', whiteSpace: 'nowrap', transform: `translateX(${x}px)`, top: 0, lineHeight: '76px', color: COL.white, fontFamily: 'Inter, sans-serif', fontSize: 32 }}>
          <span style={{ padding: '0 30px' }}>{unit}</span>
          <span style={{ padding: '0 30px' }}>{unit}</span>
          <span style={{ padding: '0 30px' }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}

// Badge LIVE / DIRECT pulsant, coin haut-droit.
export function LiveBadge({ live }) {
  const frame = useCurrentFrame();
  if (!live || !live.enabled) return null;
  const pulse = interpolate(Math.sin(frame / 6), [-1, 1], [0.5, 1]);
  return (
    <div style={{ position: 'absolute', right: 30, top: 24, background: COL.red, color: COL.white, fontWeight: 800, fontSize: 32, padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter, sans-serif', opacity: pulse }}>
      <span style={{ width: 14, height: 14, background: COL.white, borderRadius: '50%' }} />
      {(live.label || 'LIVE').toUpperCase()}
    </div>
  );
}

const LOGO_POS = {
  tl: { left: 40, top: 40 },
  tr: { right: 40, top: 40 },
  bl: { left: 40, bottom: 40 },
  br: { right: 40, bottom: 40 },
  center: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' },
};

// Logo chaîne incrusté ; surélevé si ticker actif et position basse.
export function Logo({ logo, logoPosition, tickerOn }) {
  if (!logo) return null;
  const pos = { ...(LOGO_POS[logoPosition] || LOGO_POS.br) };
  if (tickerOn && (logoPosition === 'bl' || logoPosition === 'br' || !logoPosition)) pos.bottom = 120;
  return <Img src={staticFile('logo-lwm.png')} style={{ position: 'absolute', height: 130, opacity: 0.9, ...pos }} />;
}

// Sous-titres : style position/taille/police, affichés selon le timing courant.
export function Subtitles({ subtitles, style, clipTimeSec }) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return null;
  const active = subtitles.find((s) => s && s.text && clipTimeSec >= s.start && clipTimeSec <= s.end);
  if (!active) return null;
  const st = style || {};
  const size = { S: 32, M: 40, L: 50 }[st.size] || 40;
  const pos = st.position === 'top' ? { top: '6%' } : { bottom: '14%' };
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', ...pos }}>
        <span style={{ background: 'rgba(0,0,0,.65)', color: COL.white, fontFamily: ff(st.font, 'Inter, sans-serif'), fontWeight: 600, fontSize: size, padding: '6px 18px', WebkitTextStroke: '1px #000', textShadow: '0 2px 4px #000' }}>{active.text}</span>
      </div>
    </AbsoluteFill>
  );
}
