import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { COL, ff, pickColors, fxStyle, DEFAULT_ANCHOR } from '../theme.js';
import { entranceStyle, charStyle, PER_CHAR } from '../anim.js';

// Texte avec animation d'entrée (per-char ou bloc) + contour/halo + police.
function Tx({ children, overlay, fontFamily, baseStyle }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = overlay.animation;
  const fx = fxStyle(overlay.outline, overlay.glow);
  const fontStyle = { fontFamily: ff(overlay.font, fontFamily), ...baseStyle, ...fx };
  const text = children == null ? '' : String(children);
  if (PER_CHAR.has(anim)) {
    return (
      <span style={fontStyle}>
        {[...text].map((c, i) => (
          <span key={i} style={{ ...charStyle(anim, frame, fps, i), whiteSpace: 'pre' }}>{c}</span>
        ))}
      </span>
    );
  }
  return <span style={{ ...fontStyle, ...entranceStyle(anim, frame, fps) }}>{text}</span>;
}

// Position d'un overlay : ancrage défaut + delta drag (overlay.position).
function shift(overlay) {
  const def = DEFAULT_ANCHOR[overlay.templateId] || { x: 0, y: 0 };
  const p = overlay.position;
  if (!p || typeof p !== 'object') return { dx: 0, dy: 0 };
  return { dx: (Number(p.x) || def.x) - def.x, dy: (Number(p.y) || def.y) - def.y };
}

const px = (n) => `${n}px`;

// Wrapper positionné en coords 1920×1080, applique le delta de drag.
function Box({ overlay, style, children }) {
  const { dx, dy } = shift(overlay);
  return (
    <div style={{ position: 'absolute', transform: `translate(${px(dx)}, ${px(dy)})`, ...style }}>{children}</div>
  );
}

function LowerThird({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 0, top: 950 }}>
      <div style={{ position: 'relative', background: C.bg(COL.navy), opacity: 0.94, borderLeft: `12px solid ${C.accent(COL.gold)}`, width: 1060, height: 130, padding: '12px 0 0 42px', boxSizing: 'border-box' }}>
        <div style={{ fontWeight: 800, fontSize: 52, color: C.text(COL.white) }}>
          <Tx overlay={overlay} fontFamily="Inter">{f.name}</Tx>
        </div>
        <div style={{ fontSize: 30, color: C.accent(COL.gold), marginTop: 6 }}>{f.title}</div>
      </div>
    </Box>
  );
}

function LowerThirdPro({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 72, top: 892 }}>
      <div style={{ background: C.bg(COL.white), color: C.text(COL.ink), fontFamily: ff(overlay.font, "'Archivo Black', sans-serif"), fontWeight: 900, fontSize: 44, padding: '10px 18px', borderLeft: `14px solid ${C.accent(COL.blue)}` }}>
        <Tx overlay={overlay} fontFamily="'Archivo Black', sans-serif">{f.titre}</Tx>
      </div>
      <div style={{ background: C.accent(COL.blue), color: COL.white, fontWeight: 700, fontSize: 30, padding: '8px 18px', display: 'inline-block', marginTop: 6 }}>{f.sous_titre}</div>
    </Box>
  );
}

function GrandTitre({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 0, top: 448, width: 1920, textAlign: 'center' }}>
      <div style={{ background: C.bg('rgba(0,0,0,.6)'), padding: '20px 0', width: 1920 }}>
        <div style={{ fontSize: 100, color: C.text(COL.white) }}>
          <Tx overlay={overlay} fontFamily="Anton">{f.title}</Tx>
        </div>
        <div style={{ fontSize: 46, color: C.accent(COL.gold), fontFamily: "'Bebas Neue', sans-serif", marginTop: 4 }}>{f.date}</div>
      </div>
    </Box>
  );
}

