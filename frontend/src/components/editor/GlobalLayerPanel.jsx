import { X, Newspaper, Radio, Image as ImageIcon } from 'lucide-react';

/**
 * Habillage global du JT (appliqué à tout le master) : bande défilante,
 * badge LIVE/DIRECT, logo chaîne. `value` = { ticker, live, logo }.
 */
export default function GlobalLayerPanel({ value, onChange, onClose }) {
  const v = value;
  const setTicker = (patch) => onChange({ ...v, ticker: { ...v.ticker, ...patch } });
  const setLive = (patch) => onChange({ ...v, live: { ...v.live, ...patch } });

  const field = 'w-full px-3 py-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg text-sm text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)]';

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-lg flex flex-col shadow-2xl border border-[var(--border)] max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)] flex items-center gap-2 text-base">
            <Newspaper className="text-[var(--accent)]" size={18} /> Habillage JT (global)
          </h2>
          <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Ticker */}
          <section className="flex flex-col gap-3 border border-[var(--border)] rounded-xl p-4">
            <label className="flex items-center justify-between font-semibold text-sm text-[color:var(--ink)]">
              <span className="flex items-center gap-2"><Newspaper size={15} /> Bande défilante (ticker)</span>
              <input type="checkbox" checked={v.ticker.enabled} onChange={(e) => setTicker({ enabled: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
            </label>
            {v.ticker.enabled && (
              <>
                <input className={field} placeholder="Catégorie (ex: ALERTE)" value={v.ticker.categorie} onChange={(e) => setTicker({ categorie: e.target.value })} />
                <input className={field} placeholder="Texte défilant (séparez par •)" value={v.ticker.texte} onChange={(e) => setTicker({ texte: e.target.value })} />
              </>
            )}
          </section>

          {/* LIVE badge */}
          <section className="flex flex-col gap-3 border border-[var(--border)] rounded-xl p-4">
            <label className="flex items-center justify-between font-semibold text-sm text-[color:var(--ink)]">
              <span className="flex items-center gap-2"><Radio size={15} /> Badge LIVE / DIRECT</span>
              <input type="checkbox" checked={v.live.enabled} onChange={(e) => setLive({ enabled: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
            </label>
            {v.live.enabled && (
              <div className="flex gap-2">
                {['LIVE', 'DIRECT'].map((l) => (
                  <button key={l} onClick={() => setLive({ label: l })}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${v.live.label === l ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[color:var(--muted)]'}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Logo */}
          <section className="flex items-center justify-between border border-[var(--border)] rounded-xl p-4">
            <span className="flex items-center gap-2 font-semibold text-sm text-[color:var(--ink)]"><ImageIcon size={15} /> Logo chaîne (coin)</span>
            <input type="checkbox" checked={v.logo} onChange={(e) => onChange({ ...v, logo: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
          </section>
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border)] bg-[var(--paper-2)]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--paper)] font-semibold text-sm hover:opacity-90">
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}
