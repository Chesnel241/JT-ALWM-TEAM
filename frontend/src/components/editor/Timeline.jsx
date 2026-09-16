import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Captions,
  Copy,
  FolderOpen,
  GripVertical,
  Layers,
  Magnet,
  Maximize2,
  Minus,
  MousePointer2,
  Newspaper,
  Pencil,
  Play,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Type,
  Undo2,
  Video,
  ZoomIn,
} from 'lucide-react';
import { generateThumbnails } from '../../utils/thumbnails.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { etiquetteGeste } from './historiqueMontage.js';
import { animationRecommandee } from '../../data/overlayTemplates.js';
import {
  FPS,
  MIN_CLIP_DURATION,
  aimanter,
  computeTimelineLayout,
  defilementApresZoom,
  findClipAtTime,
  getClipRange,
  pointsDAimantation,
  pointsDeRognage,
  reperesVersSource,
  roundToFrame,
  splitClipAtTime,
} from './timelineModel.js';

const PX_PER_SEC_DEFAULT = 60;
const PX_PER_SEC_MIN = 18;
const PX_PER_SEC_MAX = 220;
/** L'aimant mord à huit pixels de l'écran, quel que soit l'agrandissement. */
const SEUIL_AIMANT_PX = 8;

// Les libellés vivent dans le dictionnaire : ce tableau est au niveau du
// module, hors de portée du fournisseur i18n, et une liste de noms français
// codés en dur donnait une station entièrement française à un monteur
// anglophone.
const TRANSITIONS = [
  'none', 'fade', 'fadeblack', 'fadewhite', 'fadegrays', 'dissolve', 'pixelize', 'wipeleft', 'wiperight', 'wipeup', 'wipedown', 'slideleft', 'slideright', 'slideup', 'slidedown', 'smoothleft', 'smoothright', 'circleopen', 'circleclose', 'circlecrop', 'radial', 'zoomin', 'squeezev', 'diagtl', 'diagbr', 'coverleft', 'coverright', 'revealleft', 'revealright', 'whippan', 'glitch', 'rgbsplit', 'lightsweep', 'flashwhite',
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clipId = (clip, index = 0) => clip?.instanceId || clip?.id || String(index);

const createId = (kind = 'clip') => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `${kind}-${window.crypto.randomUUID()}`;
  }
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const formatTimecode = (seconds, fps = FPS) => {
  const totalFrames = Math.max(0, Math.round((Number(seconds) || 0) * fps));
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return [hours, mins, secs, frames].map((part) => String(part).padStart(2, '0')).join(':');
};

const formatShortTime = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

function ToolButton({ icon, label, active = false, disabled = false, onClick, title, shortcut, danger = false, compact = false, responsiveCompact = false }) {
  const colors = danger
    ? 'border-[var(--editor-danger)]/55 text-[var(--editor-danger)] hover:bg-[var(--editor-danger)]/15'
    : active
      ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/14 text-[var(--editor-text)]'
      : 'border-[var(--editor-border)] text-[var(--editor-text)] hover:border-[var(--editor-accent)] hover:bg-[var(--editor-panel-raised)]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      title={shortcut ? `${title || label} · ${shortcut}` : (title || label)}
      className={`h-10 shrink-0 inline-flex items-center justify-center gap-2 rounded-md border px-2 text-xs font-semibold transition-[transform,background-color,border-color,color,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--editor-bg)] disabled:cursor-not-allowed disabled:opacity-35 ${colors}`}
    >
      {icon}
      {!compact && <span className={`whitespace-nowrap ${responsiveCompact ? 'hidden min-[1440px]:inline' : ''}`}>{label}</span>}
      {shortcut && !compact && <kbd className="ml-0.5 hidden rounded border border-[var(--editor-border)] px-1 py-0.5 font-mono text-[10px] text-[var(--editor-muted)] min-[1800px]:inline-flex">{shortcut}</kbd>}
    </button>
  );
}

function Ruler({ totalSec, pxPerSec, playheadSec, onPointerDown, onNudge }) {
  const { t } = useI18n();
  const majorStep = pxPerSec >= 180 ? 0.5 : pxPerSec >= 90 ? 1 : pxPerSec >= 45 ? 2 : pxPerSec >= 24 ? 5 : 10;
  const minorStep = majorStep / 5;
  const labelCount = Math.min(600, Math.ceil(totalSec / majorStep) + 1);
  const labels = Array.from({ length: labelCount }, (_, index) => index * majorStep);
  const minorPx = Math.max(3, minorStep * pxPerSec);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={t.studio.timeline.regle}
      aria-valuemin={0}
      aria-valuemax={Number(totalSec.toFixed(3))}
      aria-valuenow={Number((playheadSec || 0).toFixed(3))}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        onNudge(event.key === 'ArrowRight' ? 1 : -1, event.shiftKey);
      }}
      className="relative h-8 cursor-ew-resize select-none border-b border-[var(--editor-border)] bg-[var(--editor-panel)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--editor-accent)]"
      style={{
        touchAction: 'none',
        backgroundImage: 'repeating-linear-gradient(to right, var(--editor-border) 0 1px, transparent 1px 100%)',
        backgroundSize: `${minorPx}px 100%`,
      }}
    >
      {labels.map((second) => (
        <span
          key={second}
          className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] tabular-nums text-[var(--editor-muted)] pointer-events-none"
          style={{ left: `${second * pxPerSec}px` }}
        >
          {formatShortTime(second)}
        </span>
      ))}
    </div>
  );
}

