import { X, Newspaper, Radio, Image as ImageIcon, Music, Mic, Plus, Trash2 } from 'lucide-react';

const POSITIONS = [
  { id: 'tl', label: 'Haut gauche' }, { id: 'tr', label: 'Haut droite' },
  { id: 'bl', label: 'Bas gauche' }, { id: 'br', label: 'Bas droite' },
  { id: 'center', label: 'Centre' },
];

/**
 * Habillage global du JT : ticker, LIVE, logo, fond sonore (musique), voix-off,
 * incrustations images. Les fichiers audio/image proviennent des uploads de la
 * semaine (props audioFiles / imageFiles : [{filename, name}]).
 */
export default function GlobalLayerPanel({ value, onChange, onClose, audioFiles = [], imageFiles = [] }) {
  const v = value;
  const setTicker = (p) => onChange({ ...v, ticker: { ...v.ticker, ...p } });
  const setLive = (p) => onChange({ ...v, live: { ...v.live, ...p } });
  const setMusic = (p) => onChange({ ...v, music: { ...v.music, ...p } });
  const setVoice = (p) => onChange({ ...v, voiceover: { ...v.voiceover, ...p } });
  const setImages = (arr) => onChange({ ...v, imageOverlays: arr });

  const field = 'w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)]';
  const sectionCls = 'flex flex-col gap-3 border border-[var(--border)] rounded-xl p-4';
  const head = (icon, label, checked, onToggle) => (
    <label className="flex items-center justify-between font-semibold text-sm text-[color:var(--ink)]">
      <span className="flex items-center gap-2">{icon} {label}</span>
      {onToggle && <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />}
    </label>
  );

  const addImage = () => setImages([...(v.imageOverlays || []), { filename: imageFiles[0]?.filename || '', position: 'tr', scale: 0.25, opacity: 1, startTime: 0 }]);
  const updImage = (i, p) => setImages(v.imageOverlays.map((im, idx) => (idx === i ? { ...im, ...p } : im)));
  const rmImage = (i) => setImages(v.imageOverlays.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-lg flex flex-col shadow-2xl border border-[var(--border)] max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)] flex items-center gap-2 text-base">
            <Newspaper className="text-[var(--accent)]" size={18} /> Habillage JT (global)
          </h2>
          <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Ticker */}
          <section className={sectionCls}>
            {head(<Newspaper size={15} />, 'Bande défilante (ticker)', v.ticker.enabled, (c) => setTicker({ enabled: c }))}
            {v.ticker.enabled && (
              <>
                <input className={field} placeholder="Catégorie (ex: ALERTE)" value={v.ticker.categorie} onChange={(e) => setTicker({ categorie: e.target.value })} />
                <input className={field} placeholder="Texte défilant (séparez par •)" value={v.ticker.texte} onChange={(e) => setTicker({ texte: e.target.value })} />
              </>
            )}
          </section>

          {/* LIVE */}
          <section className={sectionCls}>
            {head(<Radio size={15} />, 'Badge LIVE / DIRECT', v.live.enabled, (c) => setLive({ enabled: c }))}
            {v.live.enabled && (
              <div className="flex gap-2">
                {['LIVE', 'DIRECT'].map((l) => (
                  <button key={l} onClick={() => setLive({ label: l })} className={`px-3 py-1.5 rounded-lg text-sm border ${v.live.label === l ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[color:var(--muted)]'}`}>{l}</button>
                ))}
              </div>
            )}
          </section>

          {/* Logo */}
          <section className="flex items-center justify-between border border-[var(--border)] rounded-xl p-4">
            <span className="flex items-center gap-2 font-semibold text-sm text-[color:var(--ink)]"><ImageIcon size={15} /> Logo chaîne (coin)</span>
            <input type="checkbox" checked={v.logo} onChange={(e) => onChange({ ...v, logo: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
          </section>

          {/* Musique */}
          <section className={sectionCls}>
            {head(<Music size={15} />, 'Fond sonore (musique)', v.music.enabled, (c) => setMusic({ enabled: c }))}
            {v.music.enabled && (
              <>
                <select className={field} value={v.music.filename} onChange={(e) => setMusic({ filename: e.target.value })}>
                  <option value="">— Choisir un fichier audio —</option>
                  {audioFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                </select>
                <label className="text-xs text-[color:var(--muted)]">Volume : {Math.round((v.music.volume ?? 0.2) * 100)}%</label>
                <input type="range" min="0" max="1" step="0.05" value={v.music.volume ?? 0.2} onChange={(e) => setMusic({ volume: parseFloat(e.target.value) })} className="w-full accent-[var(--accent)]" />
                <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
                  <input type="checkbox" checked={v.music.duck} onChange={(e) => setMusic({ duck: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
                  Baisser sous la voix (ducking)
                </label>
              </>
            )}
          </section>

          {/* Voix-off */}
          <section className={sectionCls}>
            {head(<Mic size={15} />, 'Voix-off', v.voiceover.enabled, (c) => setVoice({ enabled: c }))}
            {v.voiceover.enabled && (
              <>
                <select className={field} value={v.voiceover.filename} onChange={(e) => setVoice({ filename: e.target.value })}>
                  <option value="">— Choisir un fichier audio —</option>
                  {audioFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                </select>
                <label className="text-xs text-[color:var(--muted)]">Départ (s)</label>
                <input className={field} type="number" min="0" step="0.5" value={v.voiceover.startTime ?? 0} onChange={(e) => setVoice({ startTime: parseFloat(e.target.value) || 0 })} />
              </>
            )}
          </section>

          {/* Images */}
          <section className={sectionCls}>
            {head(<ImageIcon size={15} />, 'Incrustations images', null)}
            {(v.imageOverlays || []).map((im, i) => (
              <div key={i} className="border border-[var(--border)] rounded-lg p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <select className={field} value={im.filename} onChange={(e) => updImage(i, { filename: e.target.value })}>
                    <option value="">— Image —</option>
                    {imageFiles.map((f) => <option key={f.filename} value={f.filename}>{f.name}</option>)}
                  </select>
                  <button onClick={() => rmImage(i)} className="p-2 text-[color:var(--muted)] hover:text-[var(--signal)]"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className={field} value={im.position} onChange={(e) => updImage(i, { position: e.target.value })}>
                    {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <input className={field} type="number" min="0.05" max="1" step="0.05" value={im.scale} onChange={(e) => updImage(i, { scale: parseFloat(e.target.value) })} title="Taille (0–1)" />
                </div>
              </div>
            ))}
            {imageFiles.length === 0 ? (
              <p className="text-xs text-[color:var(--muted)] italic">Aucune image uploadée cette semaine.</p>
            ) : (
              <button onClick={addImage} className="flex items-center justify-center gap-2 py-2 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                <Plus size={15} /> Ajouter une image
              </button>
            )}
          </section>
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border)] bg-[var(--paper-2)]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--paper)] font-semibold text-sm hover:opacity-90">Terminé</button>
        </div>
      </div>
    </div>
  );
}
