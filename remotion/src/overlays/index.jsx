import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from 'remotion';
import { COL, ff, pickColors, fxStyle, DEFAULT_ANCHOR } from '../theme.js';
import { entranceStyle, charStyle, PER_CHAR } from '../anim.js';
import { WorldMap } from '../worldmap.jsx';
import { BackdropALWM, Dove, DoveFlyThrough, eo } from '../broadcast.jsx';
import { EnvatoPresenterLowerThird, EnvatoNewsLowerThird } from './envato_lower_thirds';
import { EnvatoBigTitle, EnvatoTicker } from './envato_titles';
import { EnvatoSplitScreen } from './envato_split_screens';
import {
  EnvatoReportageMinimalLine,
  EnvatoReportageDoubleSkew,
  EnvatoReportageGradientSwipe,
  EnvatoReportageGlassmorphism,
  EnvatoReportageMassif,
} from './envato_mega_titles';
import {
  EnvatoLowerThirdCompact,
  EnvatoLowerThirdDuoCorporate,
  EnvatoLowerThirdInterview,
  EnvatoLocationPin,
  EnvatoQuoteBlock,
} from './envato_mega_lower_thirds';

// Animated African Pattern Watermark
function Watermark({ mode = 'overlay', opacity = 0.06 }) {
  const frame = useCurrentFrame();
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      backgroundImage: `url(${staticFile('images/african-pattern.png')})`,
      backgroundSize: '300px',
      opacity,
      mixBlendMode: mode,
      backgroundPosition: `${frame * 0.5}px ${frame * 0.5}px`
    }} />
  );
}
// Text with entrance animation (per-char or block) + outline/halo + font.
function Tx({ children, overlay, durationInFrames, fontFamily, baseStyle }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const animIn = overlay.animation || 'mask_reveal';
  const animOut = overlay.animationOut || 'slide_out';
  const fx = fxStyle(overlay.outline, overlay.glow);
  const wrapperStyle = { fontFamily: ff(overlay.font, fontFamily), ...baseStyle, ...fx, ...entranceStyle(overlay, frame, fps, durationInFrames) };
  const text = children == null ? '' : String(children);
  
  if (PER_CHAR.has(animIn) || PER_CHAR.has(animOut)) {
    return (
      <span style={wrapperStyle}>
        {[...text].map((c, i) => (
          <span key={i} style={{ ...charStyle(overlay, frame, fps, durationInFrames, i, text.length), whiteSpace: 'pre' }}>{c}</span>
        ))}
      </span>
    );
  }
  return <span style={wrapperStyle}>{text}</span>;
}

// Position of an overlay: default anchor + drag delta.
function shift(overlay) {
  const def = DEFAULT_ANCHOR[overlay.templateId] || { x: 0, y: 0 };
  const p = overlay.position;
  if (!p || typeof p !== 'object') return { dx: 0, dy: 0 };
  return { dx: (Number(p.x) || def.x) - def.x, dy: (Number(p.y) || def.y) - def.y };
}

const px = (n) => `${n}px`;

// ===========================================================================
// KIT VISUEL CHARTE ALWM TV — parallélogrammes nets, navy / bleu électrique /
// bleu clair, accents diagonaux, Montserrat. (cf. charte officielle)
// ===========================================================================
const SLANT = 26; // décalage horizontal du bord penché (px)
const NAVY = '#14143C';
const ELEC = '#0046C0';
const LIGHT = '#5BA9F7';

// Parallélogramme penché (les 2 bords verticaux inclinés du même angle).
// `reveal` 0→1 anime un wipe gauche→droite via clip-path.
function Para({ bg, children, style = {}, slant = SLANT, reveal = 1, padding = '0', radius = 0 }) {
  const r = Math.max(0, Math.min(1, reveal));
  // clip parallélogramme + masque de révélation (scaleX du clip droit).
  const rightVisible = `calc(${(100 * r).toFixed(2)}%)`;
  return (
    <div style={{
      position: 'relative',
      background: bg,
      padding,
      clipPath: `polygon(${slant}px 0, 100% 0, calc(100% - ${slant}px) 100%, 0 100%)`,
      WebkitClipPath: `polygon(${slant}px 0, 100% 0, calc(100% - ${slant}px) 100%, 0 100%)`,
      borderRadius: radius,
      overflow: 'hidden',
      ...style,
      // masque de révélation par-dessus (barre opaque qui se rétracte).
      maskImage: r < 1 ? `linear-gradient(90deg, #000 ${rightVisible}, transparent ${rightVisible})` : undefined,
      WebkitMaskImage: r < 1 ? `linear-gradient(90deg, #000 ${rightVisible}, transparent ${rightVisible})` : undefined,
    }}>
      {children}
    </div>
  );
}

// Barre d'accent diagonale (bleu électrique) posée à droite d'un panneau,
// comme sur la charte (le petit chevron incliné).
function AccentSlash({ height = 60, color = ELEC, marginLeft = 8, slant = SLANT }) {
  return (
    <div style={{
      width: height * 0.55,
      height,
      background: color,
      marginLeft,
      clipPath: `polygon(${slant}px 0, 100% 0, calc(100% - ${slant}px) 100%, 0 100%)`,
      WebkitClipPath: `polygon(${slant}px 0, 100% 0, calc(100% - ${slant}px) 100%, 0 100%)`,
    }} />
  );
}


// Position wrapper 1920x1080. Applies drag delta + slider offset.
function Box({ overlay, style, children }) {
  const { dx, dy } = shift(overlay);
  const rawX = Number(overlay.posX);
  const rawY = Number(overlay.posY);
  const rawS = Number(overlay.scale);
  const posX = isNaN(rawX) ? 0 : rawX;
  const posY = isNaN(rawY) ? 0 : rawY;
  const scale = (isNaN(rawS) ? 100 : rawS) / 100;
  
  const customTransform = `translate(${px(dx + posX)}, ${px(dy + posY)}) scale(${scale})`;
  
  return (
    <div style={{ 
      position: 'absolute', 
      ...style,
      transform: style.transform ? `${style.transform} ${customTransform}` : customTransform,
      transformOrigin: 'top left'
    }}>{children}</div>
  );
}

