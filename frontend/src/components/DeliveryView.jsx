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
  const [uploading, setUploading] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    api.getDeliveries(selectedWeek)
      .then(setDeliveries)
      .catch((err) => {
        console.error(err);
        addToast(err.message || t.uploader.errorPrefix, 'error', 3000);
      })
      .finally(() => setLoading(false));

    api.getSubscriptions(selectedWeek)
      .then(setSubscriptions)
      .catch(console.error);
  }, [selectedWeek, addToast, t.uploader.errorPrefix]);

  const whatsappMessage = t.delivery.whatsappMessage || 'Le JT ALWM est prêt ! Vous pouvez le télécharger sur la plateforme.';

  const handleFiles = (filesList) => {
    Array.from(filesList).forEach((file) => {
      const tempId = Math.random().toString(36).slice(2);
      setUploading((prev) => [
        ...prev,
        { id: tempId, name: file.name, progress: 0, status: 'uploading' },
      ]);

      api.uploadDelivery(selectedWeek, file, {
        onProgress: (pct) =>
          setUploading((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, progress: Math.min(pct, 99) } : f))
          ),
      })
        .then((result) => {
          setUploading((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, progress: 100, status: 'completed' } : f))
          );
          setDeliveries((prev) => [...prev, result]);
          addToast(t.delivery.uploadSuccess(result.name), 'success', 3000);
        })
        .catch((err) => {
          setUploading((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, progress: 0, status: 'error', error: err.message } : f))
          );
          addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
        });
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFiles(e.dataTransfer.files);
  };

  const openDeleteDialog = (file) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteDelivery(selectedWeek, fileToDelete.id);
      setDeliveries((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      addToast(t.delivery.deleted(fileToDelete.name), 'success', 3000);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
    } finally {
      setIsDeleting(false);
    }
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8">
        {/* Zone d'upload */}
        <div className="space-y-6">
          <div
            id="tour-delivery-dropzone"
            className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-colors ${
              dragActive
                ? 'border-[color:var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] bg-[var(--paper)] hover:border-[color:var(--accent)]'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <UploadCloud className={`mx-auto h-14 w-14 mb-4 transition-transform duration-200 ${
              dragActive ? 'text-[color:var(--accent-deep)] scale-[1.05]' : 'text-[color:var(--muted)]'
            }`} />
            <h3 className="text-lg font-semibold text-[color:var(--ink)] mb-2">
              {t.delivery.dropTitle}
            </h3>
            <p className="text-[color:var(--muted)] text-sm mb-6">
              {t.delivery.dropHint}
            </p>
            <div className="flex gap-4 justify-center">
              <label className="btn btn-primary cursor-pointer">
                {t.delivery.browse}
                <input
                  type="file"
                  className="hidden"
                  aria-label={t.delivery.browseAria}
                  multiple
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </label>
              <label className="btn btn-primary cursor-pointer">
                {t.delivery.browseFolder}
                <input
                  type="file"
                  className="hidden"
                  aria-label={t.delivery.browseFolderAria}
                  multiple
                  webkitdirectory="true"
                  directory="true"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </label>
            </div>
          </div>

          {uploading.length > 0 && (
            <div className="panel p-6">
              <h3 className="font-semibold text-[color:var(--ink)] mb-4">{t.delivery.transfers}</h3>
              <div className="space-y-4">
                {uploading.map((f) => (
                  <div key={f.id} className="bg-[var(--paper)] p-3 rounded-2xl border border-[var(--border)]">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-[color:var(--ink)] truncate pr-4">{f.name}</span>
                      {f.status === 'completed' && (
                        <span className="text-[var(--accent)] flex items-center gap-1">
                          <CheckCircle size={14} /> {t.delivery.done}
                        </span>
                      )}
                      {f.status === 'error' && (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertCircle size={14} /> {f.error}
                        </span>
                      )}
                      {f.status === 'uploading' && (
                        <span className="text-[color:var(--accent-deep)]">{Math.round(f.progress)}%</span>
                      )}
                    </div>
                    <div className="w-full bg-[var(--paper-2)] rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          f.status === 'completed'
                            ? 'bg-[var(--accent)]'
                            : f.status === 'error'
                            ? 'bg-[var(--signal)]'
                            : 'bg-[color:var(--accent)]'
                        }`}
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
                        href={`${API_BASE}/uploads/${file.filename}`}
                        download={file.name}
                        className="text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/10 p-1.5 rounded-lg"
                        title={t.delivery.downloadFile}
                      >
                        <Download size={16} />
                      </a>
                      <button
                        onClick={() => openDeleteDialog(file)}
                        type="button"
                        className="text-[color:var(--muted)] hover:text-red-500 p-1.5 rounded-lg"
                        title={t.delivery.delete}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* WhatsApp Notifier Buttons */}
          {deliveries.length > 0 && subscriptions.length > 0 && (
            <div id="tour-delivery-whatsapp" className="mt-8 pt-6 border-t border-[var(--border)]">
              <h4 className="font-semibold text-sm text-[color:var(--ink)] mb-3 flex items-center gap-2">
                <MessageCircle size={16} className="text-[#25D366]" />
                {t.delivery.notifyAll ? t.delivery.notifyAll(subscriptions.length) : `Notifier ${subscriptions.length} journaliste(s)`}
              </h4>
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
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title={t.delivery.deleteTitle}
        message={t.delivery.deleteMsg(fileToDelete?.name || '')}
        confirmText={t.uploader.deleteConfirm}
        cancelText={t.uploader.cancel}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setFileToDelete(null);
        }}
      />
    </div>
  );
}
