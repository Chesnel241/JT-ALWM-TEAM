import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * Demande le titre d'un sujet.
 *
 * C'est le seul moment où on demande quelque chose au correspondant avant
 * qu'il envoie : une phrase, pas un formulaire. Ce titre remplace
 * « Reportage 2 » et devient ce que la rédaction lit sur son conducteur, donc
 * il vaut la demande.
 */
export default function SujetTitleSheet({ isOpen, initialValue = '', onSubmit, onClose, mode = 'create' }) {
  const { t } = useI18n();
  const [titre, setTitre] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitre(initialValue);
    setBusy(false);
    // Le clavier doit s'ouvrir seul : un écran de plus à toucher, c'est un
    // sujet de moins envoyé.
    const id = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const submit = async (event) => {
    event.preventDefault();
    const propre = titre.trim();
    if (!propre || busy) return;
    setBusy(true);
    try {
      await onSubmit?.(propre);
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4">
      <form
        onSubmit={submit}
        className="motion-rise w-full sm:max-w-md bg-[var(--paper)] rounded-t-3xl sm:rounded-3xl border border-[var(--border)] p-5 sm:p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-[color:var(--ink)] leading-snug">
              {mode === 'rename' ? t.uploader.sujetRenameTitle : t.uploader.sujetAskTitle}
            </h3>
            <p className="mt-1 text-sm text-[color:var(--muted)] leading-relaxed">
              {t.uploader.sujetAskHint}
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

        <input
          ref={inputRef}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          maxLength={120}
          placeholder={t.uploader.sujetPlaceholder}
          className="w-full min-h-[52px] rounded-2xl border-2 border-[color:var(--accent)] bg-[var(--paper)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none"
        />

        <button
          type="submit"
          disabled={!titre.trim() || busy}
          className="w-full min-h-[54px] rounded-2xl bg-[var(--action)] text-white font-bold text-base active:scale-[0.98] motion-tap disabled:opacity-45"
        >
          {mode === 'rename' ? t.uploader.sujetRename : t.uploader.sujetCreate}
        </button>
      </form>
    </div>
  );
}