function NomInterview({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const outDur = Math.round(fps * 0.5);
  const isOut = frame > durationInFrames - outDur;
  const outFrame = isOut ? frame - (durationInFrames - outDur) : 0;

  const contentSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 16, stiffness: 90 } });
  const outSpring = spring({ frame: outFrame, fps, config: { damping: 16, stiffness: 100 } });
  
  const contentY = interpolate(contentSpring, [0, 1], [20, 0]);
  const contentOp = interpolate(contentSpring, [0, 1], [0, 1]);

  const barX = eo(frame, [0, 15], [-100, 0]); // %
  const outX = isOut ? interpolate(outSpring, [0, 1], [0, -120]) : 0;
  const slideOutOp = isOut ? interpolate(outSpring, [0, 1], [1, 0]) : 1;
  const fs = (overlay.fontSize || 100) / 100;
  
  const categorie = (f.categorie || f.title || f.fonction || 'POLITIQUE').toUpperCase();
  const corps = f.name || f.nom || f.texte || 'Titre de l’information';
  // Personnalisable : accent = bloc + catégorie, bg = panneau, text = corps.
  const C = pickColors(overlay);
  const cAccent = C.accent(COL.blue);
  const cBg = C.bg(COL.white);
  const cText = C.text(COL.black);
  const ffont = overlay.font || null;

  return (
    <Box overlay={overlay} style={{ left: 180, top: 800, width: '65%', opacity: slideOutOp, transform: `translateX(${outX}%)` }}>
      <div style={{
        display: 'flex', alignItems: 'stretch', height: 110,
        transform: `translateX(${barX}%)`,
        filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.4))',
      }}>
        {/* Bloc gauche (accent) ALWM TV */}
        <div style={{
          width: 160, background: cAccent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: COL.white, fontFamily: ff(ffont, "'Montserrat ExtraBold', sans-serif"), fontSize: 24, letterSpacing: '0.04em'
        }}>
          ALWM TV
        </div>
        {/* Panneau droit (bg) : catégorie (accent) + corps (text) */}
        <div style={{
          background: cBg, padding: '14px 40px 14px 32px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1,
          opacity: contentOp, transform: `translateY(${contentY}px)`,
        }}>
          <div style={{ fontFamily: ff(ffont, "'Inter', sans-serif"), fontWeight: 800, fontSize: `${fs * 22}px`, color: cAccent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{categorie}</div>
          <div style={{ fontFamily: ff(ffont, "'Montserrat ExtraBold', sans-serif"), fontSize: `${fs * 36}px`, color: cText, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{corps}</div>
        </div>
      </div>
    </Box>
  );
}

function LowerThirdPro({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // AE style staggered reveal
  const barIn = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const textIn = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 14, stiffness: 100 } });
  
  const barW = interpolate(barIn, [0, 1], [0, 100]);
  const textY = interpolate(textIn, [0, 1], [40, 0]);
  const textOp = interpolate(textIn, [0, 1], [0, 1]);

  return (
    <Box overlay={overlay} style={{ left: 100, top: 860 }}>
      {/* Glowing neon line instead of solid background */}
      <div style={{ 
        height: 4, 
        width: `${barW}%`, 
        minWidth: 400,
        background: C.accent(COL.blue),
        boxShadow: `0 0 15px ${C.accent(COL.blue)}, 0 0 30px ${C.accent(COL.blue)}`,
        marginBottom: 16
      }} />
      
      <div style={{ overflow: 'hidden', padding: '0 10px' }}>
        <div style={{ 
          transform: `translateY(${textY}px)`, 
          opacity: textOp,
          color: C.text(COL.white), 
          fontFamily: ff(overlay.font, "'Archivo Black', sans-serif"), 
          fontWeight: 900, 
          fontSize: `${(overlay.fontSize || 100) / 100 * 56}px`, 
          textShadow: '0 8px 16px rgba(0,0,0,0.8)',
          textTransform: 'uppercase',
          letterSpacing: '-0.02em'
        }}>
          {f.titre}
        </div>
      </div>

      <div style={{ overflow: 'hidden', padding: '0 10px', marginTop: 4 }}>
        <div style={{ 
          transform: `translateY(${textY}px)`, 
          opacity: textOp,
          color: C.accent(COL.gold), 
          fontWeight: 700, 
          fontSize: `${(overlay.fontSize || 100) / 100 * 32}px`, 
          fontFamily: ff(overlay.font, "'Montserrat', sans-serif"),
          textShadow: '0 4px 8px rgba(0,0,0,0.8)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {f.sous_titre}
        </div>
      </div>
    </Box>
  );
}

function GrandTitre({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isOut = frame > durationInFrames - 24;
  const outFrame = isOut ? frame - (durationInFrames - 24) : 0;
  const outOpacity = eo(outFrame, [0, 24], [1, 0]);

  // Animation: opacity 0 -> 100, scale 1.05 -> 1 over 1 second (fps frames)
  const titleScale = eo(frame, [0, fps], [1.05, 1]);
  const titleOpacity = eo(frame, [0, fps], [0, 1]);
  
  const lightPos = eo(frame, [10, 70], [-120, 220]);
  const fs = (overlay.fontSize || 100) / 100;

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: isOut ? outOpacity : 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <BackdropALWM />
      <div style={{
        position: 'absolute', top: '-50%', bottom: '-50%', width: '50%', left: '25%',
        background: 'linear-gradient(90deg, transparent, rgba(74,163,255,0.15), transparent)',
        transform: `translateX(${lightPos}%) skewX(-30deg)`,
        filter: 'blur(60px)', zIndex: 2,
      }} />

      <div style={{
        position: 'relative',
        transform: `scale(${titleScale})`,
        opacity: titleOpacity,
        textAlign: 'center',
        color: COL.white,
        fontFamily: ff(null, "'Montserrat ExtraBold', sans-serif"),
        zIndex: 3,
        textShadow: '0 10px 30px rgba(0,0,0,0.8)'
      }}>
        <div style={{
          fontSize: `${fs * 96}px`,
          fontWeight: 800,
          letterSpacing: '0.02em',
          lineHeight: 1.1,
          textTransform: 'uppercase'
        }}>
          {f.titre || f.title || 'LE JOURNAL'}
        </div>
        {(f.sous_titre || f.subtitle || f.date) && (
          <div style={{
            fontSize: `${fs * 42}px`,
            color: COL.light,
            fontFamily: ff(null, "'Montserrat ExtraBold', sans-serif"),
            marginTop: 16,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {f.sous_titre || f.subtitle || f.date}
          </div>
        )}
      </div>
    </Box>
  );
}

function EditionSpeciale({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isOut = frame > durationInFrames - 24;
  const outFrame = isOut ? frame - (durationInFrames - 24) : 0;
  const outOpacity = eo(outFrame, [0, 24], [1, 0]);

  const titleScale = eo(frame, [0, fps], [1.05, 1]);
  const titleOpacity = eo(frame, [0, fps], [0, 1]);
  const fs = (overlay.fontSize || 100) / 100;

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: isOut ? outOpacity : 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <BackdropALWM darker={true} globeOpacity={0.2} />
      <div style={{
        position: 'relative',
        transform: `scale(${titleScale})`,
        opacity: titleOpacity,
        textAlign: 'center',
        fontFamily: ff(null, "'Montserrat ExtraBold', sans-serif"),
        zIndex: 3,
        textShadow: '0 10px 40px rgba(0,0,0,0.9)'
      }}>
        <div style={{ fontSize: `${fs * 96}px`, color: COL.white, lineHeight: 1.1, textTransform: 'uppercase' }}>
          ÉDITION
        </div>
        <div style={{ fontSize: `${fs * 96}px`, color: COL.blue, lineHeight: 1.1, textTransform: 'uppercase' }}>
          SPÉCIALE
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 120, opacity: titleOpacity, zIndex: 3 }}>
        <Img src={staticFile('images/alwm-logo.png')} style={{ width: 180, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} />
      </div>
    </Box>
  );
}

function TitreKaraoke({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const o = { ...overlay, animation: overlay.animation || 'kinetic_type' };
  
  return (
    <Box overlay={overlay} style={{ left: 0, top: 450, width: 1920, textAlign: 'center' }}>
      <div style={{ 
        display: 'inline-block',
        background: `linear-gradient(90deg, transparent, ${C.bg('rgba(0,0,0,.7)')} 20%, ${C.bg('rgba(0,0,0,.7)')} 80%, transparent)`,
        padding: '30px 100px', 
        fontSize: 100, 
        color: C.text(COL.white),
        borderTop: `2px solid ${C.accent(COL.gold)}`,
        borderBottom: `2px solid ${C.accent(COL.gold)}`,
        boxShadow: '0 0 40px rgba(0,0,0,0.5)',
        textTransform: 'uppercase'
      }}>
        <Tx overlay={o} durationInFrames={durationInFrames} fontFamily="Anton">{f.title}</Tx>
      </div>
    </Box>
  );
}

function TitreReportage({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isOut = frame > durationInFrames - 18;
  const inSp = spring({ frame, fps, config: { damping: 20, stiffness: 110 } });
  const subSp = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 20, stiffness: 110 } });
  const outSp = isOut ? interpolate(frame - (durationInFrames - 18), [0, 18], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const reveal = isOut ? 1 - outSp : inSp;
  const fs = (overlay.fontSize || 100) / 100;
  const fontB = ff(overlay.font, "'Montserrat ExtraBold', sans-serif");
  const fontM = ff(overlay.font, "'Montserrat Medium', sans-serif");
  // Personnalisable : bg = bandeau titre, text = titre, accent = chevron +
  // sous-titre. Défauts = charte (navy / blanc / bleu).
  const cBand = C.bg(COL.navy);
  const cTitle = C.text(COL.white);
  const cAccent = C.accent(COL.blue);

  return (
    <Box overlay={overlay} style={{ left: 110, top: 820, width: 1300, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {/* Bandeau titre */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <Para bg={cBand} reveal={reveal} padding="0" style={{ boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }}>
          <div style={{
            padding: '18px 56px 18px 48px',
            fontFamily: fontB, fontWeight: 800,
            fontSize: `${fs * 50}px`, color: cTitle,
            textTransform: 'uppercase', letterSpacing: '0.01em', whiteSpace: 'nowrap',
          }}>{f.titre || f.sujet || f.title || 'LE TITRE DU REPORTAGE'}</div>
        </Para>
        {/* accent diagonal */}
        <div style={{ opacity: reveal > 0.7 ? 1 : 0, transition: 'opacity .2s' }}>
          <AccentSlash height={Math.round(fs * 50 + 36)} color={cAccent} />
        </div>
      </div>
      {/* Sous-titre : fond blanc, texte accent + petit carré accent à gauche */}
      <div style={{ display: 'flex', alignItems: 'stretch', marginTop: 6, marginLeft: 18 }}>
        <div style={{ width: 14, background: cAccent, clipPath: `polygon(${SLANT * 0.5}px 0,100% 0,calc(100% - ${SLANT * 0.5}px) 100%,0 100%)` }} />
        <Para bg={COL.white} reveal={subSp} padding="0" style={{ boxShadow: '0 10px 24px rgba(0,0,0,0.2)' }}>
          <div style={{
            padding: '8px 40px 8px 28px',
            fontFamily: fontM, fontWeight: 600,
            fontSize: `${fs * 26}px`, color: cAccent,
            textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
          }}>{f.subtitle || f.sous_titre || 'UN SOUS-TITRE OU PRÉCISION'}</div>
        </Para>
      </div>
    </Box>
  );
}

function SignatureReportage({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const outDur = 20;
  const isOut = frame > durationInFrames - outDur;
  const outFrame = isOut ? frame - (durationInFrames - outDur) : 0;

  const inSpring = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const outFade = interpolate(outFrame, [0, outDur], [1, 0], { extrapolateRight: 'clamp' });
  const moveX = interpolate(inSpring, [0, 1], [20, 0]); // mouvement sobre 20 px (charte)
  const opacity = interpolate(inSpring, [0, 1], [0, 1]);
  const fs = (overlay.fontSize || 100) / 100;
  const fontB = ff(overlay.font, "'Montserrat Bold', sans-serif");
  const fontM = ff(overlay.font, "'Montserrat Medium', sans-serif");
  const label = f.label || 'REPORTAGE';
  const name = f.texte || f.signature || f.nom || 'PRÉNOM NOM';

  return (
    <Box overlay={overlay} style={{ left: 1400, top: 930, transform: `translateX(${moveX}px)`, opacity: isOut ? outFade : opacity }}>
      <div style={{ display: 'flex', alignItems: 'stretch', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.25))' }}>
        <Para bg={COL.white}>
          <div style={{ padding: '12px 44px 12px 34px', textAlign: 'left' }}>
            <div style={{ fontFamily: fontM, fontWeight: 600, fontSize: `${fs * 22}px`, color: ELEC, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            <div style={{ fontFamily: fontB, fontWeight: 700, fontSize: `${fs * 34}px`, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>{name}</div>
          </div>
        </Para>
        <AccentSlash height={Math.round(fs * 56 + 24)} />
      </div>
    </Box>
  );
}

function RappelTitres({ overlay, durationInFrames }) {
  const f = overlay.fields || {}; 
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let titres = Array.isArray(f.titres) ? f.titres : [f.titre1, f.titre2, f.titre3, f.titre4, f.titre5].filter(Boolean);
  if (titres.length === 0) {
    titres = ['Crise diplomatique entre…', 'Sommet économique…', 'Élections…', 'Sport…'];
  }
  titres = titres.slice(0, 5);

  const isOut = frame > durationInFrames - 24;
  const outFrame = isOut ? frame - (durationInFrames - 24) : 0;
  const outOpacity = eo(outFrame, [0, 24], [1, 0]);
  
  const doveTo = Math.round(fps * 1.8);
  const listStart = Math.round(fps * 0.9);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: isOut ? outOpacity : 1 }}>
      <BackdropALWM />
      <DoveFlyThrough fromF={6} toF={doveTo} y={20} size={240} />

      <div style={{
        position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', zIndex: 2,
        opacity: eo(frame, [listStart - 6, listStart + 8], [0, 1]),
      }}>
        <span style={{
          fontFamily: ff(null, "'Montserrat ExtraBold', sans-serif"), fontWeight: 800, fontSize: 64, color: C.text(COL.white),
          textTransform: 'uppercase', letterSpacing: '0.06em',
          borderBottom: `4px solid ${C.accent(COL.blue)}`, paddingBottom: 14,
        }}>{f.titre || 'RAPPEL DES TITRES'}</span>
      </div>

      <div style={{ position: 'absolute', left: 400, right: 400, top: 320, zIndex: 2 }}>
        {titres.map((titre, i) => {
          const delay = listStart + Math.round(fps * 0.2) * i;
          const itemFrame = Math.max(0, frame - delay);
          const x = eo(itemFrame, [0, 14], [-60, 0]);
          const op = eo(itemFrame, [0, 14], [0, 1]);
          return (
            <div key={i} style={{
              transform: `translateX(${x}px)`, opacity: op,
              display: 'flex', alignItems: 'center', gap: 24,
              padding: '24px 0', borderBottom: `1px solid ${C.accent('rgba(74,163,255,0.18)')}`,
            }}>
              <span style={{ width: 16, height: 16, background: C.accent(COL.blue), transform: 'rotate(45deg)', flexShrink: 0 }} />
              <span style={{
                color: C.text(COL.white), fontSize: 42, fontFamily: ff(null, "'Inter', sans-serif"), fontWeight: 500, lineHeight: 1.2,
              }}>{titre}</span>
            </div>
          );
        })}
      </div>
    </Box>
  );
}

function SousTitre({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 0, top: 970, width: 1920, textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
      <div style={{ 
        background: `linear-gradient(90deg, transparent, ${C.bg('rgba(0,0,0,0.85)')} 15%, ${C.bg('rgba(0,0,0,0.85)')} 85%, transparent)`, 
        color: C.text(COL.white), 
        fontSize: 38, 
        padding: '12px 80px',
        fontFamily: ff(overlay.font, "'Inter', sans-serif"),
        fontWeight: 500,
        letterSpacing: '0.02em',
        textShadow: '0 4px 10px rgba(0,0,0,0.8)'
      }}>
        <Tx overlay={overlay} durationInFrames={durationInFrames}>{f.texte}</Tx>
      </div>
    </Box>
  );
}

function BandeauPays({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const inSpring = spring({ frame, fps, config: { damping: 14 } });
  const x = interpolate(inSpring, [0, 1], [200, 0]);

  return (
    <Box overlay={overlay} style={{ left: 1600, top: 40, transform: `translateX(${x}px)` }}>
      <div style={{ 
        background: C.bg(COL.red), 
        padding: '12px 40px',
        color: C.text(COL.white), 
        fontFamily: "'Montserrat', sans-serif", 
        fontWeight: 900,
        fontSize: 36, 
        textAlign: 'center', 
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
        borderLeft: `6px solid ${C.accent(COL.gold)}`
      }}>
        {f.pays}
      </div>
    </Box>
  );
}

function FlashInfo({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 15], [-20, 0], { extrapolateRight: 'clamp' });
  const op = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <Box overlay={overlay} style={{ left: 80, top: 80, opacity: op, transform: `translateY(${y}px)` }}>
      <div style={{ width: 340, height: 80, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ background: C.bg(COL.blue), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text(COL.white), fontFamily: ff(null, "'Montserrat ExtraBold', sans-serif"), fontWeight: 800, fontSize: 24, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{f.titre || 'FLASH'}</div>
        <div style={{ background: C.accent(COL.white), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text(COL.black), fontFamily: ff(null, "'Montserrat ExtraBold', sans-serif"), fontWeight: 800, fontSize: 24, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{f.texte || 'INFO'}</div>
      </div>
    </Box>
  );
}

// BREAKING NEWS / ALERTE INFO — plein écran bleu + flash + marquee (charte #5).
function BreakingNews({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = (f.titre || 'BREAKING NEWS').toUpperCase();
  const subtitle = (f.texte || 'ALERTE INFO').toUpperCase();
  const fontB = ff(overlay.font, "'Montserrat ExtraBold', sans-serif");
  // Flash bleu d'entrée ~200 ms.
  const flash = eo(frame, [0, fps * 0.2, fps * 0.45], [1, 0.5, 0]);
  const titleScale = eo(frame, [fps * 0.1, fps * 0.9], [1.05, 1]);
  const titleOp = eo(frame, [fps * 0.1, fps * 0.6], [0, 1]);
  // Marquee bas (continu, ~120 px/s).
  const marqueeText = `${subtitle}   •   `.repeat(8);
  const mx = -((frame * (120 / fps)) % 1600);
  const fs = (overlay.fontSize || 100) / 100;

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <BackdropALWM globeOpacity={0.16} />
      {/* Lueur centrale */}
      <div style={{ position: 'absolute', width: 1100, height: 360, background: 'radial-gradient(ellipse, rgba(0,87,217,0.45) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      <div style={{
        position: 'relative', zIndex: 3, transform: `scale(${titleScale})`, opacity: titleOp,
        fontFamily: fontB, fontWeight: 800, fontSize: `${fs * 130}px`, color: C.text(COL.white),
        textTransform: 'uppercase', letterSpacing: '0.02em', textShadow: '0 14px 40px rgba(0,0,0,0.6)',
      }}>{title}</div>
      {/* Bandeau marquee bas */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 60, height: 64, background: C.bg(COL.blue), display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: 3 }}>
        <div style={{ position: 'absolute', whiteSpace: 'nowrap', transform: `translateX(${mx}px)`, color: C.text(COL.white), fontFamily: fontB, fontWeight: 700, fontSize: 30, letterSpacing: '0.06em' }}>
          {marqueeText}{marqueeText}
        </div>
      </div>
      {/* Flash bleu d'entrée */}
      <AbsoluteFill style={{ background: C.accent(COL.blue), opacity: flash, pointerEvents: 'none', zIndex: 5 }} />
    </Box>
  );
}

function ScoreResultat({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 500, top: 60, width: 920, textAlign: 'center' }}>
      <div style={{ 
        display: 'inline-flex',
        alignItems: 'center',
        background: `linear-gradient(180deg, ${C.bg(COL.navy)} 0%, ${C.bg(COL.dark)} 100%)`, 
        color: C.text(COL.white), 
        padding: '16px 40px', 
        fontFamily: "'Montserrat', sans-serif", 
        fontWeight: 800,
        fontSize: 50,
        borderRadius: 12,
        border: `2px solid ${C.accent('rgba(255,255,255,0.1)')}`,
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <span style={{ flex: 1, textAlign: 'right', paddingRight: 30, textTransform: 'uppercase' }}>{f.gauche}</span>
        <span style={{ 
          color: C.accent(COL.gold), 
          fontSize: 64, 
          padding: '0 30px',
          borderLeft: `2px solid ${C.accent('rgba(255,255,255,0.2)')}`,
          borderRight: `2px solid ${C.accent('rgba(255,255,255,0.2)')}`
        }}>{f.score}</span>
        <span style={{ flex: 1, textAlign: 'left', paddingLeft: 30, textTransform: 'uppercase' }}>{f.droite}</span>
      </div>
    </Box>
  );
}

function HorlogeDate({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 40, top: 40 }}>
      <div style={{
        display: 'flex', 
        alignItems: 'center', 
        background: C.bg('rgba(0,0,0,0.7)'),
        backdropFilter: 'blur(10px)',
        padding: '8px 24px', 
        borderRadius: 8,
        border: `1px solid ${C.accent('rgba(255,255,255,0.15)')}`,
        boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
      }}>
        <span style={{ color: C.text(COL.white), fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 36, letterSpacing: '0.05em' }}>{f.heure}</span>
        <span style={{ color: C.accent(COL.gold), fontSize: 22, marginLeft: 16, fontFamily: "'Inter', sans-serif", fontWeight: 600, textTransform: 'uppercase' }}>{f.date}</span>
      </div>
    </Box>
  );
}

// Carte d'annonce charte (À SUIVRE / TOUT DE SUITE) : panneau blanc penché,
// label bleu en haut + texte navy gras, accent diagonal à droite.
function AnnonceCard({ overlay, durationInFrames, label, defaultText, snappy }) {
  const f = overlay.fields || {};
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cfg = snappy ? { damping: 14, stiffness: 150 } : { damping: 18, stiffness: 110 };
  const sp = spring({ frame, fps, config: cfg });
  const isOut = frame > durationInFrames - 16;
  const reveal = isOut ? interpolate(frame - (durationInFrames - 16), [0, 16], [1, 0], { extrapolateRight: 'clamp' }) : sp;
  const fs = (overlay.fontSize || 100) / 100;
  const fontB = ff(overlay.font, "'Montserrat Bold', sans-serif");
  const fontM = ff(overlay.font, "'Montserrat Medium', sans-serif");
  return (
    <Box overlay={overlay} style={{ left: 1320, top: 800 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.25))' }}>
        <Para bg={COL.white} reveal={reveal}>
          <div style={{ padding: '18px 48px 18px 36px' }}>
            <div style={{ fontFamily: fontM, fontWeight: 600, fontSize: `${fs * 24}px`, color: ELEC, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            <div style={{ fontFamily: fontB, fontWeight: 700, fontSize: `${fs * 40}px`, color: NAVY, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{f.texte || defaultText}</div>
          </div>
        </Para>
        <div style={{ opacity: reveal > 0.6 ? 1 : 0 }}><AccentSlash height={Math.round(fs * 64 + 36)} /></div>
      </div>
    </Box>
  );
}

function ASuivre({ overlay, durationInFrames }) {
  return <AnnonceCard overlay={overlay} durationInFrames={durationInFrames} label="À SUIVRE" defaultText="VOTRE PROGRAMME" />;
}

function ToutDeSuite({ overlay, durationInFrames }) {
  return <AnnonceCard overlay={overlay} durationInFrames={durationInFrames} label="TOUT DE SUITE" defaultText="VOTRE PROGRAMME" snappy />;
}

function Publicite({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textScale = interpolate(spring({ frame, fps, config: { damping: 20, stiffness: 80 } }), [0, 1], [0.9, 1]);
  const textOp = interpolate(frame, [0, 20], [0, 1]);
  
  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080 }}>
      <div style={{ 
        width: 1920, height: 1080, 
        background: `radial-gradient(circle at center, ${C.bg(COL.blue)} 0%, ${C.bg(COL.navy)} 100%)`,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        <WorldMap rotateSpeed={0.2} opacity={0.4} color={COL.light} glow={COL.blue} />
        
        <div style={{
          position: 'relative', zIndex: 2,
          transform: `scale(${textScale})`,
          opacity: textOp,
          fontSize: 160,
          fontFamily: ff(overlay.font, "'Montserrat', sans-serif"),
          fontWeight: 900,
          color: C.text(COL.white),
          letterSpacing: '0.15em',
          textShadow: '0 20px 50px rgba(0,0,0,0.6)',
          textTransform: 'uppercase'
        }}>
          {f.texte || 'PUBLICITÉ'}
        </div>
      </div>
    </Box>
  );
}

function FlipDigit({ current, next, progress, color, bg, accent }) {
  const y = -progress * 100;
  return (
    <div style={{
      position: 'relative', width: '0.62em', height: '1em', overflow: 'hidden',
      background: bg, borderRadius: 12, margin: '0 4px',
      boxShadow: 'inset 0 -2px 10px rgba(0,0,0,0.6), 0 10px 20px rgba(0,0,0,0.4)',
      borderBottom: `4px solid ${accent}`,
    }}>
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: 'rgba(0,0,0,0.5)', zIndex: 3 }} />
      <div style={{ transform: `translateY(${y}%)`, willChange: 'transform' }}>
        <div style={{ height: '1em', lineHeight: '1em', textAlign: 'center', color }}>{current}</div>
        <div style={{ height: '1em', lineHeight: '1em', textAlign: 'center', color }}>{next}</div>
      </div>
    </div>
  );
}

function CompteARebours({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const secondsLeft = Math.max(0, Math.ceil((durationInFrames - frame) / fps));
  const nextSeconds = Math.max(0, secondsLeft - 1);
  const mmss = (s) => {
    const m = Math.floor(s / 60), ss = s % 60;
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };
  const cur = mmss(secondsLeft);
  const nxt = mmss(nextSeconds);

  const frameInSecond = frame % fps;
  const FLIP_FRAMES = 8;
  const progress = frameInSecond >= fps - FLIP_FRAMES
    ? interpolate(frameInSecond, [fps - FLIP_FRAMES, fps - 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  // Charte : carte blanche penchée, label bleu "NOUS REVENONS DANS UN
  // INSTANT" + compteur navy. Flip digits navy sur cellules claires.
  const fs = (overlay.fontSize || 100) / 100;
  const fontB = ff(overlay.font, "'Montserrat Bold', sans-serif");
  const fontM = ff(overlay.font, "'Montserrat Medium', sans-serif");
  const inSp = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const label = f.label || 'NOUS REVENONS\nDANS UN INSTANT';

  return (
    <Box overlay={overlay} style={{ left: 1380, top: 840 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.25))' }}>
        <Para bg={COL.white} reveal={inSp}>
          <div style={{ padding: '18px 46px 18px 36px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: fontM, fontWeight: 600, fontSize: `${fs * 24}px`, color: ELEC, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.05, whiteSpace: 'pre-line' }}>{label}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', fontFamily: fontB, fontWeight: 700, fontSize: `${fs * 70}px`, color: NAVY }}>
              {[...cur].map((ch, i) => (
                ch === ':'
                  ? <span key={i} style={{ color: ELEC, margin: '0 2px' }}>:</span>
                  : <FlipDigit key={i} current={ch} next={nxt[i] ?? ch} progress={nxt[i] === ch ? 0 : progress} color={NAVY} bg="#EEF3FB" accent={ELEC} />
              ))}
            </div>
          </div>
        </Para>
        <div style={{ opacity: inSp > 0.6 ? 1 : 0 }}><AccentSlash height={Math.round(fs * 120 + 36)} /></div>
      </div>
    </Box>
  );
}

function LaSpeciale({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrée premium sobre : scale 1.05 → 1, fade, easeOutCubic.
  const scale = eo(frame, [0, fps], [1.05, 1]);
  const op = eo(frame, [0, fps * 0.7], [0, 1]);
  const fs = (overlay.fontSize || 100) / 100;
  const fontB = ff(overlay.font, "'Montserrat ExtraBold', sans-serif");
  // Découpe "ÉDITION SPÉCIALE" → ligne 1 blanche, ligne 2 (dernier mot) bleu.
  const raw = (f.texte || 'ÉDITION SPÉCIALE').trim();
  const words = raw.split(/\s+/);
  const line2 = words.length > 1 ? words.pop() : (f.sous_titre || 'SPÉCIALE');
  const line1 = words.length ? words.join(' ') : 'ÉDITION';

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {/* Globe géant, fond plus sombre (charte édition spéciale). */}
      <BackdropALWM darker globeOpacity={0.18} />
      <div style={{
        position: 'relative', zIndex: 3,
        transform: `scale(${scale})`, opacity: op,
        textAlign: 'center', fontFamily: fontB, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 0.98,
        textShadow: '0 16px 44px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: `${fs * 110}px`, color: COL.white }}>{line1}</div>
        <div style={{ fontSize: `${fs * 130}px`, color: COL.blue }}>{line2}</div>
        {/* Logo ALWM TV sous le titre */}
        <div style={{ marginTop: 28, opacity: eo(frame, [fps * 0.6, fps * 1.1], [0, 1]) }}>
          <Img src={staticFile('images/alwm-logo.png')} style={{ width: 260, objectFit: 'contain' }} />
        </div>
      </div>
    </Box>
  );
}

function FinMerci({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Clôture (charte) : colombe traverse gauche→droite, "Merci de votre
  // fidélité" en fondu, puis logo + signature. Fade out général.
  const doveFrom = Math.round(fps * 0.3);
  const doveTo = Math.round(fps * 2.6);
  const textOp = eo(frame, [fps * 1.0, fps * 1.8], [0, 1]);
  const logoOp = eo(frame, [fps * 2.4, fps * 3.2], [0, 1]);
  const logoScale = eo(frame, [fps * 2.4, fps * 3.4], [0.95, 1]);
  // Fade out général sur la dernière seconde.
  const globalOut = durationInFrames > fps ? eo(frame, [durationInFrames - fps, durationInFrames], [1, 0]) : 1;
  const fs = (overlay.fontSize || 100) / 100;
  const fontM = ff(overlay.font, "'Montserrat Medium', sans-serif");
  const fontB = ff(overlay.font, "'Montserrat Bold', sans-serif");

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: globalOut }}>
      <BackdropALWM />
      <DoveFlyThrough fromF={doveFrom} toF={doveTo} y={30} size={240} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 50 }}>
        <div style={{
          opacity: textOp,
          fontSize: `${fs * 56}px`, fontFamily: fontM, fontWeight: 500,
          color: C.colorTextMain || COL.white, letterSpacing: '0.02em',
          textShadow: '0 10px 24px rgba(0,0,0,0.5)',
        }}>
          {f.titre || f.texte || 'Merci de votre fidélité'}
        </div>
        <div style={{ width: 2, height: 90, background: C.colorAccent || 'rgba(74,163,255,0.5)', opacity: logoOp }} />
        <div style={{ opacity: logoOp, transform: `scale(${logoScale})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Img src={staticFile('images/alwm-logo.png')} style={{ width: 320, objectFit: 'contain', filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.6))' }} />
          <div style={{ fontFamily: fontM, fontWeight: 500, fontSize: `${fs * 22}px`, color: C.colorTextAccent || COL.light, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {f.sous_titre || "L'ACTUALITÉ EN CONTINU"}
          </div>
        </div>
      </AbsoluteFill>
    </Box>
  );
}

// INTRO DU JT — générique 10 s en 4 séquences (charte). Colombe + globe +
// bleu. Composition pensée pour durationInFrames ≈ 300 (10 s @30fps) mais
// s'adapte proportionnellement.
function IntroJT({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const D = durationInFrames || fps * 10;
  // Bornes des 4 séquences (proportionnelles à la durée totale).
  const s1 = D * 0.2, s2 = D * 0.5, s3 = D * 0.7;
  const fontXB = ff(overlay.font, "'Montserrat ExtraBold', sans-serif");
  const fontM = ff(overlay.font, "'Montserrat Medium', sans-serif");
  const words = (f.mots && String(f.mots).trim())
    ? String(f.mots).split(/[•,\n]+/).map((w) => w.trim()).filter(Boolean)
    : ['ACTUALITÉ', 'POLITIQUE', 'ÉCONOMIE', 'SPORT', 'CULTURE', 'MONDE'];

  // Globe : apparaît séq.2, reste ensuite.
  const globeOp = eo(frame, [s1, s2], [0, 0.35]);
  // Logo + LE JOURNAL : séq.4.
  const logoOp = eo(frame, [s3, s3 + fps * 0.5], [0, 1]);
  const logoScale = eo(frame, [s3, s3 + fps * 0.8], [0.92, 1]);
  const jtOp = eo(frame, [s3 + fps * 0.6, D - fps * 0.3], [0, 1]);
  const jtScale = eo(frame, [s3 + fps * 0.6, D], [0.95, 1]);
  const fadeOut = eo(frame, [D - fps * 0.4, D], [1, 0]);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: fadeOut }}>
      {/* Fond noir → bleu nuit (séq.1 puis backdrop). */}
      <AbsoluteFill style={{ background: COL.black }} />
      <div style={{ opacity: eo(frame, [s1 * 0.6, s2], [0, 1]) }}>
        <BackdropALWM globeOpacity={0} />
      </div>
      {/* Globe (séq.2+) */}
      <div style={{ position: 'absolute', inset: 0, opacity: globeOp }}>
        <WorldMap rotateSpeed={0.15} opacity={1} color={COL.light} glow={COL.blue} />
      </div>

      {/* Séq.1 : lignes bleues qui traversent (réseau mondial) */}
      {frame < s2 && [0.3, 0.45, 0.6, 0.75].map((y, i) => {
        const lx = eo(frame, [0, s2], [-30, 130]) + i * 6;
        const op = eo(frame, [0, s1 * 0.4, s2 * 0.9, s2], [0, 1, 1, 0]);
        return <div key={i} style={{ position: 'absolute', left: `${lx % 160 - 30}%`, top: `${y * 100}%`, width: '50%', height: 2, background: `rgba(74,163,255,${0.5 - i * 0.08})`, transform: 'skewX(-24deg)', opacity: op, boxShadow: '0 0 12px rgba(74,163,255,0.6)' }} />;
      })}

      {/* Séq.3 : mots clés slide-up + fade-in successifs */}
      {frame >= s2 && frame < s3 + fps * 0.3 && (
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 1200, height: 120 }}>
            {words.map((w, i) => {
              const step = (s3 - s2) / words.length;
              const wf = frame - (s2 + i * step);
              const op = interpolate(wf, [0, 6, step - 4, step], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              if (op <= 0) return null;
              const y = eo(wf, [0, 8], [40, 0]);
              return <div key={i} style={{ position: 'absolute', inset: 0, textAlign: 'center', opacity: op, transform: `translateY(${y}px)`, fontFamily: fontXB, fontWeight: 800, fontSize: 88, color: C.text(COL.white), letterSpacing: '0.04em', lineHeight: '120px', textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>{w}</div>;
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* Séq.4 : colombe traverse + logo + LE JOURNAL */}
      <DoveFlyThrough fromF={s3} toF={s3 + fps * 1.6} y={28} size={240} />
      {frame >= s3 && (
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          <Img src={staticFile('images/alwm-logo.png')} style={{ width: 460, objectFit: 'contain', opacity: logoOp, transform: `scale(${logoScale})`, filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.6))' }} />
          <div style={{ opacity: jtOp, transform: `scale(${jtScale})`, fontFamily: fontXB, fontWeight: 800, fontSize: 84, color: C.text(COL.white), letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {f.titre || 'LE JOURNAL'}
          </div>
        </AbsoluteFill>
      )}
    </Box>
  );
}

// TRANSITION REPORTAGE (v3.0)
// Plein écran, globe zoom lent, "REPORTAGE"
function TransitionReportage({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isOut = frame > durationInFrames - 24;
  const outFrame = isOut ? frame - (durationInFrames - 24) : 0;
  const outOpacity = eo(outFrame, [0, 24], [1, 0]);

  // Animation: scale 0.9 -> 1, opacity 0 -> 100 over 1s
  const titleScale = eo(frame, [0, fps], [0.9, 1]);
  const titleOpacity = eo(frame, [0, fps], [0, 1]);
  
  // Globe Zoom lent (scale from 1 to 1.1)
  const globeZoom = interpolate(frame, [0, durationInFrames], [1, 1.1]);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: isOut ? outOpacity : 1 }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${globeZoom})`, transformOrigin: 'center center' }}>
        <BackdropALWM darker={true} lines={false} globeOpacity={0.25} />
      </div>
      
      <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ 
          opacity: titleOpacity, 
          transform: `scale(${titleScale})`,
          fontFamily: ff(overlay.font, "'Montserrat ExtraBold', sans-serif"),
          fontWeight: 800,
          fontSize: 100,
          color: C.text(COL.white),
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textShadow: '0 10px 30px rgba(0,0,0,0.8)'
        }}>
          {f.titre || f.texte || 'REPORTAGE'}
        </div>
      </AbsoluteFill>
    </Box>
  );
}

const REGISTRY = {
  intro_jt: IntroJT,
  lower_third: NomInterview, // Keep as alias
  nom_interview: NomInterview,
  titre_reportage: TitreReportage,
  transition_reportage: TransitionReportage,
  flash_info: FlashInfo,
  breaking_news: BreakingNews,
  rappel_titres: RappelTitres,
  fin_merci: FinMerci,
  envato_presenter: EnvatoPresenterLowerThird,
  envato_news: EnvatoNewsLowerThird,
  envato_big_title: EnvatoBigTitle,
  envato_ticker: EnvatoTicker,
  envato_split_screen: EnvatoSplitScreen,
  envato_rep_minimal: EnvatoReportageMinimalLine,
  envato_rep_skew: EnvatoReportageDoubleSkew,
  envato_rep_swipe: EnvatoReportageGradientSwipe,
  envato_rep_glass: EnvatoReportageGlassmorphism,
  envato_rep_massif: EnvatoReportageMassif,
  envato_lt_compact: EnvatoLowerThirdCompact,
  envato_lt_corporate: EnvatoLowerThirdDuoCorporate,
  envato_lt_interview: EnvatoLowerThirdInterview,
  envato_loc_pin: EnvatoLocationPin,
  envato_quote: EnvatoQuoteBlock,
};

// Templates Envato : composants fullscreen qui n'utilisent pas Box ni
// pickColors en interne. On les enveloppe ici pour rendre position / échelle /
// couleurs / police PERSONNALISABLES (color-pickers + sliders de l'UI).
const ENVATO_IDS = new Set([
  'envato_presenter', 'envato_news', 'envato_big_title', 'envato_ticker',
  'envato_split_screen', 'envato_rep_minimal', 'envato_rep_skew',
  'envato_rep_swipe', 'envato_rep_glass', 'envato_rep_massif',
  'envato_lt_compact', 'envato_lt_corporate', 'envato_lt_interview',
  'envato_loc_pin', 'envato_quote',
]);

// Mappe les 3 slots couleur de l'UI (text / bg / accent) sur les noms de
// champs couleur internes des composants Envato.
const ACCENT_FIELDS = ['colorMain', 'colorAccent', 'colorHighlight', 'colorTop', 'colorBottom'];
const TEXT_FIELDS = ['colorTextMain', 'colorTextAccent', 'colorTextFirst', 'colorTextLast', 'colorTextTop', 'colorTextBottom'];
const BG_FIELDS = ['colorBg', 'bgColor'];

function injectColors(overlay) {
  const c = overlay.colors || {};
  if (!c.text && !c.bg && !c.accent) return overlay;
  const fields = { ...(overlay.fields || {}) };
  if (c.accent) ACCENT_FIELDS.forEach((k) => { fields[k] = c.accent; });
  if (c.text) TEXT_FIELDS.forEach((k) => { fields[k] = c.text; });
  if (c.bg) BG_FIELDS.forEach((k) => { fields[k] = c.bg; });
  return { ...overlay, fields };
}

export function Overlay({ overlay, durationInFrames }) {
  const Comp = REGISTRY[overlay.templateId];
  if (!Comp) return null;

  // Composants Envato : on enveloppe dans Box (position/échelle) + on injecte
  // les couleurs UI + la police via variable CSS héritée par les enfants.
  if (ENVATO_IDS.has(overlay.templateId)) {
    const merged = injectColors(overlay);
    const fontVar = overlay.font ? { '--ov-font': `'${overlay.font}', ` } : {};
    return (
      <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, ...fontVar }}>
        <Comp overlay={merged} durationInFrames={durationInFrames} />
      </Box>
    );
  }

  // Composants natifs ALWM : Box + pickColors déjà intégrés en interne.
  return <Comp overlay={overlay} durationInFrames={durationInFrames} />;
}
