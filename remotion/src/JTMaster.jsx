import React from 'react';
import { AbsoluteFill, Series, OffthreadVideo, Video, Audio, Sequence, useCurrentFrame, useVideoConfig, getRemotionEnvironment } from 'remotion';
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
  return Math.max(1, Math.round((isNaN(n) ? 0 : n) * fps));
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

function ClipVideo({ clip }) {
  const { fps } = useVideoConfig();
  const hasExtraAudio = false; // l'audio du clip reste actif ; mix musique/voix par-dessus
  // Composant vidéo selon l'environnement :
  // - rendu worker (renderMedia) → OffthreadVideo : fetch/seek hors-thread,
  //   bien moins de RAM/CPU, pas de frames noires/désync.
  // - aperçu navigateur (@remotion/player) → Video : OffthreadVideo n'a pas
  //   de serveur d'extraction de frames côté client et rend un écran noir.
  //   crossOrigin requis pour que le <video> charge l'URL same-origin/CORS.
  const isRendering = getRemotionEnvironment().isRendering;
  const videoStyle = { width: '100%', height: '100%', objectFit: 'contain' };
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {isRendering ? (
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

export function JTMaster({ clips = [], branding = {}, music, voiceover, timelineOverlays = [] }) {
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
        {(branding.overlays || []).map((o, i) => {
          const fps = FPS;
          const start = Math.max(0, secToFrames(o.startTime || 0, fps));
          const dur = o.duration != null ? Math.max(1, secToFrames(o.duration, fps)) : 99999;
          return (
            <Sequence key={`g-ov-${i}`} from={start} durationInFrames={dur}>
              <Overlay overlay={o} fps={fps} clipDurationSec={Number.MAX_VALUE} />
            </Sequence>
          );
        })}
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
        <Sequence from={secToFrames(voiceover.startTime || 0, fps)}>
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
