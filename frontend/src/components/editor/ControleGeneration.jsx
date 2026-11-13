import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Target, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { usePiegeFocus } from '../../hooks/usePiegeFocus.jsx';
import { aCorriger } from './controleJT.js';

const minutage = (secondes) => {
  const s = Math.max(0, Math.round(Number(secondes) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
};

/**
 * Ce que le contrôle a relevé, avant de lancer le rendu.
 *
 * Rien n'est bloquant : c'est le monteur qui décide. Les remarques importantes
 * viennent d'abord, chacune avec « Voir », qui mène au plan concerné.
 */
export default function ControleGeneration({ remarques, dureeCible, onDureeCible, onAller, onGenerer, onFermer }) {
  const { t } = useI18n();
  const d = t.studio.controle;
  const boite = usePiegeFocus(true, onFermer);
  const nomModele = (id) => t.studio.habillages?.[id]?.label || id;
  const texte = (r) => {
    const v = r.valeurs || {};
    switch (r.code) {
      case 'vide': return d.vide;
      case 'refuse': return d.refuse(v.nom);
      case 'introuvable': return d.introuvable(v.nom);
      case 'court': return d.court(v.nom, Number(v.duree).toFixed(1).replace('.', ','));
      case 'texteVide': return d.texteVide(v.nom, nomModele(v.modele));
      case 'titreVide': return d.titreVide(nomModele(v.modele));
      case 'chevauchement': return d.chevauchement(nomModele(v.a), nomModele(v.b));
      case 'duree': return d.duree(minutage(v.total), minutage(v.cible));
      case 'sansGenerique': return d.sansGenerique;
      default: return r.code;
    }
  };
  const importantes = remarques.filter((r) => r.gravite === 'important');
  const conseils = remarques.filter((r) => r.gravite !== 'important');
  const bloquer = aCorriger(remarques);

  const ligne = (r, i) => (
    <li key={`${r.code}-${i}`} className="flex items-start gap-3 rounded-lg border border-[var(--editor-border)] bg-[var(--editor-bg)] px-3 py-2.5">
      {r.gravite === 'important'
        ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[color:var(--editor-playhead)]" aria-hidden="true" />
        : <Info size={16} className="mt-0.5 shrink-0 text-[color:var(--editor-accent)]" aria-hidden="true" />}
      <span className="min-w-0 flex-1 text-sm leading-5 text-[color:var(--editor-text)]">
        {r.rang ? <span className="mr-1.5 font-mono text-xs text-[color:var(--editor-muted)]">{d.plan(r.rang)}</span> : null}
        {texte(r)}
      </span>
      {(r.planId || Number.isFinite(r.instant)) && (
        <button type="button" onClick={() => onAller(r)} className="shrink-0 rounded-md border border-[var(--editor-border)] px-2.5 py-1 text-xs font-semibold text-[color:var(--editor-text)] hover:border-[var(--editor-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]">
          {d.voir}
        </button>
      )}
    </li>
  );

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 p-4 motion-voile" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <section ref={boite} role="dialog" aria-modal="true" aria-labelledby="controle-titre" className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--editor-border)] bg-[var(--editor-panel)] shadow-2xl motion-boite">
        <header className="flex items-start gap-3 border-b border-[var(--editor-border)] px-5 py-4">
          {remarques.length === 0
            ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[color:var(--editor-accent)]" aria-hidden="true" />
            : <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[color:var(--editor-playhead)]" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <h2 id="controle-titre" className="text-base font-bold text-[color:var(--editor-text)]">{d.titre}</h2>
            <p className="mt-0.5 text-xs text-[color:var(--editor-muted)]">{remarques.length === 0 ? d.aucune : d.intro(importantes.length, conseils.length)}</p>
          </div>
          <button type="button" onClick={onFermer} aria-label={d.fermer} className="flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--editor-muted)] hover:bg-[var(--editor-panel-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {importantes.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--editor-playhead)]">{d.important}</h3>
              <ul className="space-y-2">{importantes.map(ligne)}</ul>
            </div>
          )}
          {conseils.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--editor-accent)]">{d.conseil}</h3>
              <ul className="space-y-2">{conseils.map(ligne)}</ul>
            </div>
          )}
          <label className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--editor-border)] px-3 py-2.5">
            <Target size={16} className="shrink-0 text-[color:var(--editor-muted)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[color:var(--editor-text)]">{d.dureeCible}</span>
              <span className="block text-xs text-[color:var(--editor-muted)]">{d.dureeCibleAide}</span>
            </span>
            <input
              type="number"
              min="0"
              max="180"
              step="1"
              inputMode="numeric"
              value={dureeCible ?? ''}
              placeholder="—"
              onChange={(e) => onDureeCible(e.target.value === '' ? null : Math.max(0, Math.min(180, Number(e.target.value) || 0)))}
              aria-label={d.dureeCible}
              className="w-20 rounded-md border border-[var(--editor-border)] bg-[var(--editor-bg)] px-2 py-1.5 text-right text-base text-[color:var(--editor-text)] focus:outline-none focus:border-[var(--editor-accent)]"
            />
            <span className="text-xs text-[color:var(--editor-muted)]">{d.minutes}</span>
          </label>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--editor-border)] px-5 py-3">
          <button type="button" onClick={onFermer} className="h-10 rounded-lg border border-[var(--editor-border)] px-4 text-sm font-semibold text-[color:var(--editor-text)] hover:border-[var(--editor-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)]">
            {d.corriger}
          </button>
          <button type="button" onClick={onGenerer} className="h-10 rounded-lg bg-[var(--editor-accent-strong)] px-4 text-sm font-bold text-[color:var(--editor-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-text)]">
            {bloquer ? d.genererQuandMeme : d.generer}
          </button>
        </footer>
      </section>
    </div>
  );
}
