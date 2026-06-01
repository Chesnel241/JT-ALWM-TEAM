import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from 'remotion';
import { COL, ff, pickColors, fxStyle, DEFAULT_ANCHOR } from '../theme.js';
import { entranceStyle, charStyle, PER_CHAR } from '../anim.js';

// Texte avec animation d'entrée (per-char ou bloc) + contour/halo + police.
function Tx({ children, overlay, durationInFrames, fontFamily, baseStyle }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const animIn = overlay.animation || 'fade';
  const animOut = overlay.animationOut || 'fade';
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

// Position d'un overlay : ancrage défaut + delta drag (overlay.position).
function shift(overlay) {
  const def = DEFAULT_ANCHOR[overlay.templateId] || { x: 0, y: 0 };
  const p = overlay.position;
  if (!p || typeof p !== 'object') return { dx: 0, dy: 0 };
  return { dx: (Number(p.x) || def.x) - def.x, dy: (Number(p.y) || def.y) - def.y };
}

const px = (n) => `${n}px`;

// Wrapper positionné en coords 1920×1080, applique le delta de drag + offset perso.
function Box({ overlay, style, children }) {
  const { dx, dy } = shift(overlay);
  const posX = overlay.posX || 0;
  const posY = overlay.posY || 0;
  const scale = (overlay.scale ?? 100) / 100;
  
  // We merge transforms. dx/dy come from legacy dragging, posX/posY come from sliders.
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

  const inSpring = spring({ frame, fps, config: { damping: 14 } });
  const outSpring = spring({ frame: outFrame, fps, config: { damping: 14 } });
  
  const funcDelayFrames = Math.round(fps * 0.15);
  const funcSpring = spring({ frame: Math.max(0, frame - funcDelayFrames), fps, config: { damping: 14 } });

  const slideX = isOut 
    ? interpolate(outSpring, [0, 1], [0, -150]) 
    : interpolate(inSpring, [0, 1], [-150, 0]);
  
  const containerOpacity = isOut ? interpolate(outSpring, [0, 1], [1, 0]) : 1;
  const nameOpacity = interpolate(inSpring, [0, 1], [0, 1]);
  const funcOpacity = interpolate(funcSpring, [0, 1], [0, 1]);

  return (
    <Box overlay={overlay} style={{ left: 100, top: 880, opacity: containerOpacity, transform: `translateX(${slideX}px)` }}>
      <div style={{ background: C.bg(COL.navy), borderLeft: `12px solid ${C.accent(COL.gold)}`, padding: '16px 42px', minWidth: 400 }}>
        <div style={{ fontWeight: 700, fontSize: `${(overlay.fontSize || 100) / 100 * 52}px`, lineHeight: `${(overlay.lineHeight || 120) / 100}`, color: C.text(COL.white), opacity: nameOpacity, fontFamily: ff(overlay.font, "'Montserrat Bold', sans-serif") }}>
          {f.name || f.nom || "NOM INTERVIEW"}
        </div>
        <div style={{ fontSize: `${(overlay.fontSize || 100) / 100 * 30}px`, lineHeight: `${(overlay.lineHeight || 120) / 100}`, color: C.accent(COL.blue), marginTop: 8, opacity: funcOpacity, fontFamily: ff(overlay.font, "'Montserrat Medium', sans-serif"), fontWeight: 500 }}>
          {f.title || f.fonction || "FONCTION"}
        </div>
      </div>
    </Box>
  );
}

function LowerThirdPro({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 72, top: 892 }}>
      <div style={{ background: C.bg(COL.white), color: C.text(COL.ink), fontFamily: ff(overlay.font, "'Archivo Black', sans-serif"), fontWeight: 900, fontSize: `${(overlay.fontSize || 100) / 100 * 44}px`, lineHeight: `${(overlay.lineHeight || 120) / 100}`, padding: '10px 18px', borderLeft: `14px solid ${C.accent(COL.blue)}` }}>
        <Tx overlay={overlay} durationInFrames={durationInFrames} fontFamily="'Archivo Black', sans-serif">{f.titre}</Tx>
      </div>
      <div style={{ background: C.accent(COL.blue), color: COL.white, fontWeight: 700, fontSize: `${(overlay.fontSize || 100) / 100 * 30}px`, lineHeight: `${(overlay.lineHeight || 120) / 100}`, padding: '8px 18px', display: 'inline-block', marginTop: 6 }}>{f.sous_titre}</div>
    </Box>
  );
}

