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
import { Video, Trash2, Play, GripVertical, Scissors, Pencil, Layers } from 'lucide-react';

function SortableClip({ clip, onRemove, onTrim, onOverlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

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
          onClick={() => onRemove(clip.id)}
          className="p-1.5 text-[color:var(--muted)] hover:text-[var(--signal)] hover:bg-[var(--signal)]/10 rounded-lg transition-colors"
          title="Retirer de la Timeline"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {/* Trim badge */}
      {clip.trimLabel && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--accent)]/10 rounded text-[10px] text-[color:var(--accent)] font-mono font-medium">
          <Scissors size={10} />
          {clip.trimLabel}
        </div>
      )}
      {(clip.overlays?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 rounded text-[10px] text-purple-500 font-medium">
          <Layers size={10} />
          {clip.overlays.length} animation{clip.overlays.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export default function Timeline({ clips, setClips, onGenerate, isGenerating, onTrimClip, onOverlayClip }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setClips((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeClip = (id) => {
    setClips(clips.filter((c) => c.id !== id));
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
              items={clips.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-2">
                {clips.map((clip) => (
                  <SortableClip
                    key={clip.id}
                    clip={clip}
                    onRemove={removeClip}
                    onTrim={onTrimClip}
                    onOverlay={onOverlayClip}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
