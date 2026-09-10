import { useState, useEffect } from 'react';
import {
  UploadCloud, Download, Trash2, Sparkles, Video, FileText, Music,
  CheckCircle, AlertCircle, MessageCircle, Play, X, ExternalLink
} from 'lucide-react';
import { api, API_BASE } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute, formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import SkeletonCard from './SkeletonCard.jsx';

// Charte : bleus du logo et neutres, avec un texte à fort contraste sur
// chaque aplat (le bleu 500 sur bleu 100 précédent était illisible).
const FILE_ICONS = {
  video: { Icon: Video, color: 'text-[color:var(--accent-deep)]', bg: 'bg-[var(--accent)]/10' },
  image: { Icon: Video, color: 'text-[color:var(--accent-deep)]', bg: 'bg-[var(--accent-soft)]/25' },
  audio: { Icon: Music, color: 'text-[color:var(--accent-deep)]', bg: 'bg-[var(--accent-soft)]/25' },
  document: { Icon: FileText, color: 'text-[color:var(--ink)]', bg: 'bg-[var(--paper-2)]' },
};

// `audience` : le même écran sert les deux équipes. Côté montage il porte
// l'outil de notification des correspondants ; côté journalistes ce bloc
// disparaît — un correspondant n'a pas à voir les numéros WhatsApp de ses
// confrères — et l'état vide dit d'attendre le JT plutôt que de le publier.
export default function DeliveryView({ weeks, selectedWeek, setSelectedWeek, audience = 'editor' }) {
  const { t, lang } = useI18n();
  const isReporterAudience = audience === 'reporter';
  const showNotifyPanel = !isReporterAudience;
  const emptyHint = isReporterAudience
    ? (t.delivery.emptyHintReporter || t.delivery.emptyHint)
    : t.delivery.emptyHint;
  const { addToast } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [previewVideo, setPreviewVideo] = useState(null);

  useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    api.getDeliveries(selectedWeek)
      .then((d) => setDeliveries(Array.isArray(d) ? d : []))
      .catch((err) => {
        console.error(err);
        setDeliveries([]);
        addToast(err.message || t.uploader.errorPrefix, 'error', 3000);
      })
      .finally(() => setLoading(false));

    if (!showNotifyPanel) {
      setSubscriptions([]);
      return;
    }
    api.getSubscriptions(selectedWeek)
      .then((s) => setSubscriptions(Array.isArray(s) ? s : []))
      .catch(() => setSubscriptions([]));
  }, [selectedWeek, addToast, t.uploader.errorPrefix, showNotifyPanel]);

  const whatsappMessage = t.delivery.whatsappMessage || 'Le JT ALWM est prêt ! Vous pouvez le télécharger sur la plateforme.';
  const week = weeks.find((w) => w.id === selectedWeek);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      
      {/* ================================================================ */}
      {/* VIDEO PREVIEW MODAL (Streaming)                                  */}
      {/* ================================================================ */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--paper)] rounded-3xl border border-[var(--border)] max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-2">
                <Video size={18} className="text-[var(--accent)] shrink-0" />
                <span className="font-bold text-sm text-[color:var(--ink)] truncate">{previewVideo.name}</span>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-full bg-[var(--paper-2)] text-[color:var(--muted)] hover:text-[color:var(--ink)] active:scale-95"
              >
                <X size={18} />
              </button>
            </div>
            <div className="bg-black aspect-video flex items-center justify-center">
              <video
                src={`${API_BASE}/uploads/${encodeURIComponent(previewVideo.filename)}`}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-3 bg-[var(--paper-2)] flex items-center justify-between gap-2">
              <span className="text-xs text-[color:var(--muted)] font-medium">{previewVideo.size}</span>
              <a
                href={`${API_BASE}/uploads/${encodeURIComponent(previewVideo.filename)}?dl=1`}
                download={previewVideo.name}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                <Download size={13} /> Télécharger
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MOBILE VIEW (md:hidden)                                          */}
      {/* ================================================================ */}
      <div className="md:hidden space-y-4 pb-12">
        {/* Top Header Card */}
        <div className="p-4 bg-[var(--paper)] rounded-3xl border border-[var(--border)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[color:var(--accent-deep)] text-xs font-bold">
              <Sparkles size={13} /> {t.nav.delivery}
            </div>
            {deliveries.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[var(--success)]/12 text-[color:var(--success-deep)] border border-[var(--success)]/30">
                DISPONIBLE
              </span>
            )}
          </div>

          <h2 className="text-xl font-black text-[color:var(--ink)]">
            {t.delivery.title}
          </h2>

          {/* Week Selector */}
          <div className="p-2.5 bg-[var(--paper-2)] rounded-2xl border border-[var(--border)] flex items-center justify-between gap-2">
            <span className="shrink-0 text-xs font-semibold text-[color:var(--muted)]">Semaine</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="min-w-0 flex-1 truncate bg-transparent border-0 text-right text-[color:var(--ink)] text-xs font-bold outline-none cursor-pointer"
            >
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {formatWeekLabel(w, lang)}{w.status === 'active' ? ' • EN COURS' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Deliveries List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Fichiers JT Prêts ({deliveries.length})
            </span>
          </div>

          {loading ? (
            <SkeletonCard count={2} />
          ) : deliveries.length === 0 ? (
            <div className="p-8 bg-[var(--paper)] rounded-3xl border border-[var(--border)] text-center space-y-2">
              <Sparkles size={32} className="mx-auto text-[color:var(--muted)] opacity-50" />
              <p className="font-bold text-sm text-[color:var(--ink)]">{t.delivery.empty}</p>
              <p className="text-xs text-[color:var(--muted)]">{emptyHint}</p>
            </div>
          ) : (
            deliveries.map((file) => {
              const isVideo = file.type === 'video' || file.name.endsWith('.mp4');
              return (
                <div
                  key={`mob-deliv-${file.id}`}
                  className="p-4 bg-[var(--paper)] rounded-3xl border border-[var(--border)] shadow-sm space-y-3.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] flex items-center justify-center shrink-0">
                      <Video size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-[color:var(--ink)] truncate" title={file.name}>
                        {file.name}
                      </h4>
                      <p className="text-xs text-[color:var(--muted)] mt-0.5 flex items-center gap-1.5">
                        <span>{file.size}</span>
                        {file.uploadedAt && (
                          <>
                            <span>•</span>
                            <span>{formatRelative(file.uploadedAt, lang)}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {isVideo && (
                      <button
                        onClick={() => setPreviewVideo(file)}
                        className="py-2.5 px-3 rounded-2xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <Play size={14} className="fill-current" />
                        <span>Regarder</span>
                      </button>
                    )}
                    <a
                      href={`${API_BASE}/uploads/${encodeURIComponent(file.filename)}?dl=1`}
                      download={file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`py-2.5 px-3 rounded-2xl bg-[var(--accent)] text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-[var(--accent)]/30 transition-transform ${
                        !isVideo ? 'col-span-2' : ''
                      }`}
                    >
                      <Download size={14} />
                      <span>Télécharger</span>
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* WhatsApp Notification Hub */}
        {showNotifyPanel && (
        <div className="p-4 bg-[var(--paper)] rounded-3xl border border-[var(--border)] shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-[#25D366]" />
            <h4 className="font-bold text-xs text-[color:var(--ink)]">
              {t.delivery.notifyAll ? t.delivery.notifyAll(subscriptions.length || 0) : `WhatsApp (${subscriptions.length || 0})`}
            </h4>
          </div>

          {deliveries.length > 0 && subscriptions.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {subscriptions.map((sub, idx) => (
                <a
                  key={`mob-sub-${idx}`}
                  href={`https://wa.me/${sub.phone}?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs font-bold rounded-xl active:scale-95 transition-transform"
                >
                  <MessageCircle size={12} />
                  <span>{sub.countryId.toUpperCase()}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[color:var(--muted)] leading-relaxed">
              Les correspondants inscrits aux alertes WhatsApp apparaîtront ici dès publication du JT.
            </p>
          )}
        </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* DESKTOP VIEW (hidden md:block) — UNCHANGED                       */}
      {/* ================================================================ */}
      <div className="hidden md:block">
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
                <p className="text-xs mt-2 max-w-xs">{emptyHint}</p>
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
                        <p className="text-sm font-medium text-[color:var(--ink)] truncate flex items-center gap-2">
                          <span>{file.name}</span>
                          {file.isLate && (
                            <span className="text-[10px] bg-[var(--signal)] text-white px-2 py-0.5 rounded-full font-bold">
                              EN RETARD
                            </span>
                          )}
                        </p>
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
                          target="_blank"
                          rel="noopener noreferrer"
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

            {showNotifyPanel && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

