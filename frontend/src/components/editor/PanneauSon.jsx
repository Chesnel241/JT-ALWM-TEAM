import React from 'react';
import { Mic, Play, Trash2, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { ROLES_SON } from '../../../../remotion/src/pisteAudio.js';
import { placeSon } from './pisteSon.js';

const minutage = (secondes) => {
  const s = Math.max(0, Math.round(Number(secondes) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Le réglage d'un son de la piste : ce qu'il est, son volume, et s'il baisse
 * le son des plans qu'il recouvre. Tout s'applique en direct et s'annule.
 */
export default function PanneauSon({ son, onChange, onRetirer, onFermer, onEcouter }) {
  const { t } = useI18n();
  const d = t.studio.son;
  if (!son) return null;
  const place = placeSon(son);
  const champ = 'w-full rounded-lg border border-[var(--border)] bg-[var(--paper-2)] px-3 py-2 text-base text-[color:var(--ink)] focus:outline-none focus:border-[var(--accent)]';
  return (
    <section className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--paper)]" aria-label={d.titre}>
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <Mic size={16} className="shrink-0 text-[color:var(--accent)]" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[color:var(--ink)]">{d.titre}</h3>
        <span className="min-w-0 flex-1 truncate text-xs text-[color:var(--muted)]">{son.name}</span>
        <button type="button" onClick={onFermer} aria-label={d.fermer} title={d.fermer} className="flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--muted)] hover:bg-[var(--paper-2)] hover:text-[color:var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <p className="text-xs text-[color:var(--muted)]">{d.place(minutage(place.debut), minutage(place.duree))}</p>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[color:var(--ink)]">{d.nature}</span>
          <select className={champ} value={son.role} onChange={(e) => onChange({ role: e.target.value }, 'role')}>
            {ROLES_SON.map((role) => <option key={role} value={role}>{t.studio.timeline.rolesSon[role]}</option>)}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="flex items-baseline justify-between text-xs font-semibold text-[color:var(--ink)]">
            {d.volume}
            <span className="font-mono text-[color:var(--muted)]">{Math.round((son.volume ?? 1) * 100)} %</span>
          </span>
          {/* 100 % au plus : un lecteur de navigateur refuse davantage, et
              l'aperçu doit rester fidèle au master (normalisé à la fin). */}
          <input type="range" aria-label={d.volume} min="0" max="1" step="0.05" value={Math.min(1, son.volume ?? 1)} onChange={(e) => onChange({ volume: Number(e.target.value) }, 'volume')} className="w-full accent-[var(--accent)]" />
        </label>

        <label className="flex items-start gap-3">
          <input type="checkbox" checked={!!son.attenuer} onChange={(e) => onChange({ attenuer: e.target.checked }, 'attenuer')} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span>
            <span className="block text-sm font-semibold text-[color:var(--ink)]">{d.attenuer}</span>
            <span className="block text-xs text-[color:var(--muted)]">{d.attenuerAide}</span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEcouter} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[color:var(--ink)] hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <Play size={15} aria-hidden="true" /> {d.ecouter}
          </button>
          <button type="button" onClick={onRetirer} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[color:var(--editor-danger)] hover:border-current focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <Trash2 size={15} aria-hidden="true" /> {d.retirer}
          </button>
        </div>
      </div>
    </section>
  );
}
