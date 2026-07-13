import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Scissors, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { API_BASE } from '../../api/index.js';

function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00.0';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

export default function TrimModal({ file, onClose, onConfirm, inline = false }) {
  const videoRef = useRef(null);
  const progressRef = useRef(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => Number(file?.inPoint) || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [inPoint, setInPoint] = useState(() => Math.max(0, Number(file?.inPoint) || 0));
  const [outPoint, setOutPoint] = useState(() => {
    const value = Number(file?.outPoint);
    return Number.isFinite(value) && value > 0 ? value : null;
  }); // null = end of video
  const [dragging, setDragging] = useState(false);

  // L'URL doit rester strictement stable pendant la lecture. L'ancienne
  // version ajoutait Date.now() dans le render : chaque timeupdate pouvait
  // donc recharger la vidéo et casser le scrub.
  const mediaSrc = useMemo(() => {
    if (!file) return '';
    if (file.url?.startsWith('http') || file.url?.startsWith('blob:')) return file.url;
    return `${API_BASE}/uploads/${encodeURIComponent(file.filename || file.name || '')}?cors=2`;
  }, [file?.url, file?.filename, file?.name]);

  useEffect(() => {
    const nextIn = Math.max(0, Number(file?.inPoint) || 0);
    const nextOut = Number(file?.outPoint);
    setInPoint(nextIn);
    setOutPoint(Number.isFinite(nextOut) && nextOut > nextIn ? nextOut : null);
    setCurrentTime(nextIn);
    setDuration(Number(file?.sourceDurationSec) || 0);
    setIsPlaying(false);
  }, [file?.instanceId, file?.id, file?.filename, file?.inPoint, file?.outPoint, file?.sourceDurationSec]);

  // Load video metadata
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const fullDuration = videoRef.current.duration || 0;
      const restoredIn = Math.min(Math.max(0, Number(file?.inPoint) || 0), Math.max(0, fullDuration - 0.3));
      const requestedOut = Number(file?.outPoint);
      const restoredOut = Number.isFinite(requestedOut) && requestedOut > restoredIn
        ? Math.min(fullDuration, requestedOut)
        : fullDuration;
      setDuration(fullDuration);
      setInPoint(restoredIn);
      setOutPoint(restoredOut);
      setCurrentTime(restoredIn);
      videoRef.current.currentTime = restoredIn;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Auto-pause when we reach the outPoint
      if (outPoint != null && videoRef.current.currentTime >= outPoint) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // If at outPoint, restart from inPoint
      if (outPoint != null && videoRef.current.currentTime >= outPoint) {
        videoRef.current.currentTime = inPoint;
      }
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => { /* ignore abort */ });
      }
    }
    setIsPlaying((v) => !v);
  }, [isPlaying, outPoint, inPoint]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);


  const seekTo = (t) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const ct = Math.max(0, Math.min(t, duration));
    v.currentTime = ct;
    setCurrentTime(ct); // maj immédiate de la jauge (même en pause)
  };

  // Scrub : drag au pointeur sur la barre (clic + glisser).
  const scrubFromEvent = useCallback((clientX) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScrubDown = (e) => {
    if (!duration) return;
    setDragging(true);
    try { progressRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    scrubFromEvent(e.clientX);
  };
  const onScrubMove = (e) => { if (dragging) scrubFromEvent(e.clientX); };
  const onScrubUp = (e) => {
    setDragging(false);
    try { progressRef.current.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const timeFromClientX = useCallback((clientX) => {
    if (!progressRef.current || !duration) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const updateMarker = useCallback((kind, rawTime) => {
    if (!duration) return;
    if (kind === 'in') {
      const limit = Math.max(0, (outPoint ?? duration) - 0.3);
      const next = Math.max(0, Math.min(limit, rawTime));
      setInPoint(next);
      seekTo(next);
      return;
    }
    const next = Math.min(duration, Math.max(inPoint + 0.3, rawTime));
    setOutPoint(next);
    seekTo(next);
  }, [duration, inPoint, outPoint]); // eslint-disable-line react-hooks/exhaustive-deps

  const startMarkerDrag = (kind) => (e) => {
    if (!duration) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    try { target.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    const move = (event) => updateMarker(kind, timeFromClientX(event.clientX));
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    move(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const handleMarkerKeyDown = (kind) => (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const direction = e.key === 'ArrowRight' ? 1 : -1;
    const step = e.shiftKey ? 1 : 1 / 30;
    const current = kind === 'in' ? inPoint : (outPoint ?? duration);
    updateMarker(kind, current + direction * step);
  };

  const setIn = () => {
    let t = videoRef.current?.currentTime ?? 0;
    if (outPoint != null && t >= outPoint - 0.5) {
      t = Math.max(0, outPoint - 0.5);
    }
    setInPoint(t);
  };

  const setOut = () => {
    let t = videoRef.current?.currentTime ?? duration;
    if (t <= inPoint + 0.5) {
      t = Math.min(duration, inPoint + 0.5);
    }
    setOutPoint(t);
  };

  const handleConfirm = () => {
    const finalOut = outPoint ?? duration;
    onConfirm({
      ...file,
      inPoint: inPoint > 0 ? inPoint : undefined,
      outPoint: outPoint != null && outPoint < duration ? outPoint : undefined,
      durationSec: finalOut - inPoint,
      sourceDurationSec: duration,
      trimLabel:
        inPoint > 0 || (outPoint != null && outPoint < duration)
          ? `${formatTime(inPoint)} → ${formatTime(finalOut)}`
          : null,
    });
    onClose();
  };

  const inPct  = duration ? (inPoint / duration) * 100 : 0;
  const outPct = duration && outPoint != null ? (outPoint / duration) * 100 : 100;
  const playPct = duration ? (currentTime / duration) * 100 : 0;

  if (!file) return null;

  const content = (
    <div data-trim-editor className={`bg-[var(--paper)] w-full flex flex-col overflow-hidden ${inline ? 'h-full border-l border-[var(--border)]' : 'rounded-2xl max-w-2xl shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in-95 duration-200'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)] flex items-center gap-2">
            <Scissors className="text-[var(--accent)]" size={18} />
            Trim du clip
          </h2>
          <p className="text-xs text-[color:var(--muted)] truncate max-w-[200px]">{file.name}</p>
          <button
            onClick={onClose}
            className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player */}
        <div className="bg-black">
          <video
            ref={videoRef}
            src={mediaSrc}
            crossOrigin="anonymous"
            className="w-full max-h-[320px] object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onSeeked={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="metadata"
          />
        </div>

        {/* Controls */}
        <div className="px-5 pt-5 pb-4 flex flex-col gap-4 overflow-y-auto flex-1">

          {/* Progress / Trim Bar */}
          <div className="flex flex-col gap-1">
            <div
              ref={progressRef}
              onPointerDown={onScrubDown}
              onPointerMove={onScrubMove}
              onPointerUp={onScrubUp}
              onPointerCancel={onScrubUp}
              className="relative h-8 bg-[var(--paper-2)] rounded-lg cursor-pointer border border-[var(--border)] overflow-hidden select-none touch-none"
            >
              {/* Selected range (IN→OUT) */}
              <div
                className="absolute top-0 bottom-0 bg-[var(--accent)]/20 border-x-2 border-[var(--accent)]"
                style={{ left: `${inPct}%`, width: `${outPct - inPct}%` }}
              />
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
                style={{ left: `${playPct}%` }}
              />
              {/* IN marker */}
              <div
                onPointerDown={startMarkerDrag('in')}
                onKeyDown={handleMarkerKeyDown('in')}
                role="slider"
                tabIndex={0}
                aria-label="Déplacer le point IN"
                aria-valuemin={0}
                aria-valuemax={Math.max(0, (outPoint ?? duration) - 0.3)}
                aria-valuenow={Number(inPoint.toFixed(2))}
                className="absolute top-0 bottom-0 w-6 -translate-x-1/2 cursor-ew-resize touch-none z-20 flex justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{ left: `${inPct}%` }}
                title={`IN: ${formatTime(inPoint)}`}
              >
                <span className="w-1.5 h-full bg-[var(--accent)] rounded-sm shadow-sm pointer-events-none" />
              </div>
              {/* OUT marker */}
              <div
                onPointerDown={startMarkerDrag('out')}
                onKeyDown={handleMarkerKeyDown('out')}
                role="slider"
                tabIndex={0}
                aria-label="Déplacer le point OUT"
                aria-valuemin={Math.min(duration, inPoint + 0.3)}
                aria-valuemax={duration}
                aria-valuenow={Number((outPoint ?? duration).toFixed(2))}
                className="absolute top-0 bottom-0 w-6 -translate-x-1/2 cursor-ew-resize touch-none z-20 flex justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
                style={{ left: `${outPct}%` }}
                title={`OUT: ${formatTime(outPoint)}`}
              >
                <span className="w-1.5 h-full bg-[var(--signal)] rounded-sm shadow-sm pointer-events-none" />
              </div>
            </div>

            {/* Time labels */}
            <div className="flex justify-between text-[10px] text-[color:var(--muted)] font-mono">
              <span>IN: <strong className="text-[color:var(--accent)]">{formatTime(inPoint)}</strong></span>
              <span className="text-[color:var(--ink)] font-bold">{formatTime(currentTime)}</span>
              <span>OUT: <strong className="text-[var(--signal)]">{formatTime(outPoint)}</strong></span>
            </div>
          </div>

          {/* Champs précis et toujours visibles pour les utilisateurs qui
              préfèrent saisir un timecode plutôt que glisser. */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-[color:var(--ink)]">
              Point IN (secondes)
              <input
                type="number"
                min="0"
                max={Math.max(0, (outPoint ?? duration) - 0.3)}
                step="0.1"
                value={Number(inPoint.toFixed(2))}
                onChange={(e) => updateMarker('in', Number(e.target.value))}
                className="mt-1 w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--paper-2)] px-3 font-mono tabular-nums text-[color:var(--ink)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            </label>
            <label className="text-xs font-semibold text-[color:var(--ink)]">
              Point OUT (secondes)
              <input
                type="number"
                min={Math.min(duration, inPoint + 0.3)}
                max={duration}
                step="0.1"
                value={Number((outPoint ?? duration).toFixed(2))}
                onChange={(e) => updateMarker('out', Number(e.target.value))}
                className="mt-1 w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--paper-2)] px-3 font-mono tabular-nums text-[color:var(--ink)] focus:border-[var(--signal)] focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/30"
              />
            </label>
          </div>

          {/* Playback Controls Row */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => seekTo(inPoint)}
              className="p-2 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--paper-2)] border border-[var(--border)] transition-colors"
              title="Aller au point IN"
            >
              <SkipBack size={16} />
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-[var(--ink)] text-[color:var(--paper)] flex items-center justify-center hover:opacity-80 transition-opacity shadow-md"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button
              onClick={() => seekTo(outPoint ?? duration)}
              className="p-2 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--paper-2)] border border-[var(--border)] transition-colors"
              title="Aller au point OUT"
            >
              <SkipForward size={16} />
            </button>
          </div>

          {/* IN / OUT Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={setIn}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[color:var(--accent)] rounded-xl font-semibold text-sm hover:bg-[var(--accent)]/20 transition-colors"
            >
              <SkipBack size={15} />
              Marquer IN ({formatTime(currentTime)})
            </button>
            <button
              onClick={setOut}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--signal)]/10 border border-[var(--signal)]/30 text-[var(--signal)] rounded-xl font-semibold text-sm hover:bg-[var(--signal)]/20 transition-colors"
            >
              Marquer OUT ({formatTime(currentTime)})
              <SkipForward size={15} />
            </button>
          </div>

          {/* Confirm / Cancel */}
          <div className="flex gap-3 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[color:var(--muted)] hover:text-[color:var(--ink)] text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={duration === 0}
              className={`flex-1 py-2.5 rounded-xl text-[color:var(--paper)] font-semibold text-sm transition-opacity flex items-center justify-center gap-2 ${
                duration === 0 ? 'bg-[color:var(--muted)] cursor-not-allowed' : 'bg-[var(--ink)] hover:opacity-90'
              }`}
            >
              <Scissors size={15} />
              {file.instanceId ? 'Appliquer le trim' : 'Ajouter à la Timeline'}
            </button>
          </div>
        </div>
    </div>
  );

  if (inline) return content;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {content}
    </div>
  );
}