function OverlayBlock({ overlay, index, totalSec, pxPerSec, overlays, onChange, onOpen, reperes = [], seuilAimant = 0 }) {
  const { t } = useI18n();
  const startTime = Math.max(0, Number(overlay.startTime) || 0);
  const duration = Math.max(MIN_CLIP_DURATION, Number(overlay.duration) || Math.max(MIN_CLIP_DURATION, totalSec - startTime));
  const label = overlay.fields?.texte || overlay.fields?.titre || overlay.fields?.nom || overlay.type || 'Titre';

  const beginDrag = (mode) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Une étiquette par geste, tirée au moment où le doigt se pose : un glissé
    // émet une modification par mouvement de souris, et sans elle « Annuler »
    // reculerait d'un pixel à la fois.
    const geste = etiquetteGeste(`titre-${mode}`);
    const startX = event.clientX;
    const original = { start: startTime, duration };
    let moved = false;
    let nextOverlays = overlays;
    const move = (pointerEvent) => {
      const delta = roundToFrame((pointerEvent.clientX - startX) / pxPerSec);
      if (Math.abs(pointerEvent.clientX - startX) > 2) moved = true;
      nextOverlays = overlays.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        // Un titre se pose sur un bord de plan : viser au pixel donnait trois
        // images de décalage, qu'on ne découvrait qu'à l'export.
        const accrocher = (valeur) => aimanter(valeur, reperes, seuilAimant);
        if (mode === 'move') {
          const vise = accrocher(roundToFrame(original.start + delta));
          const nextStart = clamp(vise, 0, Math.max(0, totalSec - original.duration));
          return { ...item, startTime: nextStart };
        }
        if (mode === 'left') {
          const vise = accrocher(roundToFrame(original.start + delta));
          const nextStart = clamp(vise, 0, original.start + original.duration - MIN_CLIP_DURATION);
          return { ...item, startTime: nextStart, duration: roundToFrame(original.start + original.duration - nextStart) };
        }
        const fin = accrocher(roundToFrame(original.start + original.duration + delta));
        return {
          ...item,
          duration: clamp(roundToFrame(fin - original.start), MIN_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, totalSec - original.start)),
        };
      });
      onChange(nextOverlays, geste, Infinity);
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (!moved && mode === 'move') onOpen();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const duplicate = (event) => {
    event.stopPropagation();
    const copy = {
      ...overlay,
      id: createId('overlay'),
      startTime: clamp(roundToFrame(startTime + 0.5), 0, Math.max(0, totalSec - duration)),
    };
    const next = [...overlays];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={beginDrag('move')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={t.studio.timeline.etiquetteTitre(label, formatTimecode(startTime), formatTimecode(duration))}
      title={t.studio.timeline.clipGlisser}
      className="absolute inset-y-1 rounded border border-[var(--editor-title)] bg-[var(--editor-title)]/75 text-[var(--editor-text)] shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-text)]"
      style={{ left: `${startTime * pxPerSec}px`, width: `${Math.max(6, duration * pxPerSec)}px`, touchAction: 'none' }}
    >
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={t.studio.timeline.titreRognerDebut}
        onPointerDown={beginDrag('left')}
        className="absolute inset-y-0 -left-2 z-20 w-5 cursor-ew-resize touch-none"
      >
        <span className="absolute inset-y-1 left-2 w-1 rounded bg-[var(--editor-text)]/85" />
      </span>
      <span className="pointer-events-none block truncate py-2 pl-3 pr-16 text-xs font-semibold">{label}</span>
      <span className="absolute inset-y-0 right-1 z-30 flex items-center gap-1">
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={duplicate} title={t.studio.timeline.titreDupliquer} aria-label={t.studio.timeline.titreDupliquer} className="flex h-7 w-7 items-center justify-center rounded bg-[var(--editor-panel)] text-[var(--editor-text)] hover:bg-[var(--editor-panel-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]">
          <Copy size={13} />
        </button>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onChange(overlays.filter((_, itemIndex) => itemIndex !== index)); }} title={t.studio.timeline.titreSupprimer} aria-label={t.studio.timeline.titreSupprimer} className="flex h-7 w-7 items-center justify-center rounded bg-[var(--editor-panel)] text-[var(--editor-danger)] hover:bg-[var(--editor-danger)]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-danger)]">
          <Trash2 size={13} />
        </button>
      </span>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={t.studio.timeline.titreRognerFin}
        onPointerDown={beginDrag('right')}
        className="absolute inset-y-0 -right-2 z-20 w-5 cursor-ew-resize touch-none"
      >
        <span className="absolute inset-y-1 right-2 w-1 rounded bg-[var(--editor-text)]/85" />
      </span>
    </div>
  );
}

