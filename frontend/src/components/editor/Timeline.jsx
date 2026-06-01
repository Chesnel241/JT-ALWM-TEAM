import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
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

function SortableClip({ clip, onRemove, onTrim, onOverlay, onKenBurns, onSubtitle, onOverlaysChange }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.instanceId || clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const getClipDur = (c) => c.durationSec || (c.outPoint != null ? Math.max(0.3, c.outPoint - (c.inPoint || 0)) : 10);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col gap-1 bg-[var(--paper)] border ${
        isDragging ? 'border-[var(--accent)] shadow-xl' : 'border-[var(--border)] shadow-sm'
      } rounded-xl p-2 min-w-[200px] shrink-0`}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-[color:var(--muted)] hover:text-[color:var(--ink)]"
        >
          <GripVertical size={16} />
        </div>
        <div className="w-10 h-7 bg-black/10 rounded flex items-center justify-center shrink-0">
          <Video size={13} className="text-[color:var(--muted)]" />
        </div>
        <div className="flex-1 truncate text-xs font-semibold text-[color:var(--ink)]" title={clip.name}>
          {clip.name}
        </div>
        <button
          onClick={() => onTrim(clip)}
          className="p-1.5 text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
          title="Modifier le Trim"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onOverlay(clip)}
          className={`p-1.5 rounded-lg transition-colors ${(clip.overlays?.length ?? 0) > 0 ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}
          title="Animations & Habillage"
        >
          <Layers size={13} />
        </button>
        <button
          onClick={() => onKenBurns(clip.instanceId || clip.id)}
          className={`p-1.5 rounded-lg transition-colors ${clip.kenBurns?.mode ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}
          title="Zoom lent (Ken Burns) — clic pour changer"
        >
          <ZoomIn size={13} />
        </button>
        <button
          onClick={() => onSubtitle(clip)}
          className={`p-1.5 rounded-lg transition-colors ${(clip.subtitles?.length ?? 0) > 0 ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}
          title="Sous-titres auto"
        >
          <Captions size={13} />
        </button>
        <button
          onClick={() => onRemove(clip.instanceId || clip.id)}
          className="p-1.5 text-[color:var(--muted)] hover:text-[var(--signal)] hover:bg-[var(--signal)]/10 rounded-lg transition-colors"
          title="Retirer de la Timeline"
        >
          <Trash2 size={13} />
        </button>
      </div>
      
      {/* TEXT TRACK */}
      <div data-text-track className="mt-1 h-8 bg-[var(--paper-2)]/50 rounded border border-[var(--border)] relative overflow-visible flex items-center group">
        <div className="absolute inset-0 flex items-center px-2 text-[8px] text-[color:var(--muted)] uppercase font-bold tracking-wider pointer-events-none">
          Piste Texte
        </div>
        {(clip.overlays || []).map((o, i) => (
          <OverlayBlock
            key={o.id || i}
            overlay={o}
            index={i}
            clipDur={getClipDur(clip)}
            overlays={clip.overlays || []}
            onChange={(next) => onOverlaysChange?.(clip, next)}
            onOpen={() => onOverlay(clip)}
          />
        ))}
      </div>
    </div>
  );
}

export default function Timeline({ clips, setClips, onGenerate, isGenerating, onTrimClip, onOverlayClip, onGlobalLayer, brandingActive, onPreview, onSubtitleClip, onSplitText }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        </h3>
        <div className="flex items-center gap-3">
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

      <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--border)] p-4 min-h-[100px] flex items-center overflow-x-auto overflow-y-hidden">
        {clips.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)] italic text-center w-full">
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
              <div className="flex gap-2 items-center">
                {clips.map((clip, idx) => (
                  <React.Fragment key={clip.instanceId || clip.id}>
                    <SortableClip
                      clip={clip}
                      onRemove={removeClip}
                      onTrim={onTrimClip}
                      onOverlay={onOverlayClip}
                      onKenBurns={cycleKenBurns}
                      onSubtitle={onSubtitleClip}
                      onOverlaysChange={updateClipOverlays}
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
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
