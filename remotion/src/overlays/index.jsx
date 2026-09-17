import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from 'remotion';
import { COULEURS, PILES, varPolice } from '../identite.js';
import TexteJT, { FournisseurHabillage } from '../TexteJT.jsx';
import { COL, ff, pickColors, DEFAULT_ANCHOR } from '../theme.js';
import { WorldMap } from '../worldmap.jsx';
import { BackdropALWM, DoveFlyThrough, eo } from '../broadcast.jsx';
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
// Ces trois constantes doublaient la palette de theme.js avec des valeurs
// différentes : un même bleu ALWM sortait en #0046C0 ici et en #0057D9 là.
// Elles pointent maintenant sur la charte (identite.js).
const NAVY = COULEURS.encre;      // texte foncé sur cartouche clair
const ELEC = COULEURS.structure;  // libellé, contraste tenu sur fond clair

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
          color: COL.white, fontFamily: ff(ffont, PILES.titrage), fontSize: 24, letterSpacing: '0.04em'
        }}>
          ALWM TV
        </div>
        {/* Panneau droit (bg) : catégorie (accent) + corps (text) */}
        <div style={{
          background: cBg, padding: '14px 40px 14px 32px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1,
          opacity: contentOp, transform: `translateY(${contentY}px)`,
        }}>
          {/* Décalage de 5 images : celui du ressort qui fait entrer ce
              panneau. « ALWM TV », au-dessus, est codé en dur et reste hors
              de l'animation de texte — ce n'est pas une saisie du monteur. */}
          <TexteJT role="courant" delai={5} style={{ fontFamily: ff(ffont, PILES.courant), fontWeight: 800, fontSize: `${fs * 22}px`, color: cAccent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{categorie}</TexteJT>
          <TexteJT role="titrage" delai={5} style={{ fontFamily: ff(ffont, PILES.titrage), fontSize: `${fs * 36}px`, color: cText, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{corps}</TexteJT>
        </div>
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
  const fontB = ff(overlay.font, PILES.titrage);
  const fontM = ff(overlay.font, PILES.courant);
  // Personnalisable : bg = bandeau titre, text = titre, accent = chevron +
  // sous-titre. Défauts = charte (navy / blanc / bleu).
  const cBand = C.bg(COL.band);
  const cTitle = C.text(COL.white);
  const cAccent = C.accent(COL.blue);

  return (
    <Box overlay={overlay} style={{ left: 110, top: 820, width: 1300, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {/* Bandeau titre */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <Para bg={cBand} reveal={reveal} padding="0" style={{ boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }}>
          <TexteJT role="titrage" style={{
            padding: '18px 56px 18px 48px',
            fontFamily: fontB, fontWeight: 800,
            fontSize: `${fs * 50}px`, color: cTitle,
            textTransform: 'uppercase', letterSpacing: '0.01em', whiteSpace: 'nowrap',
          }}>{f.titre || f.sujet || f.title || 'LE TITRE DU REPORTAGE'}</TexteJT>
        </Para>
        {/* accent diagonal */}
        <div style={{ opacity: reveal > 0.7 ? 1 : 0, transition: 'opacity .2s' }}>
          <AccentSlash height={Math.round(fs * 50 + 36)} color={cAccent} />
        </div>
      </div>
      {/* Sous-titre : fond blanc, texte accent + petit carré accent à gauche */}
      <div style={{ display: 'flex', alignItems: 'stretch', marginTop: 6, marginLeft: 18 }}>
        <div style={{ width: 14, background: cAccent, clipPath: `polygon(${SLANT * 0.5}px 0,100% 0,calc(100% - ${SLANT * 0.5}px) 100%,0 100%)` }} />
        {/* `subSp` est le ressort d'ENTRÉE : le bandeau titre au-dessus se
            refermait (`reveal`) pendant que celui-ci restait plein. Il lui
            faut la même variable de révélation, décalée de ses six images. */}
        <Para bg={COL.white} reveal={isOut ? 1 - outSp : subSp} padding="0" style={{ boxShadow: '0 10px 24px rgba(0,0,0,0.2)' }}>
          {/* Le décalage reprend celui du ressort qui révèle ce bandeau
              (`subSp`, 6 images) : sans lui, le texte s'animerait derrière un
              masque encore fermé. */}
          <TexteJT role="courant" delai={6} style={{
            padding: '8px 40px 8px 28px',
            fontFamily: fontM, fontWeight: 600,
            fontSize: `${fs * 26}px`, color: cAccent,
            textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
          }}>{f.subtitle || f.sous_titre || 'UN SOUS-TITRE OU PRÉCISION'}</TexteJT>
        </Para>
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
        <TexteJT as="span" role="titrage" delai={listStart - 6} style={{
          fontFamily: ff(null, PILES.titrage), fontWeight: 800, fontSize: 64, color: C.text(COL.white),
          textTransform: 'uppercase', letterSpacing: '0.06em',
          borderBottom: `4px solid ${C.accent(COL.blue)}`, paddingBottom: 14,
        }}>{f.titre || 'RAPPEL DES TITRES'}</TexteJT>
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
              <TexteJT as="span" role="courant" delai={delay} style={{
                color: C.text(COL.white), fontSize: 42, fontFamily: ff(null, PILES.courant), fontWeight: 500, lineHeight: 1.2,
              }}>{titre}</TexteJT>
            </div>
          );
        })}
      </div>
    </Box>
  );
}
function FlashInfo({ overlay, durationInFrames }) {
  const f = overlay.fields || {};
  const C = pickColors(overlay);
  const frame = useCurrentFrame();
  // Il recevait `durationInFrames` et ne le lisait jamais : le cartouche
  // restait plein jusqu'à la coupe. Sa sortie est la symétrique de son
  // entrée — il remonte et s'efface sur les douze dernières images.
  const SORTIE = 12;
  const debutSortie = durationInFrames - SORTIE;
  const sortie = frame > debutSortie
    ? interpolate(frame - debutSortie, [0, SORTIE], [0, 1], { extrapolateRight: 'clamp' })
    : 0;
  const y = interpolate(frame, [0, 15], [-20, 0], { extrapolateRight: 'clamp' }) - sortie * 20;
  const op = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }) * (1 - sortie);
  return (
    <Box overlay={overlay} style={{ left: 80, top: 80, opacity: op, transform: `translateY(${y}px)` }}>
      <div style={{ width: 340, height: 80, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
        <TexteJT role="titrage" style={{ background: C.bg(COL.blue), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text(COL.white), fontFamily: ff(null, PILES.titrage), fontWeight: 800, fontSize: 24, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{f.titre || 'FLASH'}</TexteJT>
        <TexteJT role="courant" delai={6} style={{ background: C.accent(COL.white), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text(COL.black), fontFamily: ff(null, PILES.titrage), fontWeight: 800, fontSize: 24, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{f.texte || 'INFO'}</TexteJT>
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
  const fontB = ff(overlay.font, PILES.titrage);
  // Flash bleu d'entrée ~200 ms.
  const flash = eo(frame, [0, fps * 0.2, fps * 0.45], [1, 0.5, 0]);
  const titleScale = eo(frame, [fps * 0.1, fps * 0.9], [1.05, 1]);
  const titleOp = eo(frame, [fps * 0.1, fps * 0.6], [0, 1]);
  // Lui aussi recevait sa durée sans jamais la lire : l'alerte plein écran
  // était coupée net. Elle s'efface maintenant sur une demi-seconde.
  const SORTIE = Math.round(fps * 0.5);
  const debutSortie = durationInFrames - SORTIE;
  const sortie = frame > debutSortie
    ? interpolate(frame - debutSortie, [0, SORTIE], [0, 1], { extrapolateRight: 'clamp' })
    : 0;
  // Marquee bas (continu, ~120 px/s).
  const marqueeText = `${subtitle}   •   `.repeat(8);
  const mx = -((frame * (120 / fps)) % 1600);
  const fs = (overlay.fontSize || 100) / 100;

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 1 - sortie, transform: `scale(${1 - sortie * 0.04})` }}>
      <BackdropALWM globeOpacity={0.16} />
      {/* Lueur centrale */}
      <div style={{ position: 'absolute', width: 1100, height: 360, background: 'radial-gradient(ellipse, rgba(0,87,217,0.45) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      <TexteJT role="titrage" delai={Math.round(fps * 0.1)} style={{
        position: 'relative', zIndex: 3, transform: `scale(${titleScale})`, opacity: titleOp,
        fontFamily: fontB, fontWeight: 800, fontSize: `${fs * 130}px`, color: C.text(COL.white),
        textTransform: 'uppercase', letterSpacing: '0.02em', textShadow: '0 14px 40px rgba(0,0,0,0.6)',
      }}>{title}</TexteJT>
      {/* Bandeau marquee bas. Il reste hors du moteur d'animation : son
          défilement EST son mouvement, et le découper lettre par lettre
          produirait plusieurs centaines de <span> pour un texte répété seize
          fois. Le titre au-dessus porte le mouvement choisi par le monteur. */}
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
  const fontM = ff(overlay.font, PILES.courant);
  const fontB = ff(overlay.font, PILES.titrage);

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: globalOut }}>
      <BackdropALWM />
      <DoveFlyThrough fromF={doveFrom} toF={doveTo} y={30} size={240} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 50 }}>
        <TexteJT role="titrage" delai={Math.round(fps * 1.0)} style={{
          opacity: textOp,
          fontSize: `${fs * 56}px`, fontFamily: fontM, fontWeight: 500,
          color: C.colorTextMain || COL.white, letterSpacing: '0.02em',
          textShadow: '0 10px 24px rgba(0,0,0,0.5)',
        }}>
          {f.titre || f.texte || 'Merci de votre fidélité'}
        </TexteJT>
        <div style={{ width: 2, height: 90, background: C.colorAccent || 'rgba(74,163,255,0.5)', opacity: logoOp }} />
        <div style={{ opacity: logoOp, transform: `scale(${logoScale})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {/* Version fond sombre : le bloc-marque officiel est dessine pour
              un fond clair et arriverait ici dans sa carte blanche. */}
          <Img src={staticFile('images/alwm-logo-sombre.png')} style={{ width: 320, objectFit: 'contain', filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.6))' }} />
          <TexteJT role="courant" delai={Math.round(fps * 2.4)} style={{ fontFamily: fontM, fontWeight: 500, fontSize: `${fs * 22}px`, color: C.colorTextAccent || COL.light, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {f.sous_titre || "L'ACTUALITÉ EN CONTINU"}
          </TexteJT>
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
  const fontXB = ff(overlay.font, PILES.titrage);
  const fontM = ff(overlay.font, PILES.courant);
  const words = (f.mots && String(f.mots).trim())
    ? String(f.mots).split(/[•,\n]+/).map((w) => w.trim()).filter(Boolean)
    : ['ACTUALITÉ', 'POLITIQUE', 'ÉCONOMIE', 'SPORT', 'CULTURE', 'MONDE'];

  // Globe : apparaît séq.2, reste ensuite.
  const globeOp = eo(frame, [s1, s2], [0, 0.35]);
  // Logo + LE JOURNAL : séq.4.
  const logoOp = eo(frame, [s3, s3 + fps * 0.5], [0, 1]);
  const logoScale = eo(frame, [s3, s3 + fps * 0.8], [0.92, 1]);
  // Garde-fous monotonie : si D est court (overlay user posé sur < 3 s),
  // s3 + fps*0.6 dépasserait D - fps*0.3 → inputRange non monotone →
  // crash renderMedia. On force chaque borne droite à être > gauche.
  const jtOpStart = s3 + fps * 0.6;
  const jtOp = eo(frame, [jtOpStart, Math.max(jtOpStart + 1, D - fps * 0.3)], [0, 1]);
  const jtScale = eo(frame, [jtOpStart, Math.max(jtOpStart + 1, D)], [0.95, 1]);
  const fadeOutStart = Math.max(0, D - fps * 0.4);
  const fadeOut = eo(frame, [fadeOutStart, Math.max(fadeOutStart + 1, D)], [1, 0]);

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
              const step = Math.max(1, (s3 - s2) / Math.max(1, words.length));
              const wf = frame - (s2 + i * step);
              // Fenêtre de fondu (in 0→6, plateau, out sur step). Si `step`
              // est court (< 12 : intro brève ou beaucoup de mots-clés),
              // `step - 4` passerait sous 6 → inputRange non monotone →
              // crash renderMedia ("inputRange must be monotonically
              // increasing"). On bascule alors sur un fondu triangulaire.
              const op = step >= 12
                ? interpolate(wf, [0, 6, step - 4, step], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
                : interpolate(wf, [0, step / 2, step], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              if (op <= 0) return null;
              const y = eo(wf, [0, 8], [40, 0]);
              return <TexteJT key={i} role="titrage" delai={s2 + i * step} style={{ position: 'absolute', inset: 0, textAlign: 'center', opacity: op, transform: `translateY(${y}px)`, fontFamily: fontXB, fontWeight: 800, fontSize: 88, color: C.text(COL.white), letterSpacing: '0.04em', lineHeight: '120px', textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>{w}</TexteJT>;
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* Séq.4 : colombe traverse + logo + LE JOURNAL */}
      <DoveFlyThrough fromF={s3} toF={s3 + fps * 1.6} y={28} size={240} />
      {frame >= s3 && (
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          <Img src={staticFile('images/alwm-logo-sombre.png')} style={{ width: 460, objectFit: 'contain', opacity: logoOp, transform: `scale(${logoScale})`, filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.6))' }} />
          <TexteJT role="titrage" delai={jtOpStart} style={{ opacity: jtOp, transform: `scale(${jtScale})`, fontFamily: fontXB, fontWeight: 800, fontSize: 84, color: C.text(COL.white), letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {f.titre || 'LE JOURNAL'}
          </TexteJT>
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
  
  // Globe Zoom lent (scale from 1 to 1.1). Garde-fou inputRange : si le
  // parent envoyait durationInFrames <= 0, [0, 0] crasherait renderMedia.
  const globeZoom = interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, opacity: isOut ? outOpacity : 1 }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${globeZoom})`, transformOrigin: 'center center' }}>
        <BackdropALWM darker={true} lines={false} globeOpacity={0.25} />
      </div>
      
      <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <TexteJT role="titrage" style={{ 
          opacity: titleOpacity, 
          transform: `scale(${titleScale})`,
          fontFamily: ff(overlay.font, PILES.titrage),
          fontWeight: 800,
          fontSize: 100,
          color: C.text(COL.white),
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textShadow: '0 10px 30px rgba(0,0,0,0.8)'
        }}>
          {f.titre || f.texte || 'REPORTAGE'}
        </TexteJT>
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
    // La variable est TOUJOURS définie, même sans choix de police, et sa
    // valeur ne porte pas de virgule finale : elle en portait une, ce qui
    // insérait une famille vide dans la déclaration des gabarits et la rendait
    // invalide — les quinze habillages sortaient alors dans la serif par
    // défaut du navigateur. Les deux moitiés vivent maintenant dans
    // `identite.js`, côte à côte, et un test les compose.
    const fontVar = varPolice(overlay);
    return (
      <FournisseurHabillage overlay={overlay} durationInFrames={durationInFrames}>
        <Box overlay={overlay} style={{ left: 0, top: 0, width: 1920, height: 1080, ...fontVar }}>
          <Comp overlay={merged} durationInFrames={durationInFrames} />
        </Box>
      </FournisseurHabillage>
    );
  }

  // Composants natifs ALWM : Box + pickColors déjà intégrés en interne.
  // Le fournisseur enveloppe les deux branches : c'est le seul point de passage
  // commun, et il évite d'enfiler trois propriétés à travers 23 gabarits pour
  // qu'une ligne de texte connaisse la durée de son habillage.
  return (
    <FournisseurHabillage overlay={overlay} durationInFrames={durationInFrames}>
      <Comp overlay={overlay} durationInFrames={durationInFrames} />
    </FournisseurHabillage>
  );
}