function SortableClip({
  clip,
  item,
  index,
  previousTransition,
  pxPerSec,
  selected,
  active,
  toolMode,
  snapping,
  reperes,
  onSelect,
  onRazorSplit,
  onCommitRange,
  onOpenTrim,
}) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const [thumbnails, setThumbnails] = useState([]);
  const [draft, setDraft] = useState(null);
  const sourceRange = item.range || getClipRange(clip);
  const displayRange = draft?.range || sourceRange;
  const leftOffsetSec = draft?.edge === 'left' ? Math.max(0, displayRange.inPoint - sourceRange.inPoint) : 0;
  const baseMargin = index === 0 ? 0 : -(previousTransition * pxPerSec);
  const widthPx = Math.max(5, displayRange.durationSec * pxPerSec);

  useEffect(() => {
    if (!clip.url) {
      setThumbnails([]);
      return undefined;
    }
    const controller = new AbortController();
    const count = clamp(Math.ceil(sourceRange.durationSec / 1.5), 4, 12);
    generateThumbnails(clip.url, sourceRange.durationSec, count, {
      signal: controller.signal,
      startTime: sourceRange.inPoint,
    })
      .then((images) => {
        if (!controller.signal.aborted) setThumbnails(images || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [clip.url, sourceRange.inPoint, sourceRange.durationSec]);

  const computeRange = useCallback((edge, deltaSec) => {
    const original = sourceRange;
    // Sans durée source connue, on autorise toujours à raccourcir mais jamais
    // à inventer des images au-delà de la dernière borne fiable.
    const sourceLimit = original.sourceDurationSec ?? original.outPoint;
    // Les repères arrivent en secondes de montage ; un rognage raisonne en
    // points d'entrée et de sortie de la source.
    const accrocher = (valeur) => (snapping
      ? aimanter(valeur, reperesVersSource(reperes, { debutMontage: item.start, inPoint: original.inPoint }), SEUIL_AIMANT_PX / pxPerSec)
      : valeur);
    if (edge === 'left') {
      const vise = accrocher(roundToFrame(original.inPoint + deltaSec));
      const nextIn = clamp(vise, 0, original.outPoint - MIN_CLIP_DURATION);
      return { ...original, inPoint: nextIn, durationSec: roundToFrame(original.outPoint - nextIn) };
    }
    const vise = accrocher(roundToFrame(original.outPoint + deltaSec));
    const nextOut = clamp(vise, original.inPoint + MIN_CLIP_DURATION, sourceLimit);
    return { ...original, outPoint: nextOut, durationSec: roundToFrame(nextOut - original.inPoint) };
  }, [item.start, pxPerSec, reperes, snapping, sourceRange]);

  const beginEdgeDrag = (edge) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    let latest = sourceRange;
    const move = (pointerEvent) => {
      latest = computeRange(edge, (pointerEvent.clientX - startX) / pxPerSec);
      setDraft({ edge, range: latest });
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      setDraft(null);
      if (latest.inPoint !== sourceRange.inPoint || latest.outPoint !== sourceRange.outPoint) {
        onCommitRange(clip, latest);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const nudgeEdge = (edge, direction, large) => {
    const delta = direction * (large ? 1 : 1 / FPS);
    const next = computeRange(edge, delta);
    if (next.inPoint !== sourceRange.inPoint || next.outPoint !== sourceRange.outPoint) onCommitRange(clip, next);
  };

  const clipStyle = {
    width: `${widthPx}px`,
    marginLeft: `${baseMargin + leftOffsetSec * pxPerSec}px`,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : selected ? 20 : 5,
  };

  return (
    <div
      ref={setNodeRef}
      style={clipStyle}
      className="relative h-[82px] shrink-0 overflow-visible"
      data-clip-id={item.id}
    >
      <div
        role="option"
        aria-selected={selected}
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          if (toolMode === 'blade') onRazorSplit(item, event);
          else onSelect(item.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onSelect(item.id);
          onOpenTrim(clip);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(item.id);
          }
        }}
        aria-label={`${t.studio.timeline.etiquetteClip(index + 1, clip.name || clip.filename || t.studio.timeline.sansNom, formatTimecode(displayRange.durationSec))}${selected ? t.studio.timeline.selectionne : ''}`}
        className={`group absolute inset-0 overflow-hidden rounded-md border bg-[var(--editor-panel)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-text)] ${
          selected
            ? 'border-[var(--editor-accent)] ring-2 ring-[var(--editor-accent)]'
            : active
              ? 'border-[var(--editor-playhead)]'
              : 'border-[var(--editor-border)] hover:border-[var(--editor-muted)]'
        } ${toolMode === 'blade' ? 'cursor-crosshair' : 'cursor-default'} ${isDragging ? 'opacity-80 shadow-xl' : ''}`}
      >
        {thumbnails.length > 0 ? (
          <div className="absolute inset-0 flex pointer-events-none">
            {thumbnails.map((thumbnail, thumbnailIndex) => (
              <img key={`${thumbnailIndex}-${thumbnail.slice(-8)}`} src={thumbnail} alt="" className="h-full min-w-0 flex-1 object-cover" draggable="false" />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--editor-muted)]/40">
            <Video size={24} />
          </div>
        )}

        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(item.id);
          }}
          aria-label={`Déplacer ${clip.name || clip.filename || 'le clip'}`}
          title={t.studio.timeline.reordonner}
          className="absolute left-5 top-1.5 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded bg-[var(--editor-bg)]/90 text-[var(--editor-text)] active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]"
        >
          <GripVertical size={15} />
        </button>

        <div className="absolute inset-x-0 bottom-0 z-10 flex h-6 items-center justify-between gap-2 bg-[var(--editor-bg)]/90 px-2.5 text-[11px] text-[var(--editor-text)] pointer-events-none">
          <span className="truncate font-semibold">{clip.name || clip.filename || `Clip ${index + 1}`}</span>
          {widthPx > 90 && <span className="shrink-0 font-mono tabular-nums text-[var(--editor-muted)]">{formatShortTime(displayRange.durationSec)}</span>}
        </div>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`Rogner le début de ${clip.name || 'ce clip'}`}
        aria-valuemin={0}
        aria-valuemax={Number((sourceRange.outPoint - MIN_CLIP_DURATION).toFixed(3))}
        aria-valuenow={Number(displayRange.inPoint.toFixed(3))}
        onPointerDown={beginEdgeDrag('left')}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          nudgeEdge('left', event.key === 'ArrowRight' ? 1 : -1, event.shiftKey);
        }}
        title={`IN ${formatTimecode(displayRange.inPoint)} · glisser pour rogner`}
        className="absolute inset-y-0 -left-3 z-30 w-7 cursor-ew-resize touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]"
      >
        <span className="absolute inset-y-2 left-3 flex w-2 items-center justify-center rounded-sm bg-[var(--editor-text)] shadow">
          <span className="h-5 w-0.5 rounded bg-[var(--editor-bg)]" />
        </span>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`Rogner la fin de ${clip.name || 'ce clip'}`}
        aria-valuemin={Number((sourceRange.inPoint + MIN_CLIP_DURATION).toFixed(3))}
        aria-valuemax={Number((sourceRange.sourceDurationSec || sourceRange.outPoint).toFixed(3))}
        aria-valuenow={Number(displayRange.outPoint.toFixed(3))}
        onPointerDown={beginEdgeDrag('right')}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          nudgeEdge('right', event.key === 'ArrowRight' ? 1 : -1, event.shiftKey);
        }}
        title={`OUT ${formatTimecode(displayRange.outPoint)} · glisser pour rogner`}
        className="absolute inset-y-0 -right-3 z-30 w-7 cursor-ew-resize touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]"
      >
        <span className="absolute inset-y-2 right-3 flex w-2 items-center justify-center rounded-sm bg-[var(--editor-text)] shadow">
          <span className="h-5 w-0.5 rounded bg-[var(--editor-bg)]" />
        </span>
      </div>

      {clip.transition && (
        <span
          className="absolute -right-2 top-1 z-40 flex h-4 w-4 rotate-45 items-center justify-center rounded-sm border border-[var(--editor-text)]/70 bg-[var(--editor-title)]"
          title={`${t.studio.timeline.transitionApresCe} : ${t.studio.transitions[clip.transition.type] || clip.transition.type}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default function Timeline({
  clips,
  setClips,
  timelineOverlays = [],
  setTimelineOverlays,
  onGenerate,
  isGenerating,
  onTrimClip,
  onOverlayClip,
  onGlobalLayer,
  brandingActive,
  onPreview,
  onSubtitleClip,
  onSplitText,
  onBrowseRushes,
  // L'historique vit dans le tableau de bord : il porte le montage entier —
  // clips, titres et habillage — et non les seuls clips. Ici il n'était pas
  // seulement incomplet : l'effet qui le vidait se déclenchait à chaque frappe
  // dans l'inspecteur, parce que l'aperçu en direct réécrit les clips.
  modifierMontage,
  annulerMontage,
  retablirMontage,
  annulationPossible = false,
  retablissementPossible = false,
  playerRef,
  syncState = 'saved',
  presenceCount = 1,
  compact = false,
  // Prévient le tableau de bord du clip sélectionné : l'inspecteur, à droite,
  // affichait « Aucun clip sélectionné » pendant qu'un clip l'était ici.
  onSelectionChange,
}) {
  const { t } = useI18n();
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const clipsRef = useRef(clips);
  const [toolMode, setToolMode] = useState('select');
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [snapping, setSnapping] = useState(true);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [statusMessage, setStatusMessage] = useState(null);
  const [pxPerSec, setPxPerSec] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('jt-timeline-zoom'));
      return Number.isFinite(saved) && saved >= PX_PER_SEC_MIN && saved <= PX_PER_SEC_MAX ? saved : PX_PER_SEC_DEFAULT;
    } catch {
      return PX_PER_SEC_DEFAULT;
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const layout = useMemo(() => computeTimelineLayout(clips), [clips]);
  const selectedClip = useMemo(
    () => clips.find((clip, index) => String(clipId(clip, index)) === String(selectedClipId)) || null,
    [clips, selectedClipId],
  );
  const selectedIndex = selectedClip ? clips.indexOf(selectedClip) : -1;

  useEffect(() => {
    onSelectionChange?.(selectedClip);
  }, [onSelectionChange, selectedClip]);
  // Deux jeux de repères, parce que les deux gestes n'ont pas les mêmes points
  // fixes : un titre se pose sur un bord de plan, un rognage vise un bord de
  // titre — les bords de plan, eux, suivent le rognage au lieu de l'arrêter.
  const reperesTitre = useMemo(() => pointsDAimantation(layout, playheadSec), [layout, playheadSec]);
  const reperesRognage = useMemo(() => pointsDeRognage(timelineOverlays, playheadSec), [timelineOverlays, playheadSec]);
  const totalPx = Math.max(1, layout.total * pxPerSec);
  const contentWidth = Math.max(viewportWidth, totalPx);
  const videoTrackHeight = compact ? 64 : 112;
  const titleTrackHeight = compact ? 0 : 64;

  clipsRef.current = clips;

  useEffect(() => {
    if (clips.length === 0) {
      setSelectedClipId(null);
      return;
    }
    const stillExists = clips.some((clip, index) => String(clipId(clip, index)) === String(selectedClipId));
    if (!stillExists) setSelectedClipId(clipId(clips[0], 0));
  }, [clips, selectedClipId]);

  useEffect(() => {
    try { localStorage.setItem('jt-timeline-zoom', String(pxPerSec)); } catch { /* mode privé */ }
  }, [pxPerSec]);

  useEffect(() => {
    if (!scrollRef.current) return undefined;
    const update = () => setViewportWidth(scrollRef.current?.clientWidth || 0);
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(scrollRef.current);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    if (!playerRef?.current) return undefined;
    let animationFrame;
    let lastUpdate = 0;
    let lastFrame = -1;
    const tick = (timestamp) => {
      if (timestamp - lastUpdate >= 50) {
        try {
          const frame = playerRef.current?.getCurrentFrame?.();
          if (typeof frame === 'number' && frame !== lastFrame) {
            lastFrame = frame;
            lastUpdate = timestamp;
            setPlayheadSec(clamp(frame / FPS, 0, layout.total));
          }
        } catch { /* lecteur pas encore prêt */ }
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [layout.total, playerRef]);

  /**
   * Toute modification de la piste vidéo, enregistrée dans l'historique.
   *
   * `etiquette` nomme le geste : deux gestes de même nature faits coup sur
   * coup n'en font qu'un, ce qui évite qu'un glissé produise cinquante
   * entrées. Sans `modifierMontage` — la mini-timeline des chutiers — on
   * retombe sur l'écriture directe, sans annulation : mieux vaut un montage
   * non annulable qu'un montage bloqué.
   */
  const commitClips = useCallback((update, etiquette = null, fenetre = undefined) => {
    const current = clipsRef.current;
    const next = typeof update === 'function' ? update(current) : update;
    if (!Array.isArray(next) || next === current) return;
    clipsRef.current = next;
    if (modifierMontage) modifierMontage((m) => ({ ...m, clips: next }), etiquette, fenetre);
    else setClips(next);
  }, [modifierMontage, setClips]);

  /** Idem pour la piste des titres, qui n'était pas annulable du tout. */
  const commitOverlays = useCallback((next, etiquette = null, fenetre = undefined) => {
    if (!Array.isArray(next)) return;
    if (modifierMontage) modifierMontage((m) => ({ ...m, overlays: next }), etiquette, fenetre);
    else setTimelineOverlays?.(next);
  }, [modifierMontage, setTimelineOverlays]);

  const undo = useCallback(() => {
    if (!annulationPossible) return;
    annulerMontage?.();
    setStatusMessage(t.studio.timeline.msgAnnule);
  }, [annulationPossible, annulerMontage, t]);

  const redo = useCallback(() => {
    if (!retablissementPossible) return;
    retablirMontage?.();
    setStatusMessage(t.studio.timeline.msgRetabli);
  }, [retablissementPossible, retablirMontage, t]);

  const seekToTime = useCallback((time) => {
    const next = clamp(roundToFrame(time), 0, layout.total);
    setPlayheadSec(next);
    try { playerRef?.current?.seekTo?.(Math.round(next * FPS)); } catch { /* mini timeline */ }
  }, [layout.total, playerRef]);

  const nudgePlayhead = useCallback((direction, large = false) => {
    seekToTime(playheadSec + direction * (large ? 1 : 1 / FPS));
  }, [playheadSec, seekToTime]);

  const beginScrub = useCallback((event) => {
    if (!scrollRef.current || layout.total <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    const content = scrollRef.current.querySelector('[data-timeline-content]');
    if (!content) return;
    const update = (pointerEvent) => {
      const rect = content.getBoundingClientRect();
      seekToTime((pointerEvent.clientX - rect.left) / pxPerSec);
    };
    const finish = () => {
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    update(event);
    window.addEventListener('pointermove', update);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }, [layout.total, pxPerSec, seekToTime]);

  const commitRange = useCallback((clip, range) => {
    const id = clipId(clip);
    // Un rognage est un geste continu : sans étiquette unique et sans fenêtre
    // ouverte, il se découperait en autant d'entrées que de mouvements.
    commitClips((current) => current.map((item) => {
      if (String(clipId(item)) !== String(id)) return item;
      return {
        ...item,
        inPoint: range.inPoint,
        outPoint: range.outPoint,
        durationSec: range.durationSec,
        sourceDurationSec: range.sourceDurationSec ?? item.sourceDurationSec,
        trimLabel: `${formatTimecode(range.inPoint)} → ${formatTimecode(range.outPoint)}`,
      };
    }), `rognage:${id}`, Infinity);
    setStatusMessage(t.studio.timeline.msgTrim(formatTimecode(range.durationSec)));
  }, [commitClips]);

  const splitAt = useCallback((globalTime, preferredId = selectedClipId) => {
    const current = clipsRef.current;
    const currentLayout = computeTimelineLayout(current);
    const target = findClipAtTime(currentLayout, globalTime, preferredId)
      || findClipAtTime(currentLayout, globalTime);
    if (!target) {
      setStatusMessage(t.studio.timeline.msgCoupePlacer);
      return;
    }
    const result = splitClipAtTime(current, {
      clipId: target.id,
      globalTime,
      layout: currentLayout,
      createId,
    });
    if (result.error === 'edge') {
      setStatusMessage(t.studio.timeline.msgCoupeTropCourt);
      return;
    }
    if (result.error) {
      setStatusMessage(t.studio.timeline.msgCoupeIntrouvable);
      return;
    }
    commitClips(result.clips);
    setSelectedClipId(clipId(result.right));
    seekToTime(globalTime);
    setStatusMessage(t.studio.timeline.msgCoupeFaite(formatTimecode(globalTime)));
  }, [commitClips, seekToTime, selectedClipId]);

  /**
   * Crée un titre sur la piste T1, à la tête de lecture.
   *
   * Cette piste n'avait aucun chemin de création : on ne pouvait y déposer un
   * titre que s'il en existait déjà un, et le message d'aide renvoyait vers
   * « Habillage JT », qui écrit dans un autre tableau. Elle restait donc vide
   * indéfiniment.
   *
   * Le modèle par défaut est le titre de reportage, le plus courant, et
   * l'inspecteur s'ouvre dans la foulée : créer un bandeau vide sans pouvoir
   * le remplir tout de suite n'avancerait à rien.
   */
  const ajouterTitre = useCallback(() => {
    const debut = roundToFrame(Math.max(0, playheadSec));
    const restant = Math.max(0, layout.total - debut);
    // 5 s par défaut, mais jamais au-delà de la fin du montage.
    const duree = Math.max(MIN_CLIP_DURATION, Math.min(5, restant || 5));

    const titre = {
      id: createId('overlay'),
      templateId: 'titre_reportage',
      fields: {},
      animation: animationRecommandee('titre_reportage'),
      startTime: debut,
      duration: duree,
    };

    const suivants = [...timelineOverlays, titre];
    commitOverlays(suivants);
    setStatusMessage(t.studio.timeline.msgTitreAjoute(formatTimecode(debut)));
    onOverlayClip?.({ isTimelineOverlays: true, overlays: suivants });
  }, [playheadSec, layout.total, timelineOverlays, commitOverlays, onOverlayClip]);

  const razorSplit = useCallback((item, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const cutTime = roundToFrame(item.start + ratio * item.duration);
    seekToTime(cutTime);
    splitAt(cutTime, item.id);
  }, [seekToTime, splitAt]);

  const removeSelected = useCallback(() => {
    if (!selectedClipId) return;
    const current = clipsRef.current;
    const index = current.findIndex((clip, clipIndex) => String(clipId(clip, clipIndex)) === String(selectedClipId));
    if (index < 0) return;
    const nextSelection = current[index + 1] || current[index - 1] || null;
    commitClips(current.filter((_, clipIndex) => clipIndex !== index));
    setSelectedClipId(nextSelection ? clipId(nextSelection) : null);
    setStatusMessage(t.studio.timeline.msgClipRetire);
  }, [commitClips, selectedClipId]);

  const cycleKenBurns = useCallback(() => {
    if (!selectedClipId) return;
    commitClips((current) => current.map((clip, index) => {
      if (String(clipId(clip, index)) !== String(selectedClipId)) return clip;
      const currentMode = clip.kenBurns?.mode;
      const nextMode = currentMode === 'in' ? 'out' : currentMode === 'out' ? null : 'in';
      return { ...clip, kenBurns: nextMode ? { mode: nextMode } : undefined };
    }));
  }, [commitClips, selectedClipId]);

  const setTransition = useCallback((type) => {
    if (selectedIndex < 0) return;
    commitClips((current) => current.map((clip, index) => (
      index === selectedIndex
        ? { ...clip, transition: type === 'none' ? undefined : { type, duration: clip.transition?.duration || 0.5 } }
        : clip
    )));
  }, [commitClips, selectedIndex]);

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;
    commitClips((current) => {
      const oldIndex = current.findIndex((clip, index) => String(clipId(clip, index)) === String(active.id));
      const newIndex = current.findIndex((clip, index) => String(clipId(clip, index)) === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    setStatusMessage(t.studio.timeline.msgOrdre);
  }, [commitClips]);

  /**
   * Zoomer sans perdre ce qu'on regarde.
   *
   * Le zoom recentrait sur le bord gauche : sur un JT de dix minutes,
   * agrandir faisait disparaître l'endroit qu'on venait de viser, et il
   * fallait refaire défiler à la main. `ancreX` est la position du pointeur
   * dans la fenêtre ; à défaut, on garde le centre.
   */
  const zoomer = useCallback((suivant, ancreX = null) => {
    const conteneur = scrollRef.current;
    setPxPerSec((avant) => {
      const apres = clamp(Math.round(typeof suivant === 'function' ? suivant(avant) : suivant), PX_PER_SEC_MIN, PX_PER_SEC_MAX);
      if (conteneur && apres !== avant) {
        const pointeurX = ancreX == null
          ? conteneur.clientWidth / 2
          : clamp(ancreX - conteneur.getBoundingClientRect().left, 0, conteneur.clientWidth);
        const defilement = defilementApresZoom({
          scrollLeft: conteneur.scrollLeft,
          pointeurX,
          pxPerSecAvant: avant,
          pxPerSecApres: apres,
        });
        // Après le rendu : la largeur du contenu n'a pas encore changé.
        requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollLeft = defilement; });
      }
      return apres;
    });
  }, []);

  // Ctrl/⌘ + molette : le geste de toutes les stations de montage.
  useEffect(() => {
    const conteneur = scrollRef.current;
    if (!conteneur) return undefined;
    const surMolette = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomer((valeur) => valeur * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX);
    };
    conteneur.addEventListener('wheel', surMolette, { passive: false });
    return () => conteneur.removeEventListener('wheel', surMolette);
  }, [zoomer]);

  const fitToView = useCallback(() => {
    if (layout.total <= 0 || viewportWidth <= 0) return;
    setPxPerSec(clamp(Math.floor((viewportWidth - 12) / layout.total), PX_PER_SEC_MIN, PX_PER_SEC_MAX));
  }, [layout.total, viewportWidth]);

  /**
   * Décale l'élément sélectionné à l'image près, sans souris.
   *
   * Les flèches ne déplaçaient que la tête de lecture. Caler un bandeau sur un
   * plan demandait donc de viser au pixel : `Alt` + flèche décale d'une image,
   * `Alt` + `Maj` + flèche d'une seconde. C'est la seule façon d'être exact.
   */
  const decalerSelection = useCallback((direction, large = false) => {
    const pas = (large ? 1 : 1 / FPS) * direction;

    // Un titre sélectionné se déplace ; sinon c'est le clip, par son rognage.
    const titre = timelineOverlays.findIndex((o) => String(o.id) === String(selectedClipId));
    if (titre >= 0) {
      const courant = timelineOverlays[titre];
      const duree = Math.max(MIN_CLIP_DURATION, Number(courant.duration) || MIN_CLIP_DURATION);
      const debut = clamp(roundToFrame((Number(courant.startTime) || 0) + pas), 0, Math.max(0, layout.total - duree));
      commitOverlays(
        timelineOverlays.map((o, i) => (i === titre ? { ...o, startTime: debut } : o)),
        `clavier-titre:${courant.id}`,
      );
      setStatusMessage(t.studio.timeline.msgDecaleTitre(formatTimecode(debut)));
      return;
    }
    if (selectedIndex < 0) return;

    // Sur un clip, décaler revient à déplacer son point de sortie : c'est ce
    // qui change sa durée sur la timeline sans toucher aux plans voisins.
    // `dureeObtenue` est relevée dans la mise à jour plutôt que recalculée à
    // côté : le bornage — durée minimale d'un côté, fin de la source de
    // l'autre — ne doit s'écrire qu'une fois, sinon le message et le montage
    // finiront par ne plus dire la même chose.
    let dureeObtenue = null;
    commitClips((current) => current.map((clip, index) => {
      if (index !== selectedIndex) return clip;
      const plage = getClipRange(clip);
      const limite = plage.sourceDurationSec ?? plage.outPoint;
      const sortie = clamp(roundToFrame(plage.outPoint + pas), plage.inPoint + MIN_CLIP_DURATION, limite);
      if (sortie === plage.outPoint) return clip;
      dureeObtenue = roundToFrame(sortie - plage.inPoint);
      return { ...clip, inPoint: plage.inPoint, outPoint: sortie, durationSec: dureeObtenue };
    }), `clavier-clip:${selectedClipId}`, Infinity);
    // Rien quand le plan est déjà au bout de son rush : mieux vaut un message
    // inchangé qu'un message qui annonce un décalage qui n'a pas eu lieu.
    if (dureeObtenue != null) setStatusMessage(t.studio.timeline.msgDecaleClip(formatTimecode(dureeObtenue)));
  }, [commitClips, commitOverlays, layout.total, selectedClipId, selectedIndex, t, timelineOverlays]);

  const togglePlayback = useCallback(() => {
    const player = playerRef?.current;
    if (!player) return;
    try {
      if (player.isPlaying?.()) player.pause?.();
      else player.play?.();
    } catch { /* lecteur indisponible */ }
  }, [playerRef]);

  useEffect(() => {
    if (compact) return undefined;
    const handleShortcut = (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (document.querySelector('[data-trim-editor]')) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        splitAt(playheadSec);
        return;
      }
      if (event.key.toLowerCase() === 'v') setToolMode('select');
      else if (event.key.toLowerCase() === 'b') setToolMode('blade');
      else if (event.key.toLowerCase() === 'm') setSnapping((value) => !value);
      else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelected();
      } else if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        // Alt : on déplace la sélection. Sans Alt : la tête de lecture.
        if (event.altKey) decalerSelection(direction, event.shiftKey);
        else nudgePlayhead(direction, event.shiftKey);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [compact, decalerSelection, nudgePlayhead, playheadSec, redo, removeSelected, splitAt, togglePlayback, undo]);

  const playheadX = clamp(playheadSec, 0, layout.total) * pxPerSec;
  const activeItem = findClipAtTime(layout, playheadSec, selectedClipId) || findClipAtTime(layout, playheadSec);

  return (
    <section
      ref={rootRef}
      data-timeline-root
      aria-label={t.studio.timeline.timeline}
      className={`flex min-h-0 w-full flex-col overflow-hidden border-t border-[var(--editor-border)] bg-[var(--editor-bg)] text-[var(--editor-text)] ${compact ? '' : 'h-full'}`}
    >
      {compact ? (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--editor-border)] bg-[var(--editor-panel)] px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <Play size={16} className="text-[var(--editor-accent)]" />
            <strong className="truncate text-sm">Timeline</strong>
            <span className="font-mono text-xs tabular-nums text-[var(--editor-muted)]">{formatTimecode(playheadSec)} / {formatTimecode(layout.total)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onPreview && <ToolButton icon={<Maximize2 size={15} />} label={t.studio.timeline.ouvrirStudio} compact onClick={onPreview} />}
            <button type="button" onClick={onGenerate} disabled={clips.length === 0 || isGenerating} className="h-9 rounded-md bg-[var(--editor-accent-strong)] px-3 text-xs font-bold text-[var(--editor-bg)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35">
              {isGenerating ? t.studio.timeline.assemblage : t.studio.timeline.genererMaster}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-[54px] items-center gap-1.5 overflow-x-auto border-b border-[var(--editor-border)] bg-[var(--editor-panel)] px-2 py-1.5" role="toolbar" aria-label={t.studio.timeline.outils}>
            <div className="mr-1 flex shrink-0 flex-col px-1.5">
              <span className="font-mono text-sm font-semibold tabular-nums text-[var(--editor-text)]">{formatTimecode(playheadSec)}</span>
              <span className="text-[10px] text-[var(--editor-muted)]">{t.studio.timeline.surDuree} {formatTimecode(layout.total)}</span>
            </div>
            {onBrowseRushes && <ToolButton icon={<FolderOpen size={16} />} label={t.studio.timeline.rushs} onClick={onBrowseRushes} title={t.studio.timeline.rushsTitre} />}
            <ToolButton icon={<MousePointer2 size={16} />} label={t.studio.timeline.selection} shortcut="V" active={toolMode === 'select'} onClick={() => setToolMode('select')} />
            <ToolButton icon={<Scissors size={16} />} label={t.studio.timeline.lame} shortcut="B" active={toolMode === 'blade'} onClick={() => setToolMode('blade')} />
            <ToolButton icon={<Scissors size={16} />} label={t.studio.timeline.couperCurseur} shortcut="⌘K" disabled={clips.length === 0} onClick={() => splitAt(playheadSec)} />
            <span className="mx-0.5 h-7 w-px shrink-0 bg-[var(--editor-border)]" aria-hidden="true" />
            <ToolButton icon={<Magnet size={16} />} label={t.studio.timeline.magnetisme} shortcut="M" active={snapping} onClick={() => setSnapping((value) => !value)} />
            <ToolButton icon={<Undo2 size={16} />} label={t.studio.timeline.annuler} disabled={!annulationPossible} onClick={undo} compact title="Annuler" />
            <ToolButton icon={<Redo2 size={16} />} label={t.studio.timeline.retablir} disabled={!retablissementPossible} onClick={redo} compact title={t.studio.timeline.retablir} />
            {onSplitText && <ToolButton icon={<Type size={16} />} label={t.studio.timeline.couperTitre} disabled={timelineOverlays.length === 0} onClick={onSplitText} title={t.studio.timeline.couperTitreTitre} responsiveCompact />}
            {onGlobalLayer && <ToolButton icon={<Newspaper size={16} />} label={t.studio.timeline.habillageJT} active={!!brandingActive} onClick={onGlobalLayer} responsiveCompact />}
            
            {/* Indicateur de présence & synchro cloud */}
            <div className="hidden min-[1280px]:flex items-center gap-2 px-1">
              {presenceCount > 1 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold shadow-xs motion-voile" title={`${presenceCount} collaborateurs sont connectés sur cette semaine`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{presenceCount} monteurs</span>
                </div>
              )}
              {syncState && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--editor-muted)]" title={t.studio.timeline.syncTitre}>
                  <span className={`w-2 h-2 rounded-full ${syncState === 'saved' ? 'bg-emerald-400' : syncState === 'saving' ? 'bg-amber-400 animate-ping' : 'bg-red-400'}`} />
                  <span className="hidden min-[1500px]:inline">{syncState === 'saved' ? t.studio.timeline.cloudAJour : syncState === 'saving' ? t.studio.timeline.sauvegarde : t.studio.timeline.erreurSynchro}</span>
                </div>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
              <ToolButton icon={<Minus size={15} />} label={t.studio.timeline.dezoomer} compact onClick={() => zoomer((value) => value - 10)} title={t.studio.timeline.dezoomerTitre} />
              <input
                type="range"
                min={PX_PER_SEC_MIN}
                max={PX_PER_SEC_MAX}
                step="2"
                value={pxPerSec}
                onChange={(event) => zoomer(Number(event.target.value))}
                aria-label={`Zoom de timeline, ${pxPerSec} pixels par seconde`}
                className="w-16 accent-[var(--editor-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)] min-[1440px]:w-24"
              />
              <ToolButton icon={<Plus size={15} />} label={t.studio.timeline.zoomer} compact onClick={() => zoomer((value) => value + 10)} title={t.studio.timeline.zoomerTitre} />
              <ToolButton icon={<Maximize2 size={15} />} label={t.studio.timeline.ajuster} compact onClick={fitToView} title={t.studio.timeline.ajusterTitre} />
            </div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={clips.length === 0 || isGenerating}
              aria-busy={isGenerating}
              className="ml-1 h-10 shrink-0 rounded-md border border-[var(--editor-accent)] bg-[var(--editor-accent-strong)] px-3 text-xs font-bold text-[var(--editor-bg)] transition-[transform,background-color,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-text)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isGenerating ? t.studio.timeline.assemblageEnCours : t.studio.timeline.genererMaster}
            </button>
          </div>

          <div className="flex min-h-[46px] items-center gap-2 overflow-x-auto border-b border-[var(--editor-border)] bg-[var(--editor-bg)] px-2.5 py-1" role="toolbar" aria-label={t.studio.timeline.actionsClip}>
            {selectedClip ? (
              <>
                <div className="min-w-0 max-w-[240px] shrink px-1.5">
                  <div className="truncate text-xs font-semibold text-[var(--editor-text)]">{selectedClip.name || selectedClip.filename || t.studio.timeline.clipSelectionne}</div>
                  <div className="font-mono text-[10px] tabular-nums text-[var(--editor-muted)]">IN {formatTimecode(getClipRange(selectedClip).inPoint)} · OUT {formatTimecode(getClipRange(selectedClip).outPoint)}</div>
                </div>
                <ToolButton icon={<Pencil size={15} />} label={t.studio.timeline.rognagePrecis} onClick={() => onTrimClip?.(selectedClip)} />
                <ToolButton icon={<Layers size={15} />} label={t.studio.timeline.habillageClip} active={(selectedClip.overlays?.length || 0) > 0} onClick={() => onOverlayClip?.(selectedClip)} />
                <ToolButton icon={<ZoomIn size={15} />} label={selectedClip.kenBurns?.mode === 'in' ? t.studio.timeline.zoomAvant : selectedClip.kenBurns?.mode === 'out' ? t.studio.timeline.zoomArriere : t.studio.timeline.zoomLent} active={!!selectedClip.kenBurns?.mode} onClick={cycleKenBurns} />
                <ToolButton icon={<Captions size={15} />} label={t.studio.timeline.sousTitres} active={(selectedClip.subtitles?.length || 0) > 0} onClick={() => onSubtitleClip?.(selectedClip)} />
                <label className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-[var(--editor-border)] px-2.5 text-xs font-semibold text-[var(--editor-text)] focus-within:border-[var(--editor-accent)] focus-within:ring-2 focus-within:ring-[var(--editor-accent)]/40">
                  {t.studio.timeline.transitionApres}
                  <select
                    value={selectedClip.transition?.type || 'none'}
                    onChange={(event) => setTransition(event.target.value)}
                    disabled={selectedIndex === clips.length - 1}
                    className="max-w-[150px] bg-[var(--editor-panel)] px-2 py-1 text-xs text-[var(--editor-text)] focus:outline-none disabled:opacity-40"
                    aria-label={t.studio.timeline.transitionApresClip}
                  >
                    {TRANSITIONS.map((id) => <option key={id} value={id}>{t.studio.transitions[id]}</option>)}
                  </select>
                </label>
                <ToolButton icon={<Trash2 size={15} />} label={t.studio.timeline.supprimer} danger onClick={removeSelected} />
              </>
            ) : (
              <span className="px-1.5 text-xs text-[var(--editor-muted)]">{t.studio.timeline.aideClip}</span>
            )}
          </div>
        </>
      )}

      {clips.length === 0 ? (
        <div className="flex min-h-[120px] flex-1 items-center justify-center px-6 text-center">
          <div>
            <Video size={28} className="mx-auto mb-2 text-[var(--editor-muted)]" />
            <p className="text-sm font-semibold text-[var(--editor-text)]">{t.studio.timeline.videTitre}</p>
            <p className="mt-1 text-xs text-[var(--editor-muted)]">{t.studio.timeline.videTexte}</p>
            {onBrowseRushes && (
              <button
                type="button"
                onClick={onBrowseRushes}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-[var(--editor-accent)] px-3 text-xs font-bold text-[var(--editor-accent)] transition-[transform,background-color] duration-150 ease-[var(--ease-out)] hover:bg-[var(--editor-accent)]/10 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]"
              >
                <FolderOpen size={15} /> {t.studio.timeline.videCta}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[104px_minmax(0,1fr)]">
          <div className="relative z-30 border-r border-[var(--editor-border)] bg-[var(--editor-panel)]">
            <div className="flex h-8 items-center border-b border-[var(--editor-border)] px-3 font-mono text-[10px] text-[var(--editor-muted)]">{clips.length} CLIP{clips.length > 1 ? 'S' : ''}</div>
            <div className="flex items-center justify-between border-b border-[var(--editor-border)] px-3" style={{ height: `${videoTrackHeight}px` }}>
              <div>
                <strong className="text-sm text-[var(--editor-accent)]">V1</strong>
                <span className="ml-2 text-xs font-semibold text-[var(--editor-text)]">{t.studio.timeline.video}</span>
              </div>
            </div>
            {!compact && (
              <div className="flex items-center border-b border-[var(--editor-border)] px-3" style={{ height: `${titleTrackHeight}px` }}>
                <strong className="text-sm text-[var(--editor-title)]">T1</strong>
                <span className="ml-2 text-xs font-semibold text-[var(--editor-text)]">{t.studio.timeline.titres}</span>
              </div>
            )}
          </div>

          <div ref={scrollRef} className="min-w-0 overflow-x-auto overflow-y-hidden bg-[var(--editor-bg)] custom-scrollbar">
            <div data-timeline-content className="relative" style={{ width: `${contentWidth}px`, minWidth: '100%' }}>
              <Ruler totalSec={layout.total} pxPerSec={pxPerSec} playheadSec={playheadSec} onPointerDown={beginScrub} onNudge={nudgePlayhead} />

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={layout.items.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
                  <div role="listbox" aria-label={t.studio.timeline.pisteVideo} className="relative flex border-b border-[var(--editor-border)] bg-[var(--editor-panel-raised)]/35" style={{ height: `${videoTrackHeight}px`, width: `${contentWidth}px` }}>
                    {layout.items.map((item, index) => (
                      <SortableClip
                        key={item.id}
                        clip={item.clip}
                        item={item}
                        index={index}
                        previousTransition={index > 0 ? layout.items[index - 1].transitionDuration : 0}
                        pxPerSec={pxPerSec}
                        selected={String(selectedClipId) === String(item.id)}
                        active={activeItem?.id === item.id}
                        toolMode={toolMode}
                        snapping={snapping}
                        reperes={reperesRognage}
                        onSelect={setSelectedClipId}
                        onRazorSplit={razorSplit}
                        onCommitRange={commitRange}
                        onOpenTrim={(target) => onTrimClip?.(target)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {!compact && (
                <div role="region" aria-label={t.studio.timeline.pisteTitres} className="relative border-b border-[var(--editor-border)] bg-[var(--editor-panel)]/75" style={{ height: `${titleTrackHeight}px`, width: `${contentWidth}px` }}>
                  {/* Il n'existait aucun moyen de créer un titre ici : le
                      message renvoyait vers « Habillage JT », qui écrit en
                      réalité dans `branding.overlays`, un autre tableau qui
                      n'apparaît jamais sur cette piste. La piste restait donc
                      vide à jamais pour qui n'en avait pas déjà un. */}
                  {timelineOverlays.length === 0 && (
                    <div className="absolute inset-0 flex items-center gap-3 px-3">
                      <button
                        type="button"
                        onClick={ajouterTitre}
                        className="motion-tap flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--editor-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--editor-muted)] hover:border-[var(--editor-accent-strong)] hover:text-[color:var(--editor-accent)]"
                      >
                        <Plus size={13} /> {t.studio.timeline.ajouterTitre}
                      </button>
                      <span className="text-xs text-[var(--editor-muted)]">
                        {t.studio.timeline.titrePardessus}
                      </span>
                    </div>
                  )}
                  {timelineOverlays.map((overlay, index) => (
                    <OverlayBlock
                      key={overlay.id || index}
                      overlay={overlay}
                      index={index}
                      totalSec={layout.total}
                      pxPerSec={pxPerSec}
                      overlays={timelineOverlays}
                      reperes={snapping ? reperesTitre : []}
                      seuilAimant={SEUIL_AIMANT_PX / pxPerSec}
                      onChange={commitOverlays}
                      onOpen={() => onOverlayClip?.({ isTimelineOverlays: true, overlays: timelineOverlays })}
                    />
                  ))}
                  {timelineOverlays.length > 0 && (
                    <button
                      type="button"
                      onClick={ajouterTitre}
                      title={t.studio.timeline.ajouterTitreTitre}
                      aria-label={t.studio.timeline.ajouterTitreTitre}
                      className="motion-tap absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg border border-dashed border-[var(--editor-border)] p-1.5 text-[color:var(--editor-muted)] hover:border-[var(--editor-accent-strong)] hover:text-[color:var(--editor-accent)]"
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              )}

              <div
                className="pointer-events-none absolute top-0 z-[60]"
                style={{ transform: `translateX(${playheadX}px)`, bottom: 0, width: 1 }}
                aria-hidden="true"
              >
                <div className="absolute inset-y-0 left-0 w-px bg-[var(--editor-playhead)] shadow-[0_0_0_1px_oklch(0.2_0.03_245/0.35)]" />
                <button
                  type="button"
                  onPointerDown={beginScrub}
                  tabIndex={-1}
                  className="pointer-events-auto absolute -left-2 top-0 h-5 w-4 cursor-ew-resize touch-none rounded-b-sm bg-[var(--editor-playhead)]"
                  aria-label={t.studio.timeline.deplacerTete}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!compact && (
        <div className="flex min-h-8 items-center justify-between gap-4 border-t border-[var(--editor-border)] bg-[var(--editor-panel)] px-3 text-[11px] text-[var(--editor-muted)]">
          <span className="truncate" aria-live="polite">{statusMessage || t.studio.timeline.msgAide}</span>
          <span className="hidden shrink-0 lg:inline">{t.studio.timeline.raccourcis}</span>
        </div>
      )}
    </section>
  );
}
