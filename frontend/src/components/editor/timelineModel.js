export const FPS = 30;
export const MIN_CLIP_DURATION = 0.3;

const DEFAULT_CLIP_DURATION = 5;
const PRECISION = 12;

let generatedId = 0;

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanFloat = (value) => {
  const rounded = Number(value.toFixed(PRECISION));
  return Object.is(rounded, -0) ? 0 : rounded;
};

const secondsToFrames = (seconds, fps = FPS, minimum = 0) => {
  const value = finiteNumber(seconds);
  if (value === null) return minimum;
  return Math.max(minimum, Math.round(value * fps));
};

const framesToSeconds = (frames, fps = FPS) => {
  const value = frames / fps;
  return Object.is(value, -0) ? 0 : value;
};

/** Quantifie une valeur sur un pas arbitraire (une image par défaut). */
export function quantize(value, step = 1 / FPS) {
  const number = finiteNumber(value);
  const quantum = finiteNumber(step);
  if (number === null) return 0;
  if (quantum === null || quantum <= 0) return cleanFloat(number);
  return cleanFloat(Math.round(number / quantum) * quantum);
}

/** Arrondit un temps, en secondes, à l'image la plus proche. */
export function roundToFrame(seconds, fps = FPS) {
  const safeFps = finiteNumber(fps);
  const value = finiteNumber(seconds);
  const frameRate = safeFps && safeFps > 0 ? safeFps : FPS;
  if (value === null) return 0;
  return framesToSeconds(Math.round(value * frameRate), frameRate);
}

const readSourceDuration = (clip) => {
  const candidates = [
    clip?.sourceDurationSec,
    clip?.originalDurationSec,
    clip?.mediaDurationSec,
    clip?.sourceDuration,
    clip?.mediaDuration,
  ];
  for (const candidate of candidates) {
    const value = finiteNumber(candidate);
    if (value !== null && value > 0) return value;
  }
  return null;
};

/**
 * Retourne la plage source canonique d'un clip. `outPoint` est prioritaire :
 * `durationSec` ne peut ainsi jamais contredire une plage IN/OUT explicite.
 */
export function getClipRange(clip = {}, fps = FPS) {
  const safeFps = finiteNumber(fps) > 0 ? Number(fps) : FPS;
  const minFrames = Math.max(1, Math.round(MIN_CLIP_DURATION * safeFps));
  const sourceDuration = readSourceDuration(clip);
  const sourceFrames = sourceDuration === null
    ? null
    : Math.max(minFrames, secondsToFrames(sourceDuration, safeFps, 1));

  let inFrames = Math.max(0, secondsToFrames(clip.inPoint, safeFps, 0));
  if (sourceFrames !== null) inFrames = Math.min(inFrames, sourceFrames - minFrames);

  const explicitOut = finiteNumber(clip.outPoint);
  const explicitDuration = finiteNumber(clip.durationSec);
  let outFrames;

  if (explicitOut !== null) {
    outFrames = secondsToFrames(explicitOut, safeFps, 0);
  } else if (explicitDuration !== null && explicitDuration > 0) {
    outFrames = inFrames + secondsToFrames(explicitDuration, safeFps, 1);
  } else if (sourceFrames !== null) {
    outFrames = sourceFrames;
  } else {
    outFrames = inFrames + secondsToFrames(DEFAULT_CLIP_DURATION, safeFps, minFrames);
  }

  outFrames = Math.max(inFrames + minFrames, outFrames);
  if (sourceFrames !== null) {
    outFrames = Math.min(outFrames, sourceFrames);
    inFrames = Math.min(inFrames, outFrames - minFrames);
  }

  return {
    inPoint: framesToSeconds(inFrames, safeFps),
    outPoint: framesToSeconds(outFrames, safeFps),
    durationSec: framesToSeconds(outFrames - inFrames, safeFps),
    sourceDurationSec: sourceFrames === null ? null : framesToSeconds(sourceFrames, safeFps),
  };
}

export function getClipDuration(clip, fps = FPS) {
  return getClipRange(clip, fps).durationSec;
}

/**
 * Reproduit exactement le clamp de `JTMaster`: une transition reste plus
 * courte que la moitié de chacun des deux plans adjacents.
 */
