import { useState } from 'react';
import { X, Captions, Wand2, Trash2, Plus } from 'lucide-react';
import { API_BASE } from '../../api/index.js';
import { FONT_FAMILIES } from '../../data/overlayTemplates.js';
import { transcribe } from '../../lib/transcribe.js';

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${String(sec).padStart(4, '0')}`;
}

// Sous-titrage auto (Whisper navigateur) + édition + style, par clip.
export default function SubtitlePanel({ clip, onClose, onSave }) {
  const [segs, setSegs] = useState(clip.subtitles || []);
  const [style, setStyle] = useState(clip.subtitleStyle || { position: 'bottom', size: 'M', font: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const field = 'px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)]';

  const run = async () => {
    setBusy(true); setError(null); setProgress(0);
    try {
      const url = `${API_BASE}/uploads/${clip.filename}?proxy=true`;
      const out = await transcribe(url, { onStatus: setStatus, onProgress: setProgress });
      setSegs(out);
      setStatus(out.length ? `${out.length} segments générés` : 'Aucune parole détectée');
    } catch (e) {
      setError(e.message || 'Échec de la transcription');
    } finally {
      setBusy(false);
    }
  };

  const upd = (i, p) => setSegs(segs.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const rm = (i) => setSegs(segs.filter((_, idx) => idx !== i));
  const add = () => {
    const last = segs[segs.length - 1];
    const start = last ? last.end + 0.1 : 0;
    setSegs([...segs, { start, end: start + 2, text: '' }]);
  };

  const save = () => {
    onSave({
      ...clip,
      subtitles: segs.filter((s) => s.text.trim()),
      subtitleStyle: style,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-lg flex flex-col shadow-2xl border border-[var(--border)] max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)] flex items-center gap-2 text-base">
            <Captions className="text-[var(--accent)]" size={18} /> Sous-titres auto
          </h2>
          <p className="text-xs text-[color:var(--muted)] truncate max-w-[150px]">{clip.name}</p>
          <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Style */}
          <div className="grid grid-cols-3 gap-2">
            <select className={field} value={style.position} onChange={(e) => setStyle({ ...style, position: e.target.value })}>
              <option value="bottom">Bas</option>
              <option value="top">Haut</option>
            </select>
            <select className={field} value={style.size} onChange={(e) => setStyle({ ...style, size: e.target.value })}>
              <option value="S">Petit</option>
              <option value="M">Moyen</option>
              <option value="L">Grand</option>
            </select>
            <select className={field} value={style.font || ''} onChange={(e) => setStyle({ ...style, font: e.target.value || undefined })}>
              <option value="">Police déf.</option>
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Transcription auto */}
          <button onClick={run} disabled={busy} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm disabled:opacity-60">
            <Wand2 size={16} /> {busy ? 'Transcription…' : 'Générer automatiquement (FR)'}
          </button>
          {busy && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-[color:var(--muted)]">{status}</p>
              {progress > 0 && (
                <div className="h-1.5 bg-[var(--paper-2)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
            </div>
          )}
          {!busy && status && <p className="text-xs text-[color:var(--muted)]">{status}</p>}
          {error && <p className="text-xs text-[var(--signal)]">{error}</p>}

          {/* Segments éditables */}
          <div className="flex flex-col gap-2">
            {segs.map((s, i) => (
              <div key={i} className="flex items-start gap-2 border border-[var(--border)] rounded-lg p-2">
                <div className="flex flex-col gap-1 w-20 shrink-0">
                  <input className={`${field} py-1 text-xs`} type="number" step="0.1" value={s.start} onChange={(e) => upd(i, { start: parseFloat(e.target.value) || 0 })} title="Début (s)" />
                  <input className={`${field} py-1 text-xs`} type="number" step="0.1" value={s.end} onChange={(e) => upd(i, { end: parseFloat(e.target.value) || 0 })} title="Fin (s)" />
                </div>
                <textarea className={`${field} flex-1 resize-none`} rows={2} value={s.text} onChange={(e) => upd(i, { text: e.target.value })} />
                <button onClick={() => rm(i)} className="p-1.5 text-[color:var(--muted)] hover:text-[var(--signal)]"><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={add} className="flex items-center justify-center gap-2 py-2 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
              <Plus size={15} /> Ajouter une ligne
            </button>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border)] bg-[var(--paper-2)]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[color:var(--muted)] text-sm">Annuler</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--paper)] font-semibold text-sm flex items-center justify-center gap-2">
            <Captions size={15} /> Appliquer ({segs.filter((s) => s.text.trim()).length})
          </button>
        </div>
      </div>
    </div>
  );
}
