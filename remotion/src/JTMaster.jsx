import React from 'react';
import { AbsoluteFill, Series, OffthreadVideo, Video, Audio, Sequence, useCurrentFrame, useVideoConfig, getRemotionEnvironment, Img, interpolate } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { whipPan, glitchCut, rgbSplit, lightSweep, flashWhite, voletAntenne, lames, zoomRapide, rideau } from './transitions.jsx';
import { loadFonts, FPS } from './theme.js';
import { Overlay } from './overlays/index.jsx';
import { Antenne } from './overlays/paquet.jsx';
import { Ticker, LiveBadge, Logo, Subtitles } from './global.jsx';
import { Vignette, Grain, LightSweep } from './atmosphere.jsx';
import { Stage } from './Stage.jsx';
import { dureeHabillage } from './mouvement.js';
import { dureeSon, gainSousVoix, plagesSousVoix } from './pisteAudio.js';

loadFonts();

const secToFrames = (s, fps) => {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.round(n * fps));
};

// Une transition doit rester strictement plus courte que la moitié de chacun
// des deux plans. Cette fonction est partagée par le rendu et le calcul de la
// durée totale afin que le Player, la règle et l'export ne divergent jamais.
export function effectiveTransitionFrames(clip, nextClip, fps = FPS) {
  if (!clip?.transition || !nextClip) return 0;
  const currentFrames = secToFrames(clip.durationSec, fps);
  const nextFrames = secToFrames(nextClip.durationSec, fps);
  const requested = secToFrames(clip.transition.duration || 0.5, fps);
  const maximum = Math.max(1, Math.min(Math.floor(currentFrames / 2), Math.floor(nextFrames / 2)) - 1);
  return Math.min(requested, maximum);
}

// Mappe notre type de transition (xfade) → presentation Remotion.
function presentation(type) {
  if (!type) return null;
  if (type === 'volet_antenne') return voletAntenne();
  if (type === 'lames') return lames();
  if (type === 'zoom_rapide') return zoomRapide();
  if (type === 'rideau') return rideau();
  if (type === 'whippan') return whipPan();
  if (type === 'glitch') return glitchCut();
  if (type === 'rgbsplit') return rgbSplit();
  if (type === 'lightsweep') return lightSweep();
  if (type === 'flashwhite' || type === 'fadewhite') return flashWhite();
  if (type.startsWith('slide')) {
    const dir = type.includes('left') ? 'from-right' : type.includes('right') ? 'from-left' : type.includes('up') ? 'from-bottom' : 'from-top';
    return slide({ direction: dir });
  }
  if (type.startsWith('wipe')) {
    const dir = type.includes('left') ? 'from-right' : type.includes('right') ? 'from-left' : type.includes('up') ? 'from-bottom' : 'from-top';
    return wipe({ direction: dir });
  }
  return fade();
}

