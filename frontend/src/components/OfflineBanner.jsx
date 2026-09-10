import { WifiOff, Clock } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * Signale la coupure réseau et ce qui va se passer.
 *
 * Sans ce bandeau, un correspondant hors couverture voyait ses envois échouer
 * les uns après les autres sans comprendre pourquoi, et recommençait — ce qui
 * consommait son forfait sans rien envoyer.
 */
export default function OfflineBanner({ queuedCount = 0 }) {
  const { t } = useI18n();

  return (
    <div className="motion-rise mb-4 rounded-2xl border border-[var(--signal)]/40 bg-[var(--signal)]/10 p-4">
      <p className="flex items-center gap-2 font-bold text-sm text-[color:var(--ink)]">
        <WifiOff size={17} className="shrink-0 text-[var(--signal)]" />
        {t.uploader.offlineTitle}
      </p>
      <p className="mt-1.5 text-sm text-[color:var(--ink)]/80">{t.uploader.offlineText}</p>
      {queuedCount > 0 && (
        <p className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-[var(--paper)] px-3 py-2 text-xs font-bold text-[color:var(--ink)]">
          <Clock size={14} className="shrink-0" />
          {t.uploader.offlineQueued(queuedCount)}
        </p>
      )}
    </div>
  );
}
