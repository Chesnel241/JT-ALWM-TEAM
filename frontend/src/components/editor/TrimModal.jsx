import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Scissors, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { API_BASE } from '../../api/index.js';

function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00.0';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

export default function TrimModal({ file, onClose, onConfirm }) {
  const videoRef = useRef(null);
  const progressRef = useRef(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(null); // null = end of video

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
      setDuration(videoRef.current.duration);
      setOutPoint(videoRef.current.duration);
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
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);


  const seekTo = (t) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(t, duration));
    }
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

  // Click on progress bar → seek
  const handleProgressClick = useCallback(
    (e) => {
      if (!progressRef.current || !duration) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      seekTo(ratio * duration);
    },
    [duration]
  );

  const handleConfirm = () => {
    onConfirm({
      ...file,
      inPoint: inPoint > 0 ? inPoint : undefined,
      outPoint: outPoint != null && outPoint < duration ? outPoint : undefined,
      trimLabel:
        inPoint > 0 || (outPoint != null && outPoint < duration)
          ? `${formatTime(inPoint)} → ${formatTime(outPoint ?? duration)}`
          : null,
    });
    onClose();
  };

  const inPct  = duration ? (inPoint / duration) * 100 : 0;
  const outPct = duration && outPoint != null ? (outPoint / duration) * 100 : 100;
  const playPct = duration ? (currentTime / duration) * 100 : 0;

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl border border-[var(--border)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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
            src={`${API_BASE}/uploads/${file.filename}`}
            className="w-full max-h-[320px] object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="metadata"
          />
        </div>

        {/* Controls */}
        <div className="px-5 pt-5 pb-4 flex flex-col gap-4">

          {/* Progress / Trim Bar */}
          <div className="flex flex-col gap-1">
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              className="relative h-8 bg-[var(--paper-2)] rounded-lg cursor-pointer border border-[var(--border)] overflow-hidden select-none"
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
                className="absolute top-0 bottom-0 w-1 bg-[var(--accent)] cursor-ew-resize"
                style={{ left: `${inPct}%` }}
                title={`IN: ${formatTime(inPoint)}`}
              />
              {/* OUT marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-[var(--signal)] cursor-ew-resize"
                style={{ left: `${outPct}%`, transform: 'translateX(-100%)' }}
                title={`OUT: ${formatTime(outPoint)}`}
              />
            </div>

            {/* Time labels */}
            <div className="flex justify-between text-[10px] text-[color:var(--muted)] font-mono">
              <span>IN: <strong className="text-[color:var(--accent)]">{formatTime(inPoint)}</strong></span>
              <span className="text-[color:var(--ink)] font-bold">{formatTime(currentTime)}</span>
              <span>OUT: <strong className="text-[var(--signal)]">{formatTime(outPoint)}</strong></span>
            </div>
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
              className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[color:var(--paper)] font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Scissors size={15} />
              Ajouter à la Timeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