export function getEffectiveTransitionDuration(clip, nextClip, fps = FPS) {
  if (!clip?.transition || !nextClip) return 0;

  const safeFps = finiteNumber(fps) > 0 ? Number(fps) : FPS;
  const durationFrames = secondsToFrames(getClipDuration(clip, safeFps), safeFps, 1);
  const nextDurationFrames = secondsToFrames(getClipDuration(nextClip, safeFps), safeFps, 1);
  const requested = clip.transition.duration || 0.5;
  const requestedFrames = secondsToFrames(requested, safeFps, 1);
  const maximumFrames = Math.max(
    1,
    Math.min(Math.floor(durationFrames / 2), Math.floor(nextDurationFrames / 2)) - 1,
  );

  return framesToSeconds(Math.min(requestedFrames, maximumFrames), safeFps);
}

/** Calcule toute la géométrie temporelle sur une unique base image. */
export function computeTimelineLayout(clips = [], fps = FPS) {
  const safeClips = Array.isArray(clips) ? clips : [];
  const safeFps = finiteNumber(fps) > 0 ? Number(fps) : FPS;
  const starts = [];
  const ends = [];
  const durations = [];
  const transitionDurations = [];
  const items = [];
  let cursorFrames = 0;

  safeClips.forEach((clip, index) => {
    const range = getClipRange(clip, safeFps);
    const durationFrames = secondsToFrames(range.durationSec, safeFps, 1);
    const transitionDuration = getEffectiveTransitionDuration(
      clip,
      safeClips[index + 1],
      safeFps,
    );
    const transitionFrames = secondsToFrames(transitionDuration, safeFps, 0);
    const start = framesToSeconds(cursorFrames, safeFps);
    const duration = framesToSeconds(durationFrames, safeFps);
    const end = framesToSeconds(cursorFrames + durationFrames, safeFps);

    starts.push(start);
    ends.push(end);
    durations.push(duration);
    transitionDurations.push(framesToSeconds(transitionFrames, safeFps));
    items.push({
      clip,
      index,
      id: clip?.instanceId || clip?.id || String(index),
      start,
      end,
      duration,
      transitionDuration: framesToSeconds(transitionFrames, safeFps),
      range,
    });

    cursorFrames += durationFrames - transitionFrames;
  });

  return {
    fps: safeFps,
    starts,
    ends,
    durations,
    transitionDurations,
    items,
    total: framesToSeconds(cursorFrames, safeFps),
    totalFrames: cursorFrames,
  };
}

/**
 * Trouve le clip sous un temps global. Dans le chevauchement d'une transition,
 * le clip entrant (le plus à droite) gagne, sauf `preferredId` explicite.
 */
export function findClipAtTime(layout, timeSec, preferredId) {
  const items = Array.isArray(layout?.items) ? layout.items : [];
  const fps = finiteNumber(layout?.fps) > 0 ? Number(layout.fps) : FPS;
  const timeFrames = secondsToFrames(timeSec, fps, 0);
  if (finiteNumber(timeSec) === null || Number(timeSec) < 0 || items.length === 0) return null;

  const preferredIndex = preferredId == null
    ? -1
    : items.findIndex((item) => String(item.id) === String(preferredId));
  if (preferredId != null && preferredIndex === -1) return null;
  const indexes = preferredIndex >= 0
    ? [preferredIndex]
    : Array.from({ length: items.length }, (_, index) => items.length - 1 - index);

  for (const index of indexes) {
    const item = layout.items[index];
    if (!item) continue;
    const startFrames = secondsToFrames(item.start, fps, 0);
    const durationFrames = secondsToFrames(item.duration, fps, 1);
    const endFrames = startFrames + durationFrames;
    const isLastEndpoint = index === items.length - 1 && timeFrames === endFrames;
    if (timeFrames < startFrames || (timeFrames >= endFrames && !isLastEndpoint)) continue;

    const localFrames = Math.max(0, Math.min(durationFrames, timeFrames - startFrames));
    const localTime = framesToSeconds(localFrames, fps);
    return {
      ...item,
      localTime,
      sourceTime: roundToFrame(item.range.inPoint + localTime, fps),
    };
  }

  return null;
}

const defaultIdFactory = (kind = 'clip') => {
  generatedId += 1;
  return `${kind}-${Date.now().toString(36)}-${generatedId.toString(36)}`;
};

const collectIds = (clips) => {
  const ids = new Set();
  clips.forEach((clip) => {
    if (clip?.instanceId != null) ids.add(String(clip.instanceId));
    (clip?.overlays || []).forEach((overlay) => {
      if (overlay?.id != null) ids.add(String(overlay.id));
    });
  });
  return ids;
};