// Couche sous-titres d'un clip (temps local au clip).
function ClipLayer({ clip }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Le champ du studio annonce « vide = toute la vidéo ». Il valait 99 999
  // images, soit 55 minutes : le test `frame > durationInFrames - 30` était
  // alors faux en permanence et **la sortie ne se jouait jamais** — le bandeau
  // était coupé net à la fin du plan. Un habillage sans durée hérite donc de
  // ce qui reste de son plan, et sa sortie retrouve un sens.
  const dureePlan = Math.max(1, secToFrames(clip.durationSec, fps));
  return (
    <AbsoluteFill>
      <Subtitles subtitles={clip.subtitles} style={clip.subtitleStyle} clipTimeSec={(clip.inPoint || 0) + frame / fps} />
      {clip.overlays && clip.overlays.map((o, i) => {
        const start = Math.max(0, secToFrames(o.startTime || 0, fps));
        const dur = dureeHabillage(o.duration && secToFrames(o.duration, fps), dureePlan, start);
        return (
          <Sequence key={o.id || `cl-o-${i}`} from={start} durationInFrames={dur} layout="none">
            <Overlay overlay={o} durationInFrames={dur} fps={fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export function GlobalTimelineOverlays({ timelineOverlays }) {
  // `durationInFrames` est bien celle du montage : cette couche n'est pas
  // enveloppée dans une `<Sequence>` — `Stage` n'est qu'un `AbsoluteFill` mis
  // à l'échelle. Sans elle, l'habillage global n'avait pas de sortie non plus.
  const { fps, durationInFrames: dureeMontage } = useVideoConfig();
  if (!timelineOverlays || timelineOverlays.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <Stage>
        {timelineOverlays.map((o, i) => {
          const start = Math.max(0, secToFrames(o.startTime || 0, fps));
          const dur = dureeHabillage(o.duration && secToFrames(o.duration, fps), dureeMontage, start);
          return (
            <Sequence key={o.id || `glo-${i}`} from={start} durationInFrames={dur} layout="none">
              <Overlay overlay={o} durationInFrames={dur} fps={fps} />
            </Sequence>
          );
        })}
      </Stage>
    </AbsoluteFill>
  );
}

export function ImageOverlays({ imageOverlays }) {
  const { fps, durationInFrames: dureeMontage } = useVideoConfig();
  if (!imageOverlays || imageOverlays.length === 0) return null;
  const OVERLAY_POS = {
    tl: { left: '34px', top: '34px' },
    tr: { right: '34px', top: '34px' },
    bl: { left: '34px', bottom: '34px' },
    br: { right: '34px', bottom: '104px' },
    center: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <Stage>
        {imageOverlays.map((o, i) => {
          const start = Math.max(0, secToFrames(o.startTime || 0, fps));
          const dur = dureeHabillage(o.duration && secToFrames(o.duration, fps), dureeMontage, start);
          const scale = Math.min(1, Math.max(0.05, Number(o.scale) || 0.25));
          const posStyle = (o.position && typeof o.position === 'object')
            ? { left: `${Math.round(Number(o.position.x) || 0)}px`, top: `${Math.round(Number(o.position.y) || 0)}px` }
            : (OVERLAY_POS[o.position] || OVERLAY_POS.tr);
            
          const style = {
            position: 'absolute',
            width: `${Math.round(scale * 100)}%`,
            objectFit: 'contain',
            opacity: o.opacity != null ? Math.min(1, Math.max(0, Number(o.opacity))) : 1,
            pointerEvents: 'auto',
            ...posStyle
          };
          return (
            <Sequence key={o.id || `img-o-${i}`} from={start} durationInFrames={dur} layout="none">
              <Img src={o.url} style={style} crossOrigin="anonymous" />
            </Sequence>
          );
        })}
      </Stage>
    </AbsoluteFill>
  );
}

// `debut` : l'image du JT où ce plan commence. `plages` : les voix off qui
// demandent qu'on baisse son son (secondes du JT).
function ClipVideo({ clip, debut = 0, plages = [] }) {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const hasExtraAudio = false; 
  // Sous une voix off, le son du plan baisse en douceur puis revient.
  const volume = plages.length > 0 ? (f) => gainSousVoix((debut + f) / fps, plages) : 1;
  const isRendering = getRemotionEnvironment().isRendering;
  const isImage = clip.url && /\.(jpe?g|png|webp|gif|bmp)$/i.test(clip.url);
  
  const kbScale = interpolate(
    frame,
    [0, Math.max(1, secToFrames(clip.durationSec, fps))],
    clip.kenBurns?.mode === 'in' ? [1, 1.15] : clip.kenBurns?.mode === 'out' ? [1.15, 1] : [1, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const videoStyle = { width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${kbScale})` };
  
  if (!clip.url) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000' }}>
        <ClipLayer clip={clip} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {isImage ? (
        <Img src={clip.url} style={videoStyle} crossOrigin="anonymous" />
      ) : isRendering ? (
        <OffthreadVideo
          src={clip.url}
          startFrom={secToFrames(clip.inPoint || 0, fps)}
          muted={hasExtraAudio}
          volume={volume}
          style={videoStyle}
          crossOrigin="anonymous"
        />
      ) : (
        <Video
          src={clip.url}
          startFrom={secToFrames(clip.inPoint || 0, fps)}
          muted={hasExtraAudio}
          volume={volume}
          style={videoStyle}
          crossOrigin="anonymous"
        />
      )}
      <ClipLayer clip={clip} />
    </AbsoluteFill>
  );
}

export function JTMaster({ clips = [], branding = {}, music, voiceover, timelineOverlays = [], imageOverlays = [], audio = [] }) {
  const fps = FPS;
  const list = clips.length ? clips : [{ url: '', durationSec: 1, overlays: [] }];
  const sons = Array.isArray(audio) ? audio : [];
  const plages = plagesSousVoix(sons);
  // L'image où commence chaque plan : sa durée moins le chevauchement de la
  // transition qui le précède, comme `totalDurationInFrames`.
  const departs = [];
  list.reduce((curseur, clip, i) => {
    departs.push(curseur);
    return curseur + secToFrames(clip.durationSec, fps) - effectiveTransitionFrames(clip, list[i + 1], fps);
  }, 0);
  const tickerOn = !!(branding.ticker && branding.ticker.enabled);
  // Ce qui occupe déjà l'image : les habillages s'en écartent d'eux-mêmes.
  const antenne = {
    logo: branding.logo ? ({ tl: 'haut-gauche', tr: 'haut-droite', bl: 'bas-gauche', br: 'bas-droite' }[branding.logoPosition || 'br'] || null) : null,
    direct: !!(branding.live && branding.live.enabled),
    defilant: tickerOn && !!branding.ticker.texte,
  };

  return (
    <Antenne.Provider value={antenne}>
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <TransitionSeries>
        {list.flatMap((clip, i) => {
          const dur = secToFrames(clip.durationSec, fps);
          const seq = (
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={dur}>
              <ClipVideo clip={clip} debut={departs[i]} plages={plages} />
            </TransitionSeries.Sequence>
          );
          // Une transition Remotion exige une durée < moitié de chaque
          // sequence adjacente (sinon TransitionSeries throw "transition
          // duration ≥ sequence duration" → master crash). On cappe.
          let tr = null;
          if (clip.transition && i < list.length - 1) {
            const next = list[i + 1];
            const trFrames = effectiveTransitionFrames(clip, next, fps);
            tr = (
              <TransitionSeries.Transition
                key={`t${i}`}
                presentation={presentation(clip.transition.type)}
                timing={linearTiming({ durationInFrames: trFrames })}
              />
            );
          }
          return tr ? [seq, tr] : [seq];
        })}
      </TransitionSeries>

      <GlobalTimelineOverlays timelineOverlays={timelineOverlays} />
      <ImageOverlays imageOverlays={imageOverlays} />

      {/* Atmosphère cinéma (sous l'habillage, au-dessus des clips). */}
      {branding.atmosphere && (
        <Stage>
          <Vignette strength={branding.atmosphere.vignette} />
          <Grain strength={branding.atmosphere.grain} />
          <LightSweep strength={branding.atmosphere.sweep} fps={fps} />
        </Stage>
      )}

      {/* Habillage global au-dessus de tout, durée totale */}
      <Stage>
        <Ticker ticker={branding.ticker} />
        <LiveBadge live={branding.live} />
        <Logo 
          logo={branding.logo} 
          logoPosition={branding.logoPosition} 
          logoPosX={branding.logoPosX} 
          logoPosY={branding.logoPosY} 
          logoScale={branding.logoScale}
          tickerOn={tickerOn}
        />
        {/* Les overlays globaux texte sont rendus via <GlobalTimelineOverlays>
            au-dessus. branding.overlays serait toujours vide post-fix
            buildRemotionPayload — on évite la passe duplicate qui doublait
            l'habillage si jamais un consommateur peuplait les deux. */}
      </Stage>

      {/* Mix audio (en plus de l'audio des clips) */}
      {music && music.filename && music.url && (
        <Audio
          src={music.url}
          volume={(() => {
            const nVol = Number(music.volume);
            const base = music.volume != null ? (isNaN(nVol) ? 0.2 : nVol) : 0.2;
            if (!music.duck) return base;
            // La musique baisse pendant les voix off de la piste son, et
            // seulement pendant. L'ancienne voix off unique la baissait d'un
            // bout à l'autre du JT.
            if (plages.length > 0) return (f) => base * gainSousVoix(f / fps, plages, { attenuation: 0.35 });
            return voiceover && voiceover.filename ? base * 0.35 : base;
          })()}
          loop
          crossOrigin="anonymous"
        />
      )}
      {/* La piste son : chaque son à sa place, rogné, à son volume. */}
      {sons.map((son, i) => {
        const duree = dureeSon(son);
        if (!son.url || duree <= 0) return null;
        return (
          <Sequence key={son.id || `son-${i}`} from={secToFrames(son.startTime || 0, fps)} durationInFrames={Math.max(1, secToFrames(duree, fps))} layout="none">
            <Audio src={son.url} startFrom={secToFrames(son.inPoint || 0, fps)} volume={son.volume ?? 1} crossOrigin="anonymous" />
          </Sequence>
        );
      })}
      {voiceover && voiceover.filename && voiceover.url && (
        <Sequence from={secToFrames(Number.isFinite(Number(voiceover.startTime)) ? Math.max(0, Number(voiceover.startTime)) : 0, fps)}>
          <Audio src={voiceover.url} volume={voiceover.volume != null ? (isNaN(Number(voiceover.volume)) ? 1 : Number(voiceover.volume)) : 1} crossOrigin="anonymous" />
        </Sequence>
      )}
    </AbsoluteFill>
    </Antenne.Provider>
  );
}

// Durée totale = somme des clips − chevauchements de transitions.
export function totalDurationInFrames(clips = [], fps = FPS) {
  let total = 0;
  clips.forEach((c, i) => {
    total += secToFrames(c.durationSec, fps);
    total -= effectiveTransitionFrames(c, clips[i + 1], fps);
  });
  return Math.max(1, total);
}
