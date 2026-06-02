import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from 'remotion';
import { COL, ff, pickColors, fxStyle, DEFAULT_ANCHOR } from '../theme.js';
import { entranceStyle, charStyle, PER_CHAR } from '../anim.js';
import { WorldMap } from '../worldmap.jsx';

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
  const posX = overlay.posX || 0;
  const posY = overlay.posY || 0;
  const scale = (overlay.scale ?? 100) / 100;
  
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
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const outDur = Math.round(fps * 0.5);
  const isOut = frame > durationInFrames - outDur;
  const outFrame = isOut ? frame - (durationInFrames - outDur) : 0;

  // Staggered springs for high-end feel
  const ribbonSpring = spring({ frame, fps, config: { damping: 16, stiffness: 100 } });
  const contentSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 16, stiffness: 90 } });
  const outSpring = spring({ frame: outFrame, fps, config: { damping: 16, stiffness: 100 } });
  
  const ribbonWidth = interpolate(ribbonSpring, [0, 1], [0, 100]);
  const contentY = interpolate(contentSpring, [0, 1], [20, 0]);
  const contentOp = interpolate(contentSpring, [0, 1], [0, 1]);

  const slideOutX = isOut ? interpolate(outSpring, [0, 1], [0, -200]) : 0;
  const slideOutOp = isOut ? interpolate(outSpring, [0, 1], [1, 0]) : 1;
  const fs = (overlay.fontSize || 100) / 100;
  const fontB = ff(overlay.font, "'Montserrat Bold', sans-serif");
  const fontM = ff(overlay.font, "'Montserrat Medium', sans-serif");
  const reveal = isOut ? 0 : ribbonSpring;

  return (
    <Box overlay={overlay} style={{ left: 120, top: 880, opacity: slideOutOp, transform: `translateX(${slideOutX}px)` }}>
      <div style={{ display: 'flex', flexDirection: 'column', filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.35))' }}>
        {/* Bandeau NOM : navy + accent diagonal */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <Para bg={NAVY} reveal={reveal} >
            <div style={{
              opacity: contentOp, transform: `translateY(${contentY}px)`,
              padding: '14px 52px 14px 40px',
              fontWeight: 700, fontSize: `${fs * 46}px`, color: COL.white,
              fontFamily: fontB, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap',
            }}>{f.name || f.nom || 'PRÉNOM NOM'}</div>
          </Para>
          <div style={{ opacity: reveal > 0.7 ? 1 : 0 }}><AccentSlash height={Math.round(fs * 46 + 28)} /></div>
        </div>
        {/* Ligne FONCTION : fond blanc, texte bleu électrique */}
        <Para bg={COL.white} reveal={contentSpring} style={{ marginLeft: 14, marginTop: 5 }}>
          <div style={{
            opacity: contentOp,
            padding: '7px 40px 7px 30px',
            fontSize: `${fs * 26}px`, color: ELEC, fontFamily: fontM, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
          }}>{f.title || f.fonction || 'FONCTION / QUALITÉ'}</div>
        </Para>
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
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isOut = frame > durationInFrames - 30;
  const outFrame = isOut ? frame - (durationInFrames - 30) : 0;
  const outOpacity = interpolate(outFrame, [0, 30], [1, 0]);

  // bg cinematic zoom
  const bgScale = interpolate(frame, [0, durationInFrames], [1, 1.08]);
  const rotateX = interpolate(frame, [0, durationInFrames], [8, -4]);
  const rotateY = interpolate(frame, [0, durationInFrames], [-4, 4]);

  // Title snappy scale + drift
  const titleSpring = spring({ frame, fps, config: { damping: 24, stiffness: 90 } });
  const titleScale = interpolate(titleSpring, [0, 1], [0.8, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleDrift = interpolate(frame, [0, durationInFrames], [0, -30]);

  // Light sweep
  const lightPos = interpolate(frame, [0, 80], [-100, 200], { extrapolateRight: 'clamp' });

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: isOut ? outOpacity : 1, perspective: 1200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(circle at center, ${C.bg(COL.blue)} 0%, ${C.bg(COL.navy)} 100%)`,
        transform: `scale(${bgScale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
        overflow: 'hidden',
        zIndex: 1
      }}>
         <Watermark opacity={0.08} mode="overlay" />
         <WorldMap rotateSpeed={0.2} opacity={0.3} color={COL.light} glow={COL.blue} />
         {/* Volumetric light beam */}
         <div style={{
           position: 'absolute', top: '-50%', bottom: '-50%', width: '60%', left: '20%',
           background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
           transform: `translateX(${lightPos}%) skewX(-35deg)`,
           zIndex: 2,
           filter: 'blur(40px)'
         }} />
      </div>

      <div style={{
        position: 'relative',
        transform: `scale(${titleScale}) translateY(${titleDrift}px)`,
        opacity: titleOpacity,
        textAlign: 'center',
        color: C.text(COL.white),
        fontFamily: ff(overlay.font, "'Montserrat', sans-serif"),
        zIndex: 2,
        textShadow: '0 20px 40px rgba(0,0,0,0.6)'
      }}>
        <div style={{ 
          fontSize: `${(overlay.fontSize || 100) / 100 * 180}px`, 
          fontWeight: 900, 
          letterSpacing: '0.02em', 
          lineHeight: 1.1,
          background: `linear-gradient(180deg, #FFFFFF 0%, #E0E0E0 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textTransform: 'uppercase'
        }}>
          {f.titre || f.title || 'LE JOURNAL'}
        </div>
        <div style={{ 
          fontSize: `${(overlay.fontSize || 100) / 100 * 50}px`, 
          color: C.accent(COL.gold), 
          fontWeight: 600, 
          marginTop: 20,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          WebkitTextFillColor: 'initial' // override gradient
        }}>
          {f.sous_titre || f.subtitle || f.date || 'EDITION SPECIALE'}
        </div>
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
  const titleColor = C.text(NAVY);
  const fontB = ff(overlay.font, "'Montserrat Bold', sans-serif");
  const fontM = ff(overlay.font, "'Montserrat Medium', sans-serif");

  return (
    <Box overlay={overlay} style={{ left: 110, top: 820, width: 1300, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {/* Bandeau titre : parallélogramme navy + texte blanc */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <Para bg={NAVY} reveal={reveal} padding="0" style={{ boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }}>
          <div style={{
            padding: '18px 56px 18px 48px',
            fontFamily: fontB, fontWeight: 700,
            fontSize: `${fs * 50}px`, color: COL.white,
            textTransform: 'uppercase', letterSpacing: '0.01em', whiteSpace: 'nowrap',
          }}>{f.titre || f.sujet || f.title || 'LE TITRE DU REPORTAGE'}</div>
        </Para>
        {/* accent diagonal bleu électrique */}
        <div style={{ opacity: reveal > 0.7 ? 1 : 0, transition: 'opacity .2s' }}>
          <AccentSlash height={Math.round(fs * 50 + 36)} />
        </div>
      </div>
      {/* Sous-titre : sur fond blanc, texte bleu + petit carré bleu à gauche */}
      <div style={{ display: 'flex', alignItems: 'stretch', marginTop: 6, marginLeft: 18 }}>
        <div style={{ width: 14, background: ELEC, clipPath: `polygon(${SLANT * 0.5}px 0,100% 0,calc(100% - ${SLANT * 0.5}px) 100%,0 100%)` }} />
        <Para bg={COL.white} reveal={subSp} padding="0" style={{ boxShadow: '0 10px 24px rgba(0,0,0,0.2)' }}>
          <div style={{
            padding: '8px 40px 8px 28px',
            fontFamily: fontM, fontWeight: 600,
            fontSize: `${fs * 26}px`, color: ELEC,
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

  const titres = Array.isArray(f.titres) ? f.titres : [f.titre1, f.titre2, f.titre3].filter(Boolean);
  if (titres.length === 0) {
    titres.push("PREMIER TITRE DE L'ACTUALITÉ", "DEUXIÈME INFORMATION MAJEURE", "TROISIÈME SUJET IMPORTANT");
  }
  
  const isOut = frame > durationInFrames - 30;
  const outFrame = isOut ? frame - (durationInFrames - 30) : 0;
  const outOpacity = interpolate(outFrame, [0, 30], [1, 0]);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: isOut ? outOpacity : 1 }}>
      {/* Brand background */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${C.bg(COL.navy)} 0%, ${C.bg(COL.dark)} 100%)`, zIndex: 0 }} />
      <WorldMap rotateSpeed={0.12} opacity={0.25} color={COL.light} glow={COL.blue} />
      
      {/* List items staggered */}
      <div style={{ position: 'absolute', left: 160, top: 220, zIndex: 2 }}>
        {titres.map((titre, i) => {
          const delay = Math.round(fps * 0.15) * i;
          const itemFrame = Math.max(0, frame - delay);
          const slideIn = spring({ frame: itemFrame, fps, config: { damping: 16, stiffness: 100 } });
          const x = interpolate(slideIn, [0, 1], [-100, 0]);
          const op = interpolate(slideIn, [0, 1], [0, 1]);
          const numStr = String(i + 1).padStart(2, '0');

          return (
            <div key={i} style={{
              transform: `translateX(${x}px)`,
              opacity: op,
              display: 'flex',
              alignItems: 'center',
              marginBottom: 32,
              maxWidth: 1300,
            }}>
              {/* Bold glowing number */}
              <div style={{
                color: C.accent(COL.blue),
                fontFamily: ff(overlay.font, "'Montserrat', sans-serif"),
                fontWeight: 900,
                fontSize: 80,
                letterSpacing: '-0.02em',
                marginRight: 40,
                textShadow: `0 0 20px ${C.accent('rgba(0,123,255,0.4)')}`
              }}>{numStr}</div>
              
              {/* Clean text instead of boxed card */}
              <div style={{ 
                color: C.text(COL.white), 
                fontSize: 52, 
                fontFamily: ff(overlay.font, "'Montserrat', sans-serif"), 
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.01em',
                lineHeight: 1.2
              }}>
                {titre}
              </div>
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
  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, display: 'flex', height: 80, boxShadow: '0 15px 30px rgba(0,0,0,0.4)' }}>
      <div style={{ 
        background: C.accent(COL.black), 
        color: C.text(COL.red), 
        fontFamily: "'Archivo Black', sans-serif", 
        fontSize: 44, 
        width: 260, 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        letterSpacing: '0.05em'
      }}>
        FLASH
      </div>
      <div style={{ 
        background: C.bg(COL.red), 
        color: C.text(COL.white), 
        fontWeight: 700, 
        fontSize: `${(overlay.fontSize || 100) / 100 * 42}px`, 
        flex: 1, 
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 40,
        fontFamily: ff(overlay.font, "'Inter', sans-serif"),
        textTransform: 'uppercase'
      }}>
        <Tx overlay={overlay} durationInFrames={durationInFrames}>{f.texte}</Tx>
      </div>
    </Box>
  );
}

function BreakingNews({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 120, top: 120 }}>
      <div style={{ 
        background: C.bg(COL.red), 
        color: COL.white, 
        fontFamily: "'Archivo Black', sans-serif", 
        fontSize: `${(overlay.fontSize || 100) / 100 * 70}px`, 
        padding: '12px 40px', 
        transform: 'skewX(-15deg)', 
        display: 'inline-block',
        boxShadow: `0 0 30px ${C.bg('rgba(220,38,38,0.5)')}`
      }}>
        <span style={{ display: 'inline-block', transform: 'skewX(15deg)', letterSpacing: '0.02em' }}>{f.titre || 'DERNIÈRE MINUTE'}</span>
      </div>
      <div style={{ 
        marginTop: 16, 
        marginLeft: 20,
        background: C.accent(COL.white), 
        color: C.text(COL.ink), 
        fontWeight: 800, 
        fontSize: `${(overlay.fontSize || 100) / 100 * 44}px`, 
        padding: '12px 30px', 
        display: 'inline-block',
        fontFamily: ff(overlay.font, "'Inter', sans-serif"),
        boxShadow: '10px 10px 30px rgba(0,0,0,0.3)'
      }}>
        <Tx overlay={{...overlay, animation: 'typewriter'}} durationInFrames={durationInFrames}>{f.texte || f.sujet}</Tx>
      </div>
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

  // Dramatic cinematic entrance
  const scale = interpolate(spring({ frame, fps, config: { damping: 18, stiffness: 60 } }), [0, 1], [0.85, 1]);
  const op = interpolate(frame, [0, 30], [0, 1]);
  
  // Cinematic light flare
  const flareX = interpolate(frame, [0, 90], [-100, 200]);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080 }}>
      <div style={{ 
        width: 1920, height: 1080, 
        background: `radial-gradient(circle at center, ${C.bg(COL.dark)} 0%, ${COL.black} 100%)`,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        <WorldMap rotateSpeed={0.1} opacity={0.2} color={COL.gold} glow={COL.gold} />
        
        {/* Glow behind text */}
        <div style={{
          position: 'absolute',
          width: 800, height: 400,
          background: `radial-gradient(ellipse, ${C.accent('rgba(212,175,55,0.15)')} 0%, transparent 70%)`,
          filter: 'blur(40px)',
          zIndex: 1
        }} />
        
        {/* Text */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          transform: `scale(${scale})`,
          opacity: op,
          fontSize: 170,
          fontFamily: "'Archivo Black', sans-serif",
          color: C.text(COL.gold),
          textShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.4)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          overflow: 'hidden'
        }}>
          {f.texte || 'LA SPÉCIALE'}
          
          {/* Flare sweeping across text */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: '30%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            transform: `translateX(${flareX}%) skewX(-20deg)`,
            mixBlendMode: 'overlay'
          }} />
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

  // Elegant slow reveal
  const textOp = interpolate(frame, [20, 60], [0, 1], { extrapolateRight: 'clamp' });
  const textY = interpolate(spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 20 } }), [0, 1], [30, 0]);
  
  const logoOp = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = interpolate(spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 14 } }), [0, 1], [0.9, 1]);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080 }}>
      <div style={{ 
        width: 1920, height: 1080, 
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        background: `radial-gradient(circle at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.9) 100%)`,
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{
          opacity: textOp,
          transform: `translateY(${textY}px)`,
          fontSize: 64,
          fontFamily: ff(overlay.font, "'Montserrat', sans-serif"),
          fontWeight: 600,
          color: C.text(COL.white),
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textShadow: '0 10px 20px rgba(0,0,0,0.5)',
          marginBottom: 60
        }}>
          {f.texte || 'MERCI DE NOUS AVOIR SUIVIS'}
        </div>
        
        <div style={{
          opacity: logoOp,
          transform: `scale(${logoScale})`,
          filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.6))'
        }}>
          <Img src={staticFile('images/alwm-logo.png')} style={{ width: 450, objectFit: 'contain' }} />
        </div>
      </div>
    </Box>
  );
}

const REGISTRY = {
  lower_third: NomInterview,
  nom_interview: NomInterview,
  lower_third_pro: LowerThirdPro,
  grand_titre: GrandTitre,
  titre_karaoke: TitreKaraoke,
  titre_reportage: TitreReportage,
  signature_reportage: SignatureReportage,
  rappel_titres: RappelTitres,
  sous_titre: SousTitre,
  bandeau_pays: BandeauPays,
  flash_info: FlashInfo,
  breaking_news: BreakingNews,
  score_resultat: ScoreResultat,
  horloge_date: HorlogeDate,
  a_suivre: ASuivre,
  tout_de_suite: ToutDeSuite,
  publicite: Publicite,
  compte_a_rebours: CompteARebours,
  la_speciale: LaSpeciale,
  fin_merci: FinMerci,
};

export function Overlay({ overlay, durationInFrames }) {
  const Comp = REGISTRY[overlay.templateId];
  return Comp ? <Comp overlay={overlay} durationInFrames={durationInFrames} /> : null;
}
