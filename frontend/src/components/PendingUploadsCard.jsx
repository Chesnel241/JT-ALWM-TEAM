import { useRef } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { UPLOAD_ACCEPT } from '../lib/mediaTypes.js';

/**
 * Bandeau de reprise des envois interrompus.
 *
 * Le contenu du fichier ne peut pas être conservé d'une session à l'autre :
 * on redemande donc à la personne de le désigner, et l'envoi repart de
 * l'octet où il s'était arrêté. Le bouton ouvre directement le sélecteur de
 * fichiers pour qu'il n'y ait qu'un seul geste à faire.
 */
export default function PendingUploadsCard({ entries = [], onResume, onDismiss }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const targetRef = useRef(null);

  if (!entries.length) return null;

  const pick = (entry) => {
    targetRef.current = entry;
    inputRef.current?.click();
  };

  const handleChange = (event) => {
    const file = event.target.files?.[0];
    const entry = targetRef.current;
    event.target.value = '';
    targetRef.current = null;
    if (file && entry) onResume?.(entry, file);
  };

  return (
    <div className="mb-4 space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={handleChange}
      />
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="motion-rise rounded-2xl border border-[var(--signal)]/40 bg-[var(--signal)]/10 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-sm text-[color:var(--ink)]">{t.uploader.resumeTitle}</p>
              <p className="mt-1 text-sm text-[color:var(--ink)]/80 break-words">
                {t.uploader.resumeText(entry.name)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss?.(entry)}
              aria-label={t.uploader.resumeDismiss}
              title={t.uploader.resumeDismiss}
              className="shrink-0 p-2 rounded-full text-[color:var(--muted)] hover:text-[color:var(--ink)] active:scale-95"
            >
              <X size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => pick(entry)}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[var(--action)] text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-transform"
          >
            <RotateCcw size={17} />
            {t.uploader.resumeCta}
          </button>
        </div>
      ))}
    </div>
  );
}
