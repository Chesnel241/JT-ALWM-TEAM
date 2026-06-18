import { useState, useEffect } from 'react';
import {
  UploadCloud, Download, Trash2, Sparkles, Video, FileText, Music,
  CheckCircle, AlertCircle, MessageCircle
} from 'lucide-react';
import { api, API_BASE } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute, formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import SkeletonCard from './SkeletonCard.jsx';

const FILE_ICONS = {
  video: { Icon: Video, color: 'text-blue-500', bg: 'bg-blue-100' },
  audio: { Icon: Music, color: 'text-purple-500', bg: 'bg-purple-100' },
  document: { Icon: FileText, color: 'text-amber-500', bg: 'bg-amber-100' },
};

export default function DeliveryView({ weeks, selectedWeek, setSelectedWeek }) {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);

  useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    api.getDeliveries(selectedWeek)
      // Garde-fou : une réponse non-array (404/objet d'erreur) ferait
      // crasher deliveries.map → écran blanc. On force un tableau.
      .then((d) => setDeliveries(Array.isArray(d) ? d : []))
      .catch((err) => {
        console.error(err);
        setDeliveries([]);
        addToast(err.message || t.uploader.errorPrefix, 'error', 3000);
      })
      .finally(() => setLoading(false));

    api.getSubscriptions(selectedWeek)
      .then((s) => setSubscriptions(Array.isArray(s) ? s : []))
      .catch(() => setSubscriptions([]));
  }, [selectedWeek, addToast, t.uploader.errorPrefix]);

  const whatsappMessage = t.delivery.whatsappMessage || 'Le JT ALWM est prêt ! Vous pouvez le télécharger sur la plateforme.';

  const week = weeks.find((w) => w.id === selectedWeek);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
        <div>
          <div className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)] mb-3 inline-flex items-center gap-1">
            <Sparkles size={14} /> {t.nav.delivery}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold text-[color:var(--ink)] mb-2">
            {t.delivery.title}
          </h2>
          <p className="text-[color:var(--muted)] max-w-2xl">{t.delivery.subtitle}</p>
        </div>
        <div className="panel p-2 flex items-center gap-3">
          <label className="sr-only" htmlFor="delivery-week">
            {t.delivery.weekLabel}
          </label>
          <select
            id="delivery-week"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-[var(--paper)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-full px-4 py-2 font-semibold focus:ring-0 cursor-pointer"
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {formatWeekLabel(w, lang)} ({formatWeekDates(w, lang)}){w.status === 'active' ? t.uploader.weekActiveTag : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)] gap-8">
        {/* Liste des deliveries */}
        <div id="tour-delivery-list" className="panel p-6 h-fit">
          <div className="flex items-center justify-between gap-2 mb-6">
            <h3 className="font-semibold text-[color:var(--ink)] flex items-center gap-2">
              <Sparkles size={18} className="text-[color:var(--accent-deep)]" />
              {week ? formatWeekLabel(week, lang) : ''}
            </h3>
            {deliveries.length > 0 && (
              <span className="badge bg-[var(--accent)]/10 text-[var(--accent)]">
                {t.delivery.published}
              </span>
            )}
          </div>

          {loading ? (
            <SkeletonCard count={2} />
          ) : deliveries.length === 0 ? (
            <div className="text-center text-[color:var(--muted)] py-8 flex flex-col items-center">
              <Sparkles size={32} className="text-[color:var(--muted)] mb-3" />
              <p className="text-sm font-medium text-[color:var(--ink)]">{t.delivery.empty}</p>
              <p className="text-xs mt-2 max-w-xs">{t.delivery.emptyHint}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {deliveries.map((file) => {
                const { Icon, color, bg } = FILE_ICONS[file.type] || FILE_ICONS.document;
                return (
                  <li
                    key={file.id}
                    className="bg-[var(--paper)] p-3 rounded-2xl border border-[var(--border)] flex items-start gap-3"
                  >
                    <div className={`p-2 rounded-md ${bg}`}>
                      <Icon size={18} className={color} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-[color:var(--ink)] truncate">{file.name}</p>
                      <p className="text-xs text-[color:var(--muted)] flex items-center gap-2 flex-wrap">
                        <span>{file.size}</span>
                        {file.uploadedAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span title={formatAbsolute(file.uploadedAt, lang)}>
                              {t.delivery.uploadedAt} {formatRelative(file.uploadedAt, lang)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <a
                        href={`${API_BASE}/uploads/${encodeURIComponent(file.filename)}?dl=1`}
                        download={file.name}
                        className="text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/10 p-1.5 rounded-lg"
                        title={t.delivery.downloadFile}
                      >
                        <Download size={16} />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* WhatsApp Notifier Buttons */}
          <div id="tour-delivery-whatsapp" className="mt-8 pt-6 border-t border-[var(--border)]">
            <h4 className="font-semibold text-sm text-[color:var(--ink)] mb-3 flex items-center gap-2">
              <MessageCircle size={16} className="text-[#25D366]" />
              {t.delivery.notifyAll ? t.delivery.notifyAll(subscriptions.length || 0) : `Notifier ${subscriptions.length || 0} journaliste(s)`}
            </h4>
            {deliveries.length > 0 && subscriptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subscriptions.map((sub, idx) => (
                  <a
                    key={idx}
                    href={`https://wa.me/${sub.phone}?text=${encodeURIComponent(whatsappMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs font-medium rounded-full transition-colors"
                  >
                    <MessageCircle size={12} />
                    {sub.countryId.toUpperCase()} ({sub.phone})
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[color:var(--muted)]">Les boutons de notification apparaîtront ici lorsqu'un reportage sera publié et que des journalistes seront abonnés.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