function TitreKaraoke({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const o = { ...overlay, animation: overlay.animation || 'cascade' };
  return (
    <Box overlay={overlay} style={{ left: 0, top: 455, width: 1920, textAlign: 'center' }}>
      <div style={{ borderTop: `6px solid ${C.accent(COL.gold)}`, background: C.bg('rgba(0,0,0,.55)'), padding: '28px 0', width: 1920, fontSize: 92, color: C.text(COL.white) }}>
        <Tx overlay={o} fontFamily="Anton">{f.title}</Tx>
      </div>
    </Box>
  );
}

function TitreReportage({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 0, top: 1000 }}>
      <div style={{ position: 'relative', background: C.bg(COL.dark), opacity: 0.92, borderLeft: `12px solid ${C.accent(COL.gold)}`, width: 1920, height: 80, padding: '18px 0 0 34px', boxSizing: 'border-box', fontWeight: 800, fontSize: 40, color: C.text(COL.white) }}>
        <Tx overlay={overlay} fontFamily="Inter">{f.sujet}</Tx>
      </div>
    </Box>
  );
}

function SousTitre({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 200, top: 972, width: 1520, textAlign: 'center' }}>
      <span style={{ background: C.bg('rgba(0,0,0,.7)'), color: C.text(COL.white), fontSize: 40, padding: '6px 16px' }}>
        <Tx overlay={overlay} fontFamily="Inter">{f.texte}</Tx>
      </span>
    </Box>
  );
}

function BandeauPays({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 1660, top: 20 }}>
      <div style={{ background: C.bg(COL.red), borderBottom: `6px solid ${C.accent(COL.gold)}`, width: 260, height: 64, color: C.text(COL.white), fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, textAlign: 'center', lineHeight: '64px' }}>{f.pays}</div>
    </Box>
  );
}

function FlashInfo({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, display: 'flex', height: 72 }}>
      <div style={{ background: C.accent(COL.black), color: C.text(COL.white), fontFamily: 'Anton, sans-serif', fontSize: 40, width: 230, textAlign: 'center', lineHeight: '72px' }}>FLASH</div>
      <div style={{ background: C.bg(COL.red), color: C.text(COL.white), fontWeight: 800, fontSize: 38, flex: 1, lineHeight: '72px', paddingLeft: 30 }}>
        <Tx overlay={overlay} fontFamily="Inter">{f.texte}</Tx>
      </div>
    </Box>
  );
}

function BreakingNews({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 120, top: 150 }}>
      <div style={{ background: C.bg(COL.red), color: COL.white, fontFamily: 'Anton, sans-serif', fontSize: 66, padding: '6px 40px', transform: 'skewX(-12deg)', display: 'inline-block' }}>
        <span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>{f.titre || 'DERNIÈRE MINUTE'}</span>
      </div>
      <div style={{ marginTop: 12, background: C.accent(COL.white), color: C.text(COL.ink), fontWeight: 800, fontSize: 40, padding: '8px 18px', display: 'inline-block' }}>
        <Tx overlay={overlay} fontFamily="Inter">{f.sujet}</Tx>
      </div>
    </Box>
  );
}

function ScoreResultat({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 500, top: 40, width: 920, textAlign: 'center' }}>
      <span style={{ background: C.bg(COL.navy), color: C.text(COL.white), padding: '14px 22px', fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, display: 'inline-block' }}>
        {f.gauche} <span style={{ color: C.accent(COL.gold), fontFamily: 'Anton, sans-serif' }}>{f.score}</span> {f.droite}
      </span>
    </Box>
  );
}

function HorlogeDate({ overlay }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 20, top: 20, display: 'flex', alignItems: 'center', background: C.bg(COL.red), padding: '4px 14px', height: 70 }}>
      <span style={{ color: C.text(COL.white), fontFamily: "'Bebas Neue', sans-serif", fontSize: 48 }}>{f.heure}</span>
      <span style={{ color: C.accent(COL.gold), fontSize: 26, marginLeft: 12 }}>{f.date}</span>
    </Box>
  );
}

const REGISTRY = {
  lower_third: LowerThird,
  lower_third_pro: LowerThirdPro,
  grand_titre: GrandTitre,
  titre_karaoke: TitreKaraoke,
  titre_reportage: TitreReportage,
  sous_titre: SousTitre,
  bandeau_pays: BandeauPays,
  flash_info: FlashInfo,
  breaking_news: BreakingNews,
  score_resultat: ScoreResultat,
  horloge_date: HorlogeDate,
};

export function Overlay({ overlay }) {
  const Comp = REGISTRY[overlay.templateId];
  return Comp ? <Comp overlay={overlay} /> : null;
}
