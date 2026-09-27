import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { usePiegeFocus } from '../hooks/usePiegeFocus.jsx';

/**
 * Le titre de chaque reportage, une fois leur nombre choisi.
 *
 * Un champ par reportage, dans l'ordre : ceux qui existent déjà arrivent
 * remplis et se renomment ici, les nouveaux arrivent vides. Le titre est ce
 * que la rédaction lit sur son conducteur — « Reportage 2 » ne lui disait
 * rien, c'est pourquoi un reportage ne naît pas sans lui.
 *
 * Tout part en une seule requête (`onValider`) : sur un réseau qui décroche,
 * une création par reportage s'arrêtait volontiers à mi-chemin. Si le serveur
 * refuse — un reportage à retirer qui contient des fichiers, par exemple — la
 * feuille reste ouverte et dit pourquoi, au lieu d'un message fugace.
 *
 * Elle remplace `SujetTitleSheet`, qui n'était ni annoncée comme une boîte de
 * dialogue ni capable de retenir le focus : celle-ci l'est, par
 * `usePiegeFocus`, comme les autres boîtes du studio.
 */
export default function ReportagesSheet({ isOpen, nombre, sujets = [], onValider, onClose }) {
  const { t } = useI18n();
  const piege = usePiegeFocus(isOpen, onClose);
  const titreId = useId();
  const [titres, setTitres] = useState([]);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitres(Array.from({ length: nombre }, (_, i) => sujets[i]?.titre || ''));
    setBusy(false);
    setErreur('');
  }, [isOpen, nombre, sujets]);

  if (!isOpen) return null;

  const retires = sujets.slice(nombre);
  const complet = titres.length === nombre && titres.every((titre) => titre.trim());
  const premierVide = titres.findIndex((titre) => !titre.trim());

  const valider = async (event) => {
    event.preventDefault();
    if (!complet || busy) return;
    setBusy(true);
    setErreur('');
    try {
      // Les existants gardent leur identifiant, et donc leurs fichiers ; les
      // nouveaux viennent après eux. C'est l'ordre que le serveur exige.
      await onValider(titres.map((titre, i) => (
        sujets[i] ? { id: sujets[i].id, titre: titre.trim() } : { titre: titre.trim() }
      )));
      onClose();
    } catch (err) {
      setErreur(err?.message || t.uploader.errorPrefix);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4 motion-voile">
      <form
        ref={piege}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        onSubmit={valider}
        className="motion-boite w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[var(--paper)] rounded-t-3xl sm:rounded-3xl border border-[var(--border)] p-5 sm:p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={titreId} className="font-bold text-lg text-[color:var(--ink)] leading-snug">
              {t.uploader.nbReportagesSheetTitle(nombre)}
            </h3>
            <p className="mt-1 text-sm text-[color:var(--muted)] leading-relaxed">
              {t.uploader.nbReportagesSheetHint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.uploader.sujetCancel}
            className="shrink-0 p-2 -m-2 rounded-full text-[color:var(--muted)] active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {titres.map((titre, i) => (
            <label key={i} className="block">
              <span className="block text-xs font-bold text-[color:var(--muted)] mb-1">
                {t.uploader.reportageName(i + 1)}
              </span>
              <input
                value={titre}
                onChange={(e) => {
                  const valeur = e.target.value;
                  setTitres((prev) => prev.map((x, j) => (j === i ? valeur : x)));
                }}
                maxLength={120}
                placeholder={i === premierVide ? t.uploader.sujetPlaceholder : ''}
                className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--border)] focus:border-[color:var(--accent)] bg-[var(--paper)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none"
              />
            </label>
          ))}
        </div>

        {retires.length > 0 && (
          <p className="text-xs text-[color:var(--muted)]">
            {t.uploader.nbReportagesRemoved} {retires.map((s) => `« ${s.titre} »`).join(', ')}
          </p>
        )}

        {erreur && (
          <p role="alert" className="rounded-2xl bg-[var(--signal)]/10 border border-[var(--signal)]/40 px-3 py-2.5 text-sm font-semibold text-[color:var(--ink)]">
            {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={!complet || busy}
          className="w-full min-h-[54px] rounded-2xl bg-[var(--action)] text-white font-bold text-base active:scale-[0.98] motion-tap disabled:opacity-45"
        >
          {t.uploader.nbReportagesSubmit(nombre)}
        </button>
      </form>
    </div>
  );
}