const allocateId = (factory, used, kind) => {
  const base = String(factory(kind) ?? `${kind}-${Date.now().toString(36)}`);
  let candidate = base;
  let suffix = 1;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
};

const setOverlayDuration = (overlay, duration, keepOpenEnded) => {
  const next = { ...overlay };
  if (keepOpenEnded) {
    if (Object.prototype.hasOwnProperty.call(overlay, 'duration')) next.duration = overlay.duration;
    else delete next.duration;
  } else {
    next.duration = duration;
  }
  return next;
};

const partitionOverlays = (overlays, splitTime, clipDuration, idFactory, usedIds, fps) => {
  const left = [];
  const right = [];

  for (const overlay of Array.isArray(overlays) ? overlays : []) {
    const start = Math.max(0, Math.min(clipDuration, roundToFrame(finiteNumber(overlay?.startTime) ?? 0, fps)));
    const rawDuration = finiteNumber(overlay?.duration);
    const openEnded = overlay?.duration == null;
    const end = rawDuration !== null && rawDuration >= 0
      ? Math.min(clipDuration, roundToFrame(start + rawDuration, fps))
      : clipDuration;

    if (end <= start) continue;

    const leftEnd = Math.min(end, splitTime);
    const rightStart = Math.max(start, splitTime);
    let leftOverlay = null;
    let rightOverlay = null;

    if (start < splitTime && leftEnd > start) {
      leftOverlay = setOverlayDuration(
        { ...overlay, startTime: start },
        roundToFrame(leftEnd - start, fps),
        false,
      );
    }
    if (end > splitTime && rightStart < end) {
      rightOverlay = setOverlayDuration(
        { ...overlay, startTime: roundToFrame(rightStart - splitTime, fps) },
        roundToFrame(end - rightStart, fps),
        openEnded && end === clipDuration,
      );
    }

    if (leftOverlay && rightOverlay) {
      leftOverlay.id = allocateId(idFactory, usedIds, 'overlay');
      rightOverlay.id = allocateId(idFactory, usedIds, 'overlay');
    }
    if (leftOverlay) left.push(leftOverlay);
    if (rightOverlay) right.push(rightOverlay);
  }

  return { left, right };
};

/**
 * Coupe le clip sélectionné au temps global donné. Le résultat structuré rend
 * l'opération directement exploitable par React et garde des erreurs stables.
 */
export function splitClipAtTime(clips, options = {}) {
  if (!Array.isArray(clips) || clips.length === 0) return { error: 'not-found' };
  const fps = finiteNumber(options?.fps) > 0 ? Number(options.fps) : FPS;
  const layout = options?.layout || computeTimelineLayout(clips, fps);
  const hit = findClipAtTime(layout, options?.globalTime, options?.clipId);
  if (!hit) return { error: 'not-found' };

  const splitLocal = roundToFrame(hit.localTime, fps);
  const leftDuration = roundToFrame(splitLocal, fps);
  const rightDuration = roundToFrame(hit.duration - splitLocal, fps);
  if (leftDuration < MIN_CLIP_DURATION || rightDuration < MIN_CLIP_DURATION) return { error: 'edge' };

  const factory = options?.createId || defaultIdFactory;
  const usedIds = collectIds(clips);
  const leftId = allocateId(factory, usedIds, 'clip');
  const rightId = allocateId(factory, usedIds, 'clip');
  const cutSourceTime = roundToFrame(hit.range.inPoint + splitLocal, fps);
  const partitioned = partitionOverlays(
    hit.clip.overlays,
    splitLocal,
    hit.duration,
    factory,
    usedIds,
    fps,
  );

  const leftClip = {
    ...hit.clip,
    instanceId: leftId,
    inPoint: hit.range.inPoint,
    outPoint: cutSourceTime,
    durationSec: leftDuration,
    transition: undefined,
    overlays: partitioned.left,
    trimLabel: undefined,
  };
  const rightClip = {
    ...hit.clip,
    instanceId: rightId,
    inPoint: cutSourceTime,
    outPoint: hit.range.outPoint,
    durationSec: rightDuration,
    transition: hit.clip.transition ? { ...hit.clip.transition } : undefined,
    overlays: partitioned.right,
    trimLabel: undefined,
  };

  const nextClips = [
    ...clips.slice(0, hit.index),
    leftClip,
    rightClip,
    ...clips.slice(hit.index + 1),
  ];

  return { clips: nextClips, left: leftClip, right: rightClip, index: hit.index };
}