function GrandTitre({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isOut = frame > durationInFrames - 20;
  const outFrame = isOut ? frame - (durationInFrames - 20) : 0;
  const outOpacity = interpolate(outFrame, [0, 20], [1, 0]);

  // bg zoom slightly
  const bgScale = interpolate(frame, [0, durationInFrames], [1, 1.05]);
  // slow 3D rotation
  const rotateX = interpolate(frame, [0, durationInFrames], [5, -5]);
  const rotateY = interpolate(frame, [0, durationInFrames], [-2, 2]);

  // Title scales 80->100, op 0->1
  const titleSpring = spring({ frame, fps, config: { damping: 20 } });
  const titleScale = interpolate(titleSpring, [0, 1], [0.8, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Light reflection sweep
  const lightPos = interpolate(frame, [0, 60], [-100, 200], { extrapolateRight: 'clamp' }); // sweeps across

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: isOut ? outOpacity : 1, perspective: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: C.bg(COL.navy),
        transform: `scale(${bgScale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
        overflow: 'hidden',
        zIndex: 1
      }}>
         {/* Light sweep */}
         <div style={{
           position: 'absolute', top: 0, bottom: 0, width: '40%',
           background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)',
           transform: `translateX(${lightPos}%) skewX(-20deg)`
         }} />
      </div>

      <div style={{
        position: 'relative',
        transform: `scale(${titleScale})`,
        opacity: titleOpacity,
        textAlign: 'center',
        color: C.text(COL.white),
        fontFamily: ff(overlay.font, "'Montserrat Bold', sans-serif"),
        zIndex: 2,
        textShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: `${(overlay.fontSize || 100) / 100 * 160}px`, lineHeight: `${(overlay.lineHeight || 120) / 100}`, letterSpacing: '0.04em', fontWeight: 700 }}>{f.titre || f.title || 'LE JOURNAL'}</div>
        <div style={{ fontSize: `${(overlay.fontSize || 100) / 100 * 60}px`, lineHeight: `${(overlay.lineHeight || 120) / 100}`, color: C.accent(COL.light), fontFamily: ff(overlay.font, "'Montserrat Medium', sans-serif"), fontWeight: 500, marginTop: 15 }}>{f.sous_titre || f.subtitle || f.date || 'EDITION SPECIALE'}</div>
      </div>
    </Box>
  );
}

function TitreKaraoke({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const o = { ...overlay, animation: overlay.animation || 'cascade' };
  return (
    <Box overlay={overlay} style={{ left: 0, top: 455, width: 1920, textAlign: 'center' }}>
      <div style={{ borderTop: `6px solid ${C.accent(COL.gold)}`, background: C.bg('rgba(0,0,0,.55)'), padding: '28px 0', width: 1920, fontSize: 92, color: C.text(COL.white) }}>
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

  const inDuration = Math.round(fps * 0.4);
  const subDelay = Math.round(fps * 0.2);
  const outDuration = Math.round(fps * 0.5);
  
  const isOut = frame > durationInFrames - outDuration;
  const outFrame = isOut ? frame - (durationInFrames - outDuration) : 0;

  const barProgress = spring({ frame, fps, config: { damping: 14 } });
  const whiteProgress = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });
  
  const titleFrame = Math.max(0, frame - 5);
  const titleSlide = interpolate(spring({ frame: titleFrame, fps, config: { damping: 12 } }), [0, 1], [-60, 0]);
  const titleBlur = interpolate(titleFrame, [0, 10], [10, 0], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(titleFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const subFrame = Math.max(0, frame - (5 + subDelay));
  const subSlide = interpolate(spring({ frame: subFrame, fps, config: { damping: 12 } }), [0, 1], [-40, 0]);
  const subOpacity = interpolate(subFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const outProgress = spring({ frame: outFrame, fps, config: { damping: 14 } });

  const clipLeft = interpolate(barProgress, [0, 1], [100, 0]);
  const clipRight = isOut ? interpolate(outProgress, [0, 1], [0, 100]) : 0;
  
  const whiteClipLeft = interpolate(whiteProgress, [0, 1], [100, 0]);

  return (
    <Box overlay={overlay} style={{ left: 100, top: 850, width: 1400, height: 'auto', minHeight: 140 }}>
       {/* Blue bar */}
       <div style={{
         position: 'absolute', top: 0, left: 0, bottom: 0,
         width: '100%',
         background: C.accent(COL.blue),
         clipPath: `inset(0 ${clipRight}% 0 ${isOut ? 0 : clipLeft}%)`,
       }} />
       {/* White background */}
       <div style={{
         position: 'relative',
         width: '100%',
         background: C.bg(COL.white),
         clipPath: `inset(0 ${clipRight}% 0 ${isOut ? 0 : whiteClipLeft}%)`,
         padding: '24px 40px', boxSizing: 'border-box',
         display: 'flex', flexDirection: 'column', justifyContent: 'center'
       }}>
          <div style={{
            transform: `translateX(${isOut ? 0 : titleSlide}px)`,
            filter: `blur(${isOut ? 0 : titleBlur}px)`,
            opacity: isOut ? 1 : titleOpacity,
            fontWeight: 700, fontSize: `${(overlay.fontSize || 100) / 100 * 48}px`,
            lineHeight: `${(overlay.lineHeight || 110) / 100}`,
            color: C.text(COL.navy),
            fontFamily: ff(overlay.font, "'Montserrat Bold', sans-serif"),
            marginBottom: 8
          }}>
             {f.titre || f.sujet || f.title || "TITRE REPORTAGE"}
          </div>
          <div style={{
            transform: `translateX(${isOut ? 0 : subSlide}px)`,
            opacity: isOut ? 1 : subOpacity,
            fontSize: `${(overlay.fontSize || 100) / 100 * 28}px`,
            lineHeight: `${(overlay.lineHeight || 110) / 100}`,
            color: C.accent(COL.blue),
            fontFamily: ff(overlay.font, "'Montserrat Medium', sans-serif"), fontWeight: 500
          }}>
             {f.subtitle || f.sous_titre || "SOUS-TITRE"}
          </div>
       </div>
    </Box>
  );
}

function SignatureReportage({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const outDur = 15;
  const isOut = frame > durationInFrames - outDur;
  const outFrame = isOut ? frame - (durationInFrames - outDur) : 0;

  const inPop = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const outFade = interpolate(outFrame, [0, outDur], [1, 0], { extrapolateRight: 'clamp' });
  
  const moveY = interpolate(inPop, [0, 1], [20, 0]);
  const opacity = interpolate(inPop, [0, 1], [0, 1]);

  return (
    <Box overlay={overlay} style={{ left: 1600, top: 950, transform: `translateY(${moveY}px)`, opacity: isOut ? outFade : opacity }}>
      <div style={{ background: C.bg('rgba(0,0,0,0.7)'), color: C.text(COL.white), padding: '10px 24px', borderRadius: 4, fontSize: 26, fontFamily: ff(overlay.font, "'Montserrat Medium', sans-serif"), fontWeight: 500, letterSpacing: '0.02em', border: `1px solid ${C.accent('rgba(255,255,255,0.15)')}` }}>
        {f.texte || f.signature || "SIGNATURE"}
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
  
  const isOut = frame > durationInFrames - 20;
  const outFrame = isOut ? frame - (durationInFrames - 20) : 0;
  const outOpacity = interpolate(outFrame, [0, 20], [1, 0]);

  return (
    <Box overlay={overlay} style={{ left: 150, top: 250, opacity: isOut ? outOpacity : 1 }}>
      {titres.map((titre, i) => {
        const delay = Math.round(fps * 0.2) * i;
        const itemFrame = Math.max(0, frame - delay);
        const slideIn = spring({ frame: itemFrame, fps, config: { damping: 14 } });
        const x = interpolate(slideIn, [0, 1], [-150, 0]);
        const opacity = interpolate(slideIn, [0, 1], [0, 1]);
        
        return (
          <div key={i} style={{
            transform: `translateX(${x}px)`,
            opacity,
            background: C.bg('rgba(0, 14, 51, 0.9)'),
            color: C.text(COL.white),
            padding: '24px 40px',
            fontSize: 44,
            fontFamily: 'Inter',
            fontWeight: 800,
            borderLeft: `10px solid ${C.accent(COL.gold)}`,
            marginBottom: 24,
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            maxWidth: 1200
          }}>
            {titre}
          </div>
        );
      })}
    </Box>
  );
}

function SousTitre({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 200, top: 972, width: 1520, textAlign: 'center' }}>
      <span style={{ background: C.bg('rgba(0,0,0,.7)'), color: C.text(COL.white), fontSize: 40, padding: '6px 16px' }}>
        <Tx overlay={overlay} durationInFrames={durationInFrames} fontFamily="Inter">{f.texte}</Tx>
      </span>
    </Box>
  );
}

function BandeauPays({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 1660, top: 20 }}>
      <div style={{ background: C.bg(COL.red), borderBottom: `6px solid ${C.accent(COL.gold)}`, width: 260, height: 64, color: C.text(COL.white), fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, textAlign: 'center', lineHeight: '64px' }}>{f.pays}</div>
    </Box>
  );
}

function FlashInfo({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, display: 'flex', height: 72 }}>
      <div style={{ background: C.accent(COL.black), color: C.text(COL.white), fontFamily: 'Anton, sans-serif', fontSize: 40, width: 230, textAlign: 'center', lineHeight: '72px' }}>FLASH</div>
      <div style={{ background: C.bg(COL.red), color: C.text(COL.white), fontWeight: 800, fontSize: `${(overlay.fontSize || 100) / 100 * 38}px`, lineHeight: `${(overlay.lineHeight || 120) / 100 * 72}px`, flex: 1, paddingLeft: 30 }}>
        <Tx overlay={overlay} durationInFrames={durationInFrames} fontFamily="Inter">{f.texte}</Tx>
      </div>
    </Box>
  );
}

function BreakingNews({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 120, top: 150 }}>
      <div style={{ background: C.bg(COL.red), color: COL.white, fontFamily: 'Anton, sans-serif', fontSize: `${(overlay.fontSize || 100) / 100 * 66}px`, lineHeight: `${(overlay.lineHeight || 120) / 100}`, padding: '6px 40px', transform: 'skewX(-12deg)', display: 'inline-block' }}>
        <span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>{f.titre || 'DERNIÈRE MINUTE'}</span>
      </div>
      <div style={{ marginTop: 12, background: C.accent(COL.white), color: C.text(COL.ink), fontWeight: 800, fontSize: `${(overlay.fontSize || 100) / 100 * 40}px`, lineHeight: `${(overlay.lineHeight || 120) / 100}`, padding: '8px 18px', display: 'inline-block' }}>
        <Tx overlay={overlay} durationInFrames={durationInFrames} fontFamily="Inter">{f.texte || f.sujet}</Tx>
      </div>
    </Box>
  );
}

function ScoreResultat({ overlay, durationInFrames }) {
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

function HorlogeDate({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  return (
    <Box overlay={overlay} style={{ left: 20, top: 20, display: 'flex', alignItems: 'center', background: C.bg(COL.red), padding: '4px 14px', height: 70 }}>
      <span style={{ color: C.text(COL.white), fontFamily: "'Bebas Neue', sans-serif", fontSize: 48 }}>{f.heure}</span>
      <span style={{ color: C.accent(COL.gold), fontSize: 26, marginLeft: 12 }}>{f.date}</span>
    </Box>
  );
}

// 6. ASuivre
function ASuivre({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // White card slides in from right
  const cardX = interpolate(spring({ frame, fps, config: { damping: 14 } }), [0, 1], [1000, 0]);
  
  // Blue bar pushes text
  const barWidth = interpolate(spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 12 } }), [0, 1], [0, 20]);
  
  // Typewriter effect handled by Tx (with animation: 'typewriter')
  const o = { ...overlay, animation: overlay.animation || 'typewriter' };

  return (
    <Box overlay={overlay} style={{ left: 1400, top: 800 }}>
      <div style={{ 
        transform: `translateX(${cardX}px)`, 
        background: C.bg(COL.white), 
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
      }}>
        <div style={{ width: barWidth, height: 60, background: C.accent(COL.blue), marginRight: barWidth > 0 ? 20 : 0 }} />
        <div style={{ color: C.text(COL.ink), fontSize: 40, fontFamily: ff(overlay.font, "'Montserrat Bold', sans-serif"), fontWeight: 700 }}>
          <Tx overlay={o} durationInFrames={durationInFrames}>{f.texte || 'VOTRE PROGRAMME'}</Tx>
        </div>
      </div>
    </Box>
  );
}

// 7. ToutDeSuite
function ToutDeSuite({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Faster sliding
  const cardX = interpolate(spring({ frame, fps, config: { damping: 10, stiffness: 180 } }), [0, 1], [1000, 0]);
  const barWidth = interpolate(spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 10, stiffness: 180 } }), [0, 1], [0, 24]);
  
  const o = { ...overlay, animation: overlay.animation || 'typewriter' };

  return (
    <Box overlay={overlay} style={{ left: 1400, top: 800 }}>
      <div style={{ 
        transform: `translateX(${cardX}px)`, 
        background: C.bg(COL.white), 
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        borderLeft: `8px solid ${C.accent(COL.gold)}`
      }}>
        <div style={{ width: barWidth, height: 60, background: C.accent(COL.red), marginRight: barWidth > 0 ? 20 : 0 }} />
        <div style={{ color: C.text(COL.ink), fontSize: 44, fontFamily: ff(overlay.font, "'Montserrat Bold', sans-serif"), fontWeight: 700, transform: 'skewX(-10deg)' }}>
          <Tx overlay={o} durationInFrames={durationInFrames}>{f.texte || 'TOUT DE SUITE'}</Tx>
        </div>
      </div>
    </Box>
  );
}

// 8. Publicite
function Publicite({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Zoom in text
  const textScale = interpolate(spring({ frame, fps, config: { damping: 12 } }), [0, 1], [0, 1]);
  
  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080 }}>
      <div style={{ 
        width: 1920, height: 1080, 
        background: `radial-gradient(circle at center, ${C.bg(COL.blue)} 0%, ${C.bg(COL.navy)} 100%)`,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* CSS Pattern for world map / network */}
        <div style={{
          position: 'absolute', width: '200%', height: '200%',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 2px, transparent 2px)',
          backgroundSize: '40px 40px',
          opacity: 0.5,
          transform: `rotate(${frame * 0.05}deg)`
        }} />
        <div style={{
          transform: `scale(${textScale})`,
          fontSize: 180,
          fontFamily: 'Anton, sans-serif',
          color: C.text(COL.white),
          letterSpacing: '10px',
          textShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
          {f.texte || 'PUBLICITÉ'}
        </div>
      </div>
    </Box>
  );
}

// 9. CompteARebours
function CompteARebours({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Digital flip effect: basic version we can just scale Y to 0 and back on second change
  const secondsLeft = Math.max(0, Math.ceil((durationInFrames - frame) / fps));
  const timeString = `00:${secondsLeft.toString().padStart(2, '0')}`;
  
  // Flip animation every second
  const frameInSecond = frame % fps;
  const flipScaleY = frameInSecond < 5 ? interpolate(frameInSecond, [0, 2.5, 5], [1, 0, 1]) : 1;

  return (
    <Box overlay={overlay} style={{ left: 1600, top: 900 }}>
      <div style={{
        background: C.bg('rgba(0,0,0,0.8)'),
        padding: '10px 30px',
        border: `4px solid ${C.accent(COL.gold)}`,
        borderRadius: 10
      }}>
        <div style={{
          fontSize: 60,
          fontFamily: "'Bebas Neue', sans-serif",
          color: C.text(COL.white),
          transform: `scaleY(${flipScaleY})`,
          transformOrigin: 'center'
        }}>
          {timeString}
        </div>
      </div>
    </Box>
  );
}

// 10. LaSpeciale
function LaSpeciale({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Text LA SPÉCIALE scales 90->100% with impact shake
  const scale = interpolate(spring({ frame, fps, config: { damping: 10 } }), [0, 1], [0.9, 1]);
  // Impact shake right after scale completes
  const isShaking = frame > 10 && frame < 20;
  const shakeX = isShaking ? Math.sin(frame * 2) * 10 : 0;
  const shakeY = isShaking ? Math.cos(frame * 2) * 10 : 0;
  
  // Sliding cross bars
  const bar1X = interpolate(spring({ frame, fps, config: { damping: 14 } }), [0, 1], [-1920, 0]);
  const bar2X = interpolate(spring({ frame, fps, config: { damping: 14 } }), [0, 1], [1920, 0]);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080 }}>
      <div style={{ 
        width: 1920, height: 1080, 
        background: `radial-gradient(circle at center, ${C.bg(COL.dark)} 0%, ${COL.black} 100%)`,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Slow rotating world map background */}
        <div style={{
          position: 'absolute', width: '150%', height: '150%',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '100px 100px',
          transform: `rotate(${frame * 0.02}deg)`,
          opacity: 0.6
        }} />
        
        {/* Sliding cross bars */}
        <div style={{ position: 'absolute', width: '100%', height: 4, background: C.accent(COL.gold), top: '40%', transform: `translateX(${bar1X}px)` }} />
        <div style={{ position: 'absolute', width: '100%', height: 4, background: C.accent(COL.gold), top: '60%', transform: `translateX(${bar2X}px)` }} />
        
        {/* Impact shake text */}
        <div style={{
          transform: `scale(${scale}) translate(${shakeX}px, ${shakeY}px)`,
          fontSize: 160,
          fontFamily: "'Archivo Black', sans-serif",
          color: C.text(COL.gold),
          textShadow: '0 0 40px rgba(255,215,0,0.3), 0 20px 40px rgba(0,0,0,0.8)',
          letterSpacing: '5px'
        }}>
          {f.texte || 'LA SPÉCIALE'}
        </div>
      </div>
    </Box>
  );
}

// 11. FinMerci
function FinMerci({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slower animations
  // Banner slides gently
  const bannerY = interpolate(spring({ frame, fps, config: { damping: 20, stiffness: 60 } }), [0, 1], [200, 0]);
  
  // Text fades in
  const textOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  // ALWM TV logo appears last
  const logoOpacity = interpolate(frame, [70, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoScale = interpolate(spring({ frame: Math.max(0, frame - 70), fps, config: { damping: 12 } }), [0, 1], [0.8, 1]);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080 }}>
      <div style={{ 
        width: 1920, height: 1080, 
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
        paddingBottom: 100
      }}>
        <div style={{
          transform: `translateY(${bannerY}px)`,
          background: C.bg('rgba(0,0,0,0.85)'),
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 0',
          borderTop: `2px solid ${C.accent(COL.gold)}`
        }}>
          <div style={{
            opacity: textOpacity,
            fontSize: 60,
            fontFamily: ff(overlay.font, "'Montserrat Medium', sans-serif"),
            fontWeight: 500,
            color: C.text(COL.white),
            letterSpacing: '4px'
          }}>
            {f.texte || 'MERCI DE NOUS AVOIR SUIVIS'}
          </div>
          
          <div style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            marginTop: 30,
            display: 'flex',
            justifyContent: 'center'
          }}>
            <Img src={staticFile('images/alwm-logo.png')} style={{ width: 400, objectFit: 'contain' }} />
          </div>
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
