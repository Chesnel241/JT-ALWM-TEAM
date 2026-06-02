import React, { useEffect, useRef, useState } from 'react';
import { generateThumbnails } from '../../utils/thumbnails.js';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

const FPS = 30;
// Largeur des clips proportionnelle à leur durée. Zoom utilisateur via
// le slider PxPerSecSlider — défaut 60 px/sec (lisible jusqu'à ~2 min de
// timeline sur écran desktop, scrollable au-delà).
const PX_PER_SEC_DEFAULT = 60;
const MIN_CLIP_PX = 120; // garde un minimum lisible pour les très courts clips.
// Durée effective d'un clip (sec) — miroir de getClipDur/buildRemotionPayload.
const clipDurSec = (c) => c.durationSec || (c.outPoint != null ? Math.max(0.3, c.outPoint - (c.inPoint || 0)) : 10);
// Format mm:ss pour le timecode.
const fmtTime = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Règle temporelle (graduations chaque seconde, label tous les 5 s) au-dessus
// de la timeline. La largeur totale (px) suit la durée du JT à l'échelle.
function Ruler({ totalSec, pxPerSec }) {
  if (!totalSec || totalSec <= 0) return null;
  const totalPx = totalSec * pxPerSec;
  // Espacement label : on évite de tasser quand pxPerSec est petit.
  const labelEvery = pxPerSec >= 80 ? 1 : pxPerSec >= 40 ? 2 : 5;
  const ticks = [];
  for (let s = 0; s <= Math.ceil(totalSec); s++) {
    const isLabel = s % labelEvery === 0;
    ticks.push(
      <div
        key={s}
        className="absolute top-0 bottom-0"
        style={{ left: `${s * pxPerSec}px`, width: isLabel ? 1 : 1 }}
      >
        <div className={`absolute top-0 ${isLabel ? 'h-3' : 'h-1.5'} w-px bg-[var(--border)]`} />
        {isLabel && (
          <div className="absolute top-3 text-[9px] tabular-nums text-[color:var(--muted)] -translate-x-1/2 whitespace-nowrap">
            {fmtTime(s)}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="relative h-6 mb-1" style={{ width: `${totalPx}px`, minWidth: '100%' }} aria-hidden="true">
      {ticks}
    </div>
  );
}
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Video, Trash2, Play, GripVertical, Scissors, Pencil, Layers, ChevronRight, ZoomIn, Newspaper, Eye, Captions } from 'lucide-react';

const KEN_BURNS_LABEL = { in: 'Zoom avant', out: 'Zoom arrière' };

// Transitions xfade (doit matcher l'allowlist backend).
const TRANSITIONS = [
  { id: 'none', label: 'Coupe' },
  { id: 'fade', label: 'Fondu' },
  { id: 'fadeblack', label: 'Fondu noir' },
  { id: 'fadewhite', label: 'Fondu blanc' },
  { id: 'fadegrays', label: 'Fondu gris' },
  { id: 'dissolve', label: 'Dissoudre' },
  { id: 'pixelize', label: 'Pixels' },
  { id: 'wipeleft', label: 'Volet ←' },
  { id: 'wiperight', label: 'Volet →' },
  { id: 'wipeup', label: 'Volet ↑' },
  { id: 'wipedown', label: 'Volet ↓' },
  { id: 'slideleft', label: 'Glisse ←' },
  { id: 'slideright', label: 'Glisse →' },
  { id: 'slideup', label: 'Glisse ↑' },
  { id: 'slidedown', label: 'Glisse ↓' },
  { id: 'smoothleft', label: 'Doux ←' },
  { id: 'smoothright', label: 'Doux →' },
  { id: 'circleopen', label: 'Iris ouvert' },
  { id: 'circleclose', label: 'Iris fermé' },
  { id: 'circlecrop', label: 'Cercle' },
  { id: 'radial', label: 'Radial' },
  { id: 'zoomin', label: 'Zoom' },
  { id: 'squeezev', label: 'Pli vertical' },
  { id: 'diagtl', label: 'Diagonale ↖' },
  { id: 'diagbr', label: 'Diagonale ↘' },
  { id: 'coverleft', label: 'Couvre ←' },
  { id: 'coverright', label: 'Couvre →' },
  { id: 'revealleft', label: 'Révèle ←' },
  { id: 'revealright', label: 'Révèle →' },
  // Transitions broadcast custom (Remotion master). Le rendu libass
  // legacy retombe automatiquement sur 'fade'.
  { id: 'whippan', label: 'Whip pan (flou)' },
  { id: 'glitch', label: 'Glitch cut' },
  { id: 'rgbsplit', label: 'RGB split' },
  { id: 'lightsweep', label: 'Sweep lumineux' },
  { id: 'flashwhite', label: 'Flash blanc' },
];

// Sélecteur de transition inséré entre deux clips.
function TransitionPicker({ value, onChange }) {
  const active = value && value !== 'none';
  return (
    <div className="flex flex-col items-center gap-1 shrink-0" title="Transition vers le clip suivant">
      <ChevronRight size={16} className={active ? 'text-[var(--accent)]' : 'text-[color:var(--muted)]'} />
      <select
        value={value || 'none'}
        onChange={(e) => onChange(e.target.value)}
        className={`text-[10px] rounded-md border px-1 py-1 bg-[var(--paper)] focus:outline-none ${
          active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[color:var(--muted)]'
        }`}
      >
        {TRANSITIONS.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
    </div>
  );
}

// Bloc d'overlay interactif sur la piste texte : déplacer (drag corps),
// rogner (poignées G/D), dupliquer, supprimer — feel NLE pro. Tout en
// Pointer Events (souris + tactile tablettes pays).
function OverlayBlock({ overlay, index, clipDur, overlays, onChange, onOpen }) {
  const o = overlay;
  const startTime = o.startTime || 0;
  const dur = o.duration ?? (clipDur - startTime);
  const left = Math.max(0, Math.min(100, (startTime / clipDur) * 100));
  const width = Math.max(2, Math.min(100 - left, (dur / clipDur) * 100));

  // Drag générique : mode 'move' | 'left' | 'right'. Convertit le delta px
  // en secondes via la largeur pixel de la piste.
  const startDrag = (mode) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    const track = e.currentTarget.closest('[data-text-track]');
    if (!track) return;
    const trackW = track.getBoundingClientRect().width;
    const startX = e.clientX;
    const orig = { start: startTime, dur };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    let moved = false;

    const onMove = (ev) => {
      const dxSec = ((ev.clientX - startX) / trackW) * clipDur;
      if (Math.abs(ev.clientX - startX) > 2) moved = true;
      const next = overlays.map((ov, j) => {
        if (j !== index) return ov;
        if (mode === 'move') {
          const ns = Math.max(0, Math.min(clipDur - 0.3, orig.start + dxSec));
          return { ...ov, startTime: Math.round(ns * 100) / 100 };
        }
        if (mode === 'left') {
          const ns = Math.max(0, Math.min(orig.start + orig.dur - 0.3, orig.start + dxSec));
          const nd = orig.start + orig.dur - ns;
          return { ...ov, startTime: Math.round(ns * 100) / 100, duration: Math.round(nd * 100) / 100 };
        }
        // right
        const nd = Math.max(0.3, Math.min(clipDur - orig.start, orig.dur + dxSec));
        return { ...ov, duration: Math.round(nd * 100) / 100 };
      });
      onChange(next);
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // clic net (pas de drag) → ouvre le panneau d'édition.
      if (!moved && mode === 'move') onOpen();
      ev.stopPropagation();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const duplicate = (e) => {
    e.stopPropagation();
    const copy = { ...o, id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, startTime: Math.round(Math.min(clipDur - 0.3, startTime + 0.5) * 100) / 100 };
    const next = [...overlays]; next.splice(index + 1, 0, copy);
    onChange(next);
  };
  const remove = (e) => {
    e.stopPropagation();
    onChange(overlays.filter((_, j) => j !== index));
  };

  const label = o.fields?.texte || o.fields?.titre || o.fields?.nom || o.type || 'Texte';
  return (
    <div
      onPointerDown={startDrag('move')}
      className="absolute top-1 bottom-1 bg-[var(--accent)]/85 hover:bg-[var(--accent)] border border-[var(--accent)]/60 rounded-sm cursor-grab active:cursor-grabbing transition-colors shadow-sm flex items-center group/ov"
      style={{ left: `${left}%`, width: `${width}%`, touchAction: 'none' }}
      title={`${label} — glisser pour déplacer, poignées pour rogner`}
    >
      {/* poignée gauche (trim début) */}
      <div onPointerDown={startDrag('left')} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/70 rounded-l-sm" style={{ touchAction: 'none' }} />
      <div className="text-[9px] text-white truncate px-2 font-medium w-full pointer-events-none">{label}</div>
      {/* poignée droite (trim durée) */}
      <div onPointerDown={startDrag('right')} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/70 rounded-r-sm" style={{ touchAction: 'none' }} />
      {/* actions au survol : dupliquer / supprimer */}
      <div className="absolute -top-3 right-0 hidden group-hover/ov:flex gap-0.5 z-10">
        <button onPointerDown={(e) => e.stopPropagation()} onClick={duplicate} title="Dupliquer" className="w-4 h-4 flex items-center justify-center rounded bg-[var(--paper)] border border-[var(--border)] text-[8px] text-[color:var(--ink)] hover:bg-[var(--accent)] hover:text-white">⧉</button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={remove} title="Supprimer" className="w-4 h-4 flex items-center justify-center rounded bg-[var(--paper)] border border-[var(--border)] text-[8px] text-[color:var(--signal)] hover:bg-[var(--signal)] hover:text-white">✕</button>
      </div>
    </div>
  );
}

function SortableClip({ clip, index, onRemove, onTrim, onOverlay, onKenBurns, onSubtitle, onOverlaysChange, onClipResize, clipStart = 0, playheadSec = null, pxPerSec = PX_PER_SEC_DEFAULT }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.instanceId || clip.id });

  const getClipDur = clipDurSec;
  const dur = getClipDur(clip);
  // Largeur proportionnelle à la durée (échelle pxPerSec). Plancher pour les
  // clips très courts qui resteraient illisibles.
  const widthPx = Math.max(MIN_CLIP_PX, Math.round(dur * pxPerSec));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    width: `${widthPx}px`,
  };

  // Le clip est "actif" si le playhead (temps global) tombe dans sa plage.
  const localSec = playheadSec != null ? playheadSec - clipStart : null;
  const isActive = localSec != null && localSec >= 0 && localSec <= dur;

  const [thumbnails, setThumbnails] = useState([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let active = true;
    if (clip.url) {
      generateThumbnails(clip.url, dur, 10)
        .then((thumbs) => {
          if (active) setThumbnails(thumbs);
        })
        .catch((err) => console.error('Thumbnails error', err));
    }
    return () => { active = false; };
  }, [clip.url, dur]);

  // Trim au drag sur le bord droit/gauche du clip lui-même. Convertit le
  // delta px en delta secondes via pxPerSec puis met à jour inPoint/outPoint
  // ou durationSec (selon ce qui est défini sur le clip). Plancher 0.3 s.
  const startEdgeDrag = (edge) => (e) => {
    if (!onClipResize) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const orig = {
      inPoint: clip.inPoint || 0,
      outPoint: clip.outPoint,
      durationSec: clip.durationSec,
      dur,
    };
    const onMove = (ev) => {
      const dxSec = (ev.clientX - startX) / pxPerSec;
      let next;
      if (edge === 'right') {
        // Augmente/diminue la fin.
        if (orig.outPoint != null) {
          const np = Math.max(orig.inPoint + 0.3, orig.outPoint + dxSec);
          next = { outPoint: Math.round(np * 100) / 100, durationSec: undefined };
        } else {
          const nd = Math.max(0.3, (orig.durationSec || orig.dur) + dxSec);
          next = { durationSec: Math.round(nd * 100) / 100 };
        }
      } else {
        // edge === 'left' : on déplace inPoint, on garde outPoint (si défini)
        // ou on raccourcit la durationSec d'autant.
        if (orig.outPoint != null) {
          const ni = Math.max(0, Math.min(orig.outPoint - 0.3, orig.inPoint + dxSec));
          next = { inPoint: Math.round(ni * 100) / 100, durationSec: undefined };
        } else {
          const nd = Math.max(0.3, (orig.durationSec || orig.dur) - dxSec);
          const ni = Math.max(0, orig.inPoint + dxSec);
          next = { inPoint: Math.round(ni * 100) / 100, durationSec: Math.round(nd * 100) / 100 };
        }
      }
      onClipResize(clip, next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="listitem"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      aria-label={`Clip ${index != null ? index + 1 : ''} : ${clip.name}, durée ${fmtTime(dur)}${isActive ? ', en lecture' : ''}`}
      className={`group relative flex flex-col overflow-visible shrink-0 transition-shadow`}
    >
      {/* Label du clip (nom + durée) - Détaché au dessus */}
      <div className="text-[10px] text-[color:var(--muted)] font-medium mb-1 truncate px-1 pointer-events-none select-none">
        {clip.name} <span className="opacity-70">({fmtTime(dur)})</span>
      </div>

      <div className={`relative flex flex-col justify-center h-16 bg-[var(--paper)] border ${
        isDragging ? 'border-[var(--accent)] shadow-xl' : isActive ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 shadow-md' : 'border-[var(--border)] shadow-sm'
      } rounded-xl overflow-hidden`}>

        {/* Filmstrip Background */}
        {thumbnails.length > 0 ? (
          <div className="absolute inset-0 flex opacity-80 pointer-events-none">
            {thumbnails.map((t, i) => (
              <img key={i} src={t} alt="" className="h-full object-cover flex-1 min-w-0" />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <Video size={24} />
          </div>
        )}

        {/* Zone de Drag centrale pour réordonner (couvre tout sauf les poignées) */}
        <div 
          {...attributes}
          {...listeners}
          className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing z-10"
          aria-label={`Réordonner le clip ${clip.name}`}
        />

        {/* Poignée trim gauche */}
        {onClipResize && (
          <div
            onPointerDown={startEdgeDrag('left')}
            role="separator"
            aria-label="Rogner début du clip"
            title="Glisser pour rogner le début"
            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-[var(--accent)]/20 hover:bg-[var(--accent)]/90 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ touchAction: 'none' }}
          >
            <div className="w-1 h-4 bg-white/80 rounded-full pointer-events-none" />
          </div>
        )}
        
        {/* Poignée trim droite */}
        {onClipResize && (
          <div
            onPointerDown={startEdgeDrag('right')}
            role="separator"
            aria-label="Rogner fin du clip"
            title="Glisser pour rogner la fin"
            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-[var(--accent)]/20 hover:bg-[var(--accent)]/90 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ touchAction: 'none' }}
          >
            <div className="w-1 h-4 bg-white/80 rounded-full pointer-events-none" />
          </div>
        )}
      </div>

      {/* Floating Toolbar (apparaît au hover ou si actif) */}
      <div 
        className={`absolute top-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[var(--paper)] p-1 rounded-xl border border-[var(--border)] shadow-lg z-50 transition-all duration-200 ${
          isHovered || isActive ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-2 invisible pointer-events-none'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onTrim(clip); }}
          aria-label="Modifier le trim"
          className="p-1.5 text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
          title="Modifier le Trim"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOverlay(clip); }}
          aria-label="Animations & habillage"
          className={`p-1.5 rounded-lg transition-colors ${(clip.overlays?.length ?? 0) > 0 ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}
          title="Animations & Habillage"
        >
          <Layers size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onKenBurns(clip.instanceId || clip.id); }}
          aria-label={`Zoom lent Ken Burns`}
          className={`p-1.5 rounded-lg transition-colors ${clip.kenBurns?.mode ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}
          title="Zoom lent (Ken Burns)"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSubtitle(clip); }}
          aria-label={`Sous-titres auto`}
          className={`p-1.5 rounded-lg transition-colors ${(clip.subtitles?.length ?? 0) > 0 ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}
          title="Sous-titres auto"
        >
          <Captions size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(clip.instanceId || clip.id); }}
          aria-label="Retirer de la timeline"
          className="p-1.5 text-[color:var(--muted)] hover:text-[var(--signal)] hover:bg-[var(--signal)]/10 rounded-lg transition-colors"
          title="Retirer de la Timeline"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Timeline({ clips, setClips, timelineOverlays = [], setTimelineOverlays, onGenerate, isGenerating, onTrimClip, onOverlayClip, onGlobalLayer, brandingActive, onPreview, onSubtitleClip, onSplitText, playerRef }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Décalages temporels cumulés de chaque clip (en sec), en tenant compte du
  // chevauchement des transitions — miroir de totalDurationInFrames côté
  // Remotion. Sert à placer le playhead dans le bon clip.
  const starts = [];
  let acc = 0;
  let total = 0;
  clips.forEach((c, i) => {
    starts[i] = acc;
    const d = clipDurSec(c);
    total += d;
    const tr = c.transition && i < clips.length - 1 ? (c.transition.duration || 0.5) : 0;
    acc += d - tr;
    total -= tr;
  });
  total = Math.max(0, total);

  // Playhead synchronisé au lecteur Remotion via requestAnimationFrame.
  // null = pas de lecteur (mini-timeline) → aucune ligne de playhead.
  const [playheadSec, setPlayheadSec] = useState(null);
  useEffect(() => {
    if (!playerRef?.current) return undefined;
    let raf;
    const tick = () => {
      try {
        const f = playerRef.current?.getCurrentFrame?.();
        if (typeof f === 'number') setPlayheadSec(f / FPS);
      } catch { /* player pas prêt */ }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playerRef]);

  // Zoom horizontal de la timeline (px/sec). Mémorisé pour la session.
  const [pxPerSec, setPxPerSec] = useState(() => {
    try {
      const v = Number(localStorage.getItem('jt-timeline-zoom'));
      return Number.isFinite(v) && v >= 20 && v <= 200 ? v : PX_PER_SEC_DEFAULT;
    } catch { return PX_PER_SEC_DEFAULT; }
  });
  useEffect(() => {
    try { localStorage.setItem('jt-timeline-zoom', String(pxPerSec)); } catch { /* ignore */ }
  }, [pxPerSec]);

  // Met à jour les propriétés d'un clip (rogner aux bords). On respecte la
  // structure existante : inPoint/outPoint si présents, sinon durationSec.
  const updateClipResize = (clip, patch) => {
    const cid = clip.instanceId || clip.id;
    setClips(clips.map((c) => ((c.instanceId || c.id) === cid ? { ...c, ...patch } : c)));
  };

  // Position du playhead global sur la timeline (en px depuis le début).
  const globalPlayheadPx = playheadSec != null ? playheadSec * pxPerSec : null;

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setClips((items) => {
        const oldIndex = items.findIndex((i) => (i.instanceId || i.id) === active.id);
        const newIndex = items.findIndex((i) => (i.instanceId || i.id) === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeClip = (instanceId) => {
    setClips(clips.filter((c) => (c.instanceId || c.id) !== instanceId));
  };

  // Met à jour les overlays d'un clip (drag/trim/duplicate/delete sur la
  // piste texte). Source de vérité = clip.overlays.
  const updateClipOverlays = (clip, newOverlays) => {
    const cid = clip.instanceId || clip.id;
    setClips(clips.map((c) => ((c.instanceId || c.id) === cid ? { ...c, overlays: newOverlays } : c)));
  };

  const cycleKenBurns = (instanceId) => {
    setClips(clips.map((c) => {
      if ((c.instanceId || c.id) !== instanceId) return c;
      const cur = c.kenBurns?.mode;
      const next = cur === 'in' ? 'out' : cur === 'out' ? undefined : 'in';
      return { ...c, kenBurns: next ? { mode: next } : undefined };
    }));
  };

  const setTransition = (idx, type) => {
    setClips(clips.map((c, i) =>
      i === idx
        ? { ...c, transition: type === 'none' ? undefined : { type, duration: c.transition?.duration ?? 0.5 } }
        : c
    ));
  };

  return (
    <div className="bg-[var(--paper-2)] border-t border-[var(--border)] p-4 shadow-inner flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[color:var(--ink)] flex items-center gap-2">
          <Play size={18} className="text-[var(--accent)]" />
          Timeline de Montage
          {clips.length > 0 && (
            <span className="text-xs font-normal text-[color:var(--muted)] ml-1">({clips.length} clip{clips.length > 1 ? 's' : ''})</span>
          )}
          {clips.length > 0 && (
            <span className="ml-2 text-xs font-mono tabular-nums px-2 py-0.5 rounded bg-[var(--paper)] border border-[var(--border)] text-[color:var(--ink)]" aria-label={`Position ${fmtTime(playheadSec)} sur ${fmtTime(total)}`}>
              {fmtTime(playheadSec)} / {fmtTime(total)}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3" role="toolbar" aria-label="Actions de montage">
          {onPreview && clips.length > 0 && (
            <button
              onClick={onPreview}
              className="text-sm px-3 py-2 rounded-lg border border-[var(--border)] text-[color:var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors flex items-center gap-2"
              title="Aperçu temps réel avant l'assemblage"
            >
              <Eye size={16} /> Aperçu
            </button>
          )}
          {onSplitText && clips.length > 0 && (
            <button
              onClick={onSplitText}
              className="text-sm px-3 py-2 rounded-lg border border-[var(--border)] text-[color:var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors flex items-center gap-2"
              title="Couper le texte actif au niveau du curseur"
            >
              <Scissors size={16} /> Couper Texte
            </button>
          )}
          {onGlobalLayer && (
            <button
              onClick={onGlobalLayer}
              className={`text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border ${brandingActive ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[color:var(--muted)] hover:text-[var(--accent)]'}`}
              title="Habillage JT (ticker, LIVE, logo)"
            >
              <Newspaper size={16} /> Habillage JT
            </button>
          )}
          {clips.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Voulez-vous vraiment vider la timeline ?")) {
                  setClips([]);
                }
              }}
              className="text-sm text-[color:var(--muted)] hover:text-[var(--signal)] hover:bg-[var(--signal)]/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} /> Vider la timeline
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={clips.length === 0 || isGenerating}
            className="btn btn-primary py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Assemblage en cours...
              </span>
            ) : (
              <>
                <Video size={16} /> Générer la vidéo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Slider de zoom horizontal (px par seconde). Persistant localStorage. */}
      {clips.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted)] -mb-2">
          <span>Zoom</span>
          <input
            type="range"
            min="20"
            max="160"
            step="10"
            value={pxPerSec}
            onChange={(e) => setPxPerSec(Number(e.target.value))}
            className="w-32 accent-[var(--accent)]"
            aria-label={`Zoom horizontal de la timeline, ${pxPerSec} pixels par seconde`}
          />
          <span className="tabular-nums">{pxPerSec} px/s</span>
        </div>
      )}

      <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--border)] p-4 min-h-[100px] overflow-x-auto overflow-y-hidden relative">
        {clips.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)] italic text-center w-full py-6">
            Cliquez sur "Trim & Ajouter" sur les vidéos ci-dessus pour les ajouter ici.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={clips.map((c) => c.instanceId || c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {/* Règle temporelle */}
              <Ruler totalSec={total} pxPerSec={pxPerSec} />
              
              {/* Conteneur principal pour clips et piste texte avec le playhead global par-dessus */}
              <div className="relative">
                {/* Ligne de playhead globale */}
                {globalPlayheadPx != null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[var(--signal)] pointer-events-none z-40"
                    style={{ left: `${globalPlayheadPx}px` }}
                    aria-hidden="true"
                  >
                    <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--signal)]" />
                  </div>
                )}

                {/* Piste des clips */}
                <div className="flex gap-2 items-center min-h-[80px]">
                  {clips.map((clip, idx) => (
                    <React.Fragment key={clip.instanceId || clip.id}>
                      <SortableClip
                        clip={clip}
                        index={idx}
                        clipStart={starts[idx]}
                        playheadSec={playheadSec}
                        pxPerSec={pxPerSec}
                        onRemove={removeClip}
                        onTrim={onTrimClip}
                        onOverlay={() => onOverlayClip?.({ isTimelineOverlays: true, overlays: timelineOverlays })}
                        onKenBurns={cycleKenBurns}
                        onSubtitle={onSubtitleClip}
                        onOverlaysChange={updateClipOverlays}
                        onClipResize={updateClipResize}
                      />
                      {idx < clips.length - 1 && (
                        <TransitionPicker
                          value={clip.transition?.type}
                          onChange={(t) => setTransition(idx, t)}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Piste globale pour les overlays (titres, habillages, etc.) */}
                <div 
                  data-text-track 
                  className="global-text-track relative mt-4 h-10 bg-[var(--paper-2)]/50 rounded-lg border border-[var(--border)] flex items-center group"
                  style={{ width: `${total * pxPerSec}px` }}
                >
                  <div className="absolute inset-0 flex items-center px-3 text-[10px] text-[color:var(--muted)] uppercase font-bold tracking-wider pointer-events-none">
                    Piste Texte
                  </div>
                  {timelineOverlays.map((o, i) => (
                    <OverlayBlock
                      key={o.id || i}
                      overlay={o}
                      index={i}
                      clipDur={total || 1}
                      overlays={timelineOverlays}
                      onChange={(next) => setTimelineOverlays?.(next)}
                      onOpen={() => onOverlayClip?.({ isTimelineOverlays: true, overlays: timelineOverlays })}
                    />
                  ))}
                </div>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
