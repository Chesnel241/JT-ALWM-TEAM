import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { COL, ff } from './theme.js';

// Bande défilante (ticker) continue — translateX en boucle.
// `speed` : 1 (très lent) → 5 (très rapide), défaut 3 (= 170 px/s historique).
export function Ticker({ ticker }) {
  const frame = useCurrentFrame();
  if (!ticker || !ticker.enabled || !ticker.texte) return null;
  const sep = '       •       ';
  const unit = ticker.texte + sep;
  const nSpeed = Number(ticker.speed);
  const speedLevel = Math.max(1, Math.min(5, isNaN(nSpeed) ? 1 : nSpeed));
  const PX_PER_SEC = [60, 90, 130, 180, 240][speedLevel - 1];
  const speed = PX_PER_SEC / 30;
  const x = -((frame * speed) % 2000);
  const scale = (ticker.scale ?? 100) / 100;
  const px = ticker.posX || 0;
  const py = ticker.posY || 0;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, background: COL.navy, display: 'flex', alignItems: 'center', overflow: 'hidden', transform: `translate(${px}px, ${py}px) scale(${scale})`, transformOrigin: 'bottom left', borderTop: `1px solid rgba(255,255,255,0.1)` }}>
      <div style={{ background: COL.blue, color: COL.white, fontWeight: 800, height: '100%', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, fontFamily: ff(null, "'Montserrat', sans-serif"), fontSize: 16, letterSpacing: '0.04em', zIndex: 2 }}>
        ALWM TV
      </div>
      {ticker.categorie && (
        <div style={{ background: COL.white, color: COL.blue, fontWeight: 800, height: '100%', display: 'flex', alignItems: 'center', padding: '0 18px', flexShrink: 0, fontFamily: ff(null, "'Montserrat', sans-serif"), fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.03em', zIndex: 2 }}>
          {ticker.categorie}
        </div>
      )}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', height: '100%', zIndex: 1 }}>
        <div style={{ position: 'absolute', whiteSpace: 'nowrap', transform: `translateX(${x}px)`, top: 0, lineHeight: '40px', color: COL.white, fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 500, letterSpacing: '0.02em' }}>
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
  const scale = isNaN(Number(live.scale)) ? 1 : Number(live.scale) / 100;
  const px = isNaN(Number(live.posX)) ? 0 : Number(live.posX);
  const py = isNaN(Number(live.posY)) ? 0 : Number(live.posY);
  return (
    <div style={{ position: 'absolute', right: 30, top: 24, background: COL.red, color: COL.white, fontWeight: 800, fontSize: 32, padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter, sans-serif', opacity: pulse, transform: `translate(${px}px, ${py}px) scale(${scale})`, transformOrigin: 'top right' }}>
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
export function Logo({ logo, logoPosition, tickerOn, logoPosX = 0, logoPosY = 0, logoScale = 100 }) {
  if (!logo) return null;
  const pos = { ...(LOGO_POS[logoPosition] || LOGO_POS.br) };
  if (tickerOn && (logoPosition === 'bl' || logoPosition === 'br' || !logoPosition)) pos.bottom = 120;
  const scale = isNaN(Number(logoScale)) ? 1 : Number(logoScale) / 100;
  const px = isNaN(Number(logoPosX)) ? 0 : Number(logoPosX);
  const py = isNaN(Number(logoPosY)) ? 0 : Number(logoPosY);
  return <Img src={staticFile('habillage-logo.png')} style={{ position: 'absolute', height: 130, opacity: 0.9, ...pos, transform: `translate(${px}px, ${py}px) scale(${scale})`, transformOrigin: 'center center' }} />;
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

// ----------------------------------------------------
// Tickers Spécifiques
// ----------------------------------------------------

export function BandeauInfos({ ticker, timeString = "18:45" }) {
  const frame = useCurrentFrame();
  if (!ticker || !ticker.enabled || !ticker.texte) return null;
  
  // Speed: ~60px/sec (slow!) -> 60 / 30 = 2px/frame
  const speed = 2; 
  const x = -((frame * speed) % 2000);
  const sep = '       •       ';
  const unit = ticker.texte + sep;

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, background: 'rgba(10, 20, 50, 0.95)', display: 'flex', alignItems: 'center', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
      <div style={{ background: COL.red, color: COL.white, fontWeight: 800, height: '100%', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, fontFamily: ff(null, 'Inter, sans-serif'), fontSize: 32, zIndex: 2 }}>
        {timeString}
      </div>
      {ticker.categorie && (
        <div style={{ background: '#FFD700', color: '#000', fontWeight: 800, height: '100%', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, fontFamily: ff(null, 'Inter, sans-serif'), fontSize: 30, zIndex: 2, textTransform: 'uppercase' }}>
          {ticker.categorie}
        </div>
      )}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', height: '100%', zIndex: 1 }}>
        <div style={{ position: 'absolute', whiteSpace: 'nowrap', transform: `translateX(${x}px)`, top: 0, lineHeight: '80px', color: COL.white, fontFamily: 'Inter, sans-serif', fontSize: 30, fontWeight: 500 }}>
          <span style={{ padding: '0 30px' }}>{unit}</span>
          <span style={{ padding: '0 30px' }}>{unit}</span>
          <span style={{ padding: '0 30px' }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}

export function FlashInfo({ ticker }) {
  const frame = useCurrentFrame();
  if (!ticker || !ticker.enabled) return null;
  
  // Animation d'entrée : glissement + fade
  const y = interpolate(frame, [0, 15], [-20, 0], { extrapolateRight: 'clamp' });
  const op = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', left: 120, top: 120, width: 220, height: 80, display: 'flex', flexDirection: 'column', opacity: op, transform: `translateY(${y}px)`, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ background: COL.blue, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COL.white, fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: '0.05em' }}>
        FLASH
      </div>
      <div style={{ background: COL.white, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COL.black, fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: '0.05em' }}>
        INFO
      </div>
    </div>
  );
}

export function AlerteInfo({ ticker }) {
  const frame = useCurrentFrame();
  if (!ticker || !ticker.enabled || !ticker.texte) return null;
  
  const speed = 8;
  const x = -((frame * speed) % 2000);
  const sep = '   ⚠   ALERTE MAXIMALE   ⚠   ';
  const unit = ticker.texte + sep;

  const pulseOp = interpolate(Math.sin(frame / 5), [-1, 1], [0.85, 1]);
  const bannerPulse = interpolate(Math.sin(frame / 3), [-1, 1], [1, 1.05]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 10 }}>
      <AbsoluteFill style={{ 
        boxShadow: `inset 0 0 100px rgba(255, 0, 0, ${pulseOp * 0.6})`,
        border: `${pulseOp * 15}px solid rgba(255,0,0,0.8)`
      }} />

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, background: `rgba(200, 0, 0, ${pulseOp})`, display: 'flex', alignItems: 'center', overflow: 'hidden', borderTop: '4px solid #FFF' }}>
        <div style={{ background: '#FFF', color: '#C00', fontWeight: 900, height: '100%', display: 'flex', alignItems: 'center', padding: '0 40px', flexShrink: 0, fontFamily: ff(null, 'Inter, sans-serif'), fontSize: 46, zIndex: 2, transform: `scale(${bannerPulse})`, transformOrigin: 'center left' }}>
          ALERTE
        </div>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden', height: '100%', zIndex: 1 }}>
          <div style={{ position: 'absolute', whiteSpace: 'nowrap', transform: `translateX(${x}px)`, top: 0, lineHeight: '120px', color: COL.white, fontFamily: 'Inter, sans-serif', fontSize: 44, fontWeight: 800 }}>
            <span style={{ padding: '0 30px' }}>{unit}</span>
            <span style={{ padding: '0 30px' }}>{unit}</span>
            <span style={{ padding: '0 30px' }}>{unit}</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
