import React from 'react';
import { AbsoluteFill, Series, OffthreadVideo, Audio, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
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

const secToFrames = (s, fps) => Math.max(1, Math.round((s || 0) * fps));

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

// Couche overlays + sous-titres d'un clip (temps local au clip).
function ClipLayer({ clip }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const overlays = clip.overlays || [];
  return (
    <AbsoluteFill>
      <Stage>
        {overlays.map((o, i) => {
          const start = secToFrames(o.startTime || 0, fps);
          const clipDur = secToFrames(clip.durationSec || 5, fps);
          const dur = o.duration != null ? secToFrames(o.duration, fps) : clipDur - start;
          const finalDur = Math.max(1, Math.min(dur, clipDur - start));
          return (
            <Sequence key={o.id || i} from={start} durationInFrames={finalDur} layout="none">
              <Overlay overlay={o} durationInFrames={finalDur} />
            </Sequence>
          );
        })}
      </Stage>
      <Subtitles subtitles={clip.subtitles} style={clip.subtitleStyle} clipTimeSec={(clip.inPoint || 0) + frame / fps} />
    </AbsoluteFill>
  );
}

function ClipVideo({ clip }) {
  const { fps } = useVideoConfig();
  const hasExtraAudio = false; // l'audio du clip reste actif ; mix musique/voix par-dessus
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <OffthreadVideo
        src={clip.url}
        startFrom={secToFrames(clip.inPoint || 0, fps)}
        muted={hasExtraAudio}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <ClipLayer clip={clip} />
    </AbsoluteFill>
  );
}

export function JTMaster({ clips = [], branding = {}, music, voiceover }) {
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
        <Logo logo={branding.logo} logoPosition={branding.logoPosition} tickerOn={tickerOn} />
      </Stage>

      {/* Mix audio (en plus de l'audio des clips) */}
      {music && music.filename && music.url && (
        <Audio
          src={music.url}
          volume={(() => {
            const base = music.volume != null ? Number(music.volume) : 0.2;
            // Ducking : si voix-off présente, on baisse la musique (approx du
            // sidechain ; pas de vrai keying dans le chemin Remotion).
            const ducked = music.duck && voiceover && voiceover.filename ? base * 0.35 : base;
            return ducked;
          })()}
          loop
        />
      )}
      {voiceover && voiceover.filename && voiceover.url && (
        <Sequence from={secToFrames(voiceover.startTime || 0, fps)}>
          <Audio src={voiceover.url} volume={voiceover.volume != null ? Number(voiceover.volume) : 1} />
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
