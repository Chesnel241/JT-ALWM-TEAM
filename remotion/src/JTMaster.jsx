import React from 'react';
import { AbsoluteFill, Series, OffthreadVideo, Video, Audio, Sequence, useCurrentFrame, useVideoConfig, getRemotionEnvironment, Img, interpolate } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { whipPan, glitchCut, rgbSplit, lightSweep, flashWhite } from './transitions.jsx';
import { loadFonts, FPS } from './theme.js';
import { Overlay } from './overlays/index.jsx';
import { Ticker, LiveBadge, Logo, Subtitles } from './global.jsx';
import { Vignette, Grain, LightSweep } from './atmosphere.jsx';
import { Stage } from './Stage.jsx';

loadFonts();

const secToFrames = (s, fps) => {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.round(n * fps));
};

// Mappe notre type de transition (xfade) → presentation Remotion.
function presentation(type) {
  if (!type) return null;
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
  return (
    <AbsoluteFill>
      <Subtitles subtitles={clip.subtitles} style={clip.subtitleStyle} clipTimeSec={(clip.inPoint || 0) + frame / fps} />
      {clip.overlays && clip.overlays.map((o, i) => {
        const start = Math.max(0, secToFrames(o.startTime || 0, fps));
        const dur = o.duration ? Math.max(1, secToFrames(o.duration, fps)) : 99999;
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
  const { fps } = useVideoConfig();
  if (!timelineOverlays || timelineOverlays.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <Stage>
        {timelineOverlays.map((o, i) => {
          const start = Math.max(0, secToFrames(o.startTime || 0, fps));
          const dur = o.duration ? Math.max(1, secToFrames(o.duration, fps)) : 99999;
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
  const { fps } = useVideoConfig();
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
          const dur = o.duration ? Math.max(1, secToFrames(o.duration, fps)) : 99999;
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

function ClipVideo({ clip }) {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const hasExtraAudio = false; 
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
          style={videoStyle}
        />
      ) : (
        <Video
          src={clip.url}
          startFrom={secToFrames(clip.inPoint || 0, fps)}
          muted={hasExtraAudio}
          style={videoStyle}
          crossOrigin="anonymous"
        />
      )}
      <ClipLayer clip={clip} />
    </AbsoluteFill>
  );
}

export function JTMaster({ clips = [], branding = {}, music, voiceover, timelineOverlays = [], imageOverlays = [] }) {
  const fps = FPS;
  const list = clips.length ? clips : [{ url: '', durationSec: 1, overlays: [] }];
  const tickerOn = !!(branding.ticker && branding.ticker.enabled);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <TransitionSeries>
        {list.flatMap((clip, i) => {
          const dur = secToFrames(clip.durationSec, fps);
          const seq = (
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={dur}>
              <ClipVideo clip={clip} />
            </TransitionSeries.Sequence>
          );
          const tr = clip.transition && i < list.length - 1
            ? (
              <TransitionSeries.Transition
                key={`t${i}`}
                presentation={presentation(clip.transition.type)}
                timing={linearTiming({ durationInFrames: secToFrames(clip.transition.duration || 0.5, fps) })}
              />
            )
            : null;
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
            // Ducking : si voix-off présente, on baisse la musique (approx du
            // sidechain ; pas de vrai keying dans le chemin Remotion).
            const ducked = music.duck && voiceover && voiceover.filename ? base * 0.35 : base;
            return ducked;
          })()}
          loop
          crossOrigin="anonymous"
        />
      )}
      {voiceover && voiceover.filename && voiceover.url && (
        <Sequence from={secToFrames(Number.isFinite(Number(voiceover.startTime)) ? Math.max(0, Number(voiceover.startTime)) : 0, fps)}>
          <Audio src={voiceover.url} volume={voiceover.volume != null ? (isNaN(Number(voiceover.volume)) ? 1 : Number(voiceover.volume)) : 1} crossOrigin="anonymous" />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

// Durée totale = somme des clips − chevauchements de transitions.
export function totalDurationInFrames(clips = [], fps = FPS) {
  let total = 0;
  clips.forEach((c, i) => {
    total += secToFrames(c.durationSec, fps);
    if (c.transition && i < clips.length - 1) total -= secToFrames(c.transition.duration || 0.5, fps);
  });
  return Math.max(1, total);
}
