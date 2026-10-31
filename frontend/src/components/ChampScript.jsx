import { useId, useRef } from 'react';
import { Send, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

/** Le nombre de mots d'un texte, tel qu'un correspondant le compterait. */
export function compterMots(texte) {
  const propre = String(texte || '').trim();
  return propre ? propre.split(/\s+/).length : 0;
}

/**
 * Le texte de la voix off, ou les notes pour le monteur.
 *
 * Sur téléphone, ce champ était écrit en très petit (12 px) ; sur
 * ordinateur, il n'avait pas de libellé ni de compteur. Ici, un seul champ :
 * un libellé visible, un texte lisible, le nombre de mots qui suit la
 * frappe, un bouton pour tout effacer d'un geste, et le bouton vert qui
 * enregistre — grisé tant que le champ est vide.
 */
export default function ChampScript({
  libelle,
  valeur,
  onChange,
  onValider,
  enCours = false,
  desactive = false,
  lignes = 5,
}) {
  const { t } = useI18n();
  const u = t.uploader;
  const idChamp = useId();
  const idCompte = useId();
  const champ = useRef(null);
  const texte = valeur || '';
  const mots = compterMots(texte);

  const effacer = () => {
    onChange('');
    champ.current?.focus();
  };

  return (
    <div className="space-y-2.5">
      {libelle && (
        <label htmlFor={idChamp} className="block text-sm font-bold text-[color:var(--ink)]">
          {libelle}
        </label>
      )}
      <div className="relative">
        <textarea
          ref={champ}
          id={idChamp}
          rows={lignes}
          value={texte}
          onChange={(e) => onChange(e.target.value)}
          placeholder={u.scriptPh}
          aria-label={libelle ? undefined : u.scriptTitle}
          aria-describedby={idCompte}
          disabled={desactive}
          className="w-full min-h-[132px] rounded-2xl border-2 border-[var(--border)] bg-[var(--paper)] p-4 pr-14 text-base leading-relaxed text-[color:var(--ink)] placeholder:text-[color:var(--muted)] outline-none resize-y focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent)]/15 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {texte && !desactive && (
          <button
            type="button"
            onClick={effacer}
            aria-label={u.effacerTexte}
            title={u.effacerTexte}
            className="absolute right-2 top-2 h-11 w-11 rounded-xl flex items-center justify-center text-[color:var(--muted)] hover:bg-[var(--paper-2)] active:scale-90 motion-tap"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <span id={idCompte} className="text-sm font-semibold text-[color:var(--muted)]" aria-live="polite">
          {u.wordCount(mots)}
        </span>
        <button
          type="button"
          onClick={() => onValider?.()}
          disabled={desactive || enCours || !texte.trim()}
          className="jr-bouton jr-bouton-vert w-full sm:w-auto min-h-[52px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enCours
            ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
            : <Send size={18} aria-hidden="true" />}
          <span>{enCours ? u.sending : u.saveScript}</span>
        </button>
      </div>
    </div>
  );
}
