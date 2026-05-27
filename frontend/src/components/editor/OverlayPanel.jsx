import { useState } from 'react';
import { X, Plus, Trash2, Layers, Clock } from 'lucide-react';
import { OVERLAY_TEMPLATES, CLIP_TEMPLATES, TEXT_ANIMATIONS, FONT_FAMILIES } from '../../data/overlayTemplates.js';

function formatTime(s) {
  if (s == null || isNaN(s)) return '0s';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function OverlayEditor({ overlay, onChange, onRemove }) {
  const template = OVERLAY_TEMPLATES.find((t) => t.id === overlay.templateId);
  if (!template) return null;

  return (
    <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--paper)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[color:var(--ink)] flex items-center gap-2 text-sm">
          <span>{template.emoji}</span> {template.label}
        </span>
        <button
          onClick={onRemove}
          className="p-1.5 text-[color:var(--muted)] hover:text-[var(--signal)] hover:bg-[var(--signal)]/10 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Text fields */}
      {template.fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)]">{field.label}</label>
          <input
            type="text"
            placeholder={field.placeholder}
            value={overlay.fields?.[field.key] || ''}
            onChange={(e) =>
              onChange({
                ...overlay,
                fields: { ...(overlay.fields || {}), [field.key]: e.target.value },
              })
            }
            className="w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
          />
        </div>
      ))}

      {/* Animation + Police */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)]">Animation d'entrée</label>
          <select
            value={overlay.animation || 'fade'}
            onChange={(e) => onChange({ ...overlay, animation: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
          >
            {TEXT_ANIMATIONS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)]">Police</label>
          <select
            value={overlay.font || ''}
            onChange={(e) => onChange({ ...overlay, font: e.target.value || undefined })}
            className="w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
          >
            <option value="">Par défaut</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timing controls */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)] flex items-center gap-1">
            <Clock size={11} /> Début (s)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={overlay.startTime ?? 0}
            onChange={(e) => onChange({ ...overlay, startTime: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[color:var(--muted)]">Durée (s, vide = toute la vidéo)</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            placeholder="∞"
            value={overlay.duration ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...overlay, duration: v === '' ? null : parseFloat(v) });
            }}
            className="w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
          />
        </div>
      </div>
    </div>
  );
}

export default function OverlayPanel({ clip, onClose, onSave }) {
  const [overlays, setOverlays] = useState(clip.overlays || []);
  const [picking, setPicking] = useState(false);

  const addOverlay = (templateId) => {
    setOverlays([
      ...overlays,
      {
        id: `${templateId}-${Date.now()}`,
        templateId,
        fields: {},
        animation: 'fade',
        startTime: 0,
        duration: null,
      },
    ]);
    setPicking(false);
  };

  const updateOverlay = (idx, updated) => {
    const copy = [...overlays];
    copy[idx] = updated;
    setOverlays(copy);
  };

  const removeOverlay = (idx) => {
    setOverlays(overlays.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({ ...clip, overlays });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-lg flex flex-col shadow-2xl border border-[var(--border)] max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)] flex items-center gap-2 text-base">
            <Layers className="text-[var(--accent)]" size={18} />
            Animations & Habillage
          </h2>
          <p className="text-xs text-[color:var(--muted)] truncate max-w-[150px]">{clip.name}</p>
          <button
            onClick={onClose}
            className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {overlays.length === 0 && !picking && (
            <div className="text-center py-8 text-[color:var(--muted)]">
              <Layers size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune animation pour ce clip.</p>
              <p className="text-xs mt-1">Cliquez sur "Ajouter une animation" ci-dessous.</p>
            </div>
          )}

          {overlays.map((overlay, idx) => (
            <OverlayEditor
              key={overlay.id}
              overlay={overlay}
              onChange={(updated) => updateOverlay(idx, updated)}
              onRemove={() => removeOverlay(idx)}
            />
          ))}

          {/* Template picker */}
          {picking ? (
            <div className="border border-[var(--accent)]/40 rounded-xl p-4 bg-[var(--accent)]/5 flex flex-col gap-2">
              <p className="text-xs font-semibold text-[color:var(--accent)] mb-1">Choisissez un modèle :</p>
              {CLIP_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => addOverlay(t.id)}
                  className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all text-left"
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <div>
                    <p className="font-semibold text-sm text-[color:var(--ink)]">{t.label}</p>
                    <p className="text-xs text-[color:var(--muted)]">{t.preview}</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setPicking(false)}
                className="text-xs text-[color:var(--muted)] hover:text-[color:var(--ink)] text-center mt-1 transition-colors"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPicking(true)}
              className="flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-dashed border-[var(--border)] rounded-xl text-sm text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[color:var(--accent)] transition-colors"
            >
              <Plus size={16} />
              Ajouter une animation
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[var(--border)] bg-[var(--paper-2)]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[color:var(--muted)] hover:text-[color:var(--ink)] text-sm transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[color:var(--paper)] font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Layers size={15} />
            Appliquer ({overlays.length} animation{overlays.length !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
