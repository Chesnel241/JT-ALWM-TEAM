import { useState, useEffect } from 'react';
import { Folder, FileText, Video, Download, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { api, API_BASE } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute, formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import SkeletonCard from './SkeletonCard.jsx';

export default function DashboardView({ weeks, selectedWeek, setSelectedWeek, countries }) {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const [dashboard, setDashboard] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewingScript, setViewingScript] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback State
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [fileToFeedback, setFileToFeedback] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    api.getDashboard(selectedWeek)
      .then(setDashboard)
      .catch((err) => {
        console.error(err);
        addToast(t.uploader.errorPrefix, 'error', 3000);
      })
      .finally(() => setLoading(false));
  }, [selectedWeek, addToast, t.uploader.errorPrefix]);

  const openDeleteDialog = (countryId, fileId) => {
    const file = dashboard[countryId]?.find(f => f.id === fileId);
    if (file) {
      setFileToDelete({ countryId, fileId, fileName: file.name });
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteFile(selectedWeek, fileToDelete.countryId, fileToDelete.fileId);
      setDashboard((prev) => ({
        ...prev,
        [fileToDelete.countryId]: prev[fileToDelete.countryId].filter((f) => f.id !== fileToDelete.fileId),
      }));
      addToast(t.uploader.deleted(fileToDelete.fileName), 'success', 3000);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const openFeedbackDialog = (countryId, fileId, status) => {
    const file = dashboard[countryId]?.find(f => f.id === fileId);
    if (file) {
      setFileToFeedback({ countryId, fileId, fileName: file.name });
      setFeedbackStatus(status);
      setFeedbackText(file.feedback || '');
      setFeedbackDialogOpen(true);
    }
  };

  const handleConfirmFeedback = async () => {
    if (!fileToFeedback) return;
    setIsSubmittingFeedback(true);
    try {
      await api.updateFileStatus(selectedWeek, fileToFeedback.countryId, fileToFeedback.fileId, feedbackStatus, feedbackText);
      setDashboard((prev) => ({
        ...prev,
        [fileToFeedback.countryId]: prev[fileToFeedback.countryId].map((f) => 
          f.id === fileToFeedback.fileId ? { ...f, status: feedbackStatus, feedback: feedbackText } : f
        ),
      }));
      addToast(`Statut mis à jour`, 'success', 3000);
      setFeedbackDialogOpen(false);
      setFileToFeedback(null);
      setFeedbackText('');
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const countriesWithUploads = Object.keys(dashboard).filter(
    (id) => dashboard[id]?.length > 0
  );

  const renderUploadMeta = (file) => (
    <span
      className="text-[10px] text-[color:var(--muted)] mt-0.5 block"
      title={formatAbsolute(file.uploadedAt, lang)}
    >
      {file.size}
      {file.uploadedAt && (
        <> · {t.dashboard.uploadedAt} {formatRelative(file.uploadedAt, lang)}</>
      )}
    </span>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
        <div>
          <div className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)] mb-3">{t.nav.editing}</div>
          <h2 className="text-3xl md:text-4xl font-semibold text-[color:var(--ink)] mb-2">{t.dashboard.title}</h2>
        </div>
        <div className="panel p-2 flex items-center gap-3">
          <label className="sr-only" htmlFor="dashboard-week">
            {t.dashboard.weekLabel}
          </label>
          <select
            id="dashboard-week"
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

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard count={3} />
        </div>
      ) : countriesWithUploads.length === 0 ? (
        <div className="panel border-2 border-dashed p-12 text-center">
          <Folder className="mx-auto h-16 w-16 text-[color:var(--muted)] mb-4" />
          <h3 className="text-xl font-medium text-[color:var(--ink)]">{t.dashboard.noUploads}</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {countriesWithUploads.map((countryId) => {
            const country = countries.find((c) => c.id === countryId);
            const files = dashboard[countryId];
            const videos = files.filter((f) => f.type === 'video');
            const scripts = files.filter((f) => f.type === 'script');

            return (
              <div
                key={countryId}
                className="panel overflow-hidden"
              >
                <div className="bg-[var(--paper)] border-b border-[var(--border)] p-4 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 flex items-center justify-center font-bold text-sm text-[color:var(--accent-deep)]">
                      {country?.code}
                    </div>
                    <span className="font-semibold text-[color:var(--ink)]">{country?.name}</span>
                  </div>
                  <span className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)]">
                    {files.length}
                  </span>
                </div>

                <div className="p-4 flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4">
                  {videos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Video size={12} /> {t.dashboard.videos}
                      </h4>
                      <ul className="space-y-2">
                        {videos.map((file) => (
                          <li
                            key={file.id}
                            className="flex justify-between items-center text-sm bg-[var(--paper)] p-2 rounded-2xl border border-[var(--border)]"
                          >
                            <div className="flex-1 overflow-hidden pr-2">
                              <span className="truncate font-medium text-[color:var(--ink)] block">{file.name}</span>
                              {renderUploadMeta(file)}
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => openFeedbackDialog(countryId, file.id, 'approved')}
                                  className={`p-1 rounded transition-colors ${file.status === 'approved' ? 'text-emerald-500 bg-emerald-50' : 'text-[color:var(--muted)] hover:text-emerald-500'}`}
                                  title="Approuver"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => openFeedbackDialog(countryId, file.id, 'rejected')}
                                  className={`p-1 rounded transition-colors ${file.status === 'rejected' ? 'text-red-500 bg-red-50' : 'text-[color:var(--muted)] hover:text-red-500'}`}
                                  title="Rejeter (Commentaire)"
                                >
                                  <XCircle size={16} />
                                </button>
                                <a
                                  href={`${API_BASE}/uploads/${file.filename}`}
                                  download={file.name}
                                  className="text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/10 p-1 rounded"
                                  title={t.dashboard.downloadFile}
                                >
                                  <Download size={16} />
                                </a>
                              <button
                                onClick={() => openDeleteDialog(countryId, file.id)}
                                className="text-[color:var(--muted)] hover:text-red-500 p-1 rounded"
                                title={t.dashboard.delete}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {scripts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-[color:var(--muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileText size={12} /> {t.dashboard.scripts}
                      </h4>
                      <ul className="space-y-2">
                        {scripts.map((file) => (
                          <li
                            key={file.id}
                            className="flex justify-between items-center text-sm bg-[var(--signal)]/10 p-2 rounded-2xl border border-[var(--signal)]/30"
                          >
                            <div className="flex-1 overflow-hidden pr-2">
                              <span className="truncate font-medium text-[color:var(--ink)] block">{file.name}</span>
                              {renderUploadMeta(file)}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => setViewingScript(file)}
                                type="button"
                                className="text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/10 p-1 rounded px-2 text-xs font-medium"
                              >
                                {t.dashboard.read}
                              </button>
                                <button
                                  onClick={() => openFeedbackDialog(countryId, file.id, 'approved')}
                                  className={`p-1 rounded transition-colors ${file.status === 'approved' ? 'text-emerald-500 bg-emerald-50' : 'text-[color:var(--muted)] hover:text-emerald-500'}`}
                                  title="Approuver"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => openFeedbackDialog(countryId, file.id, 'rejected')}
                                  className={`p-1 rounded transition-colors ${file.status === 'rejected' ? 'text-red-500 bg-red-50' : 'text-[color:var(--muted)] hover:text-red-500'}`}
                                  title="Rejeter (Commentaire)"
                                >
                                  <XCircle size={16} />
                                </button>
                                <button
                                  onClick={() => openDeleteDialog(countryId, file.id)}
                                  type="button"
                                  className="text-[color:var(--muted)] hover:text-red-500 p-1 rounded"
                                  title={t.dashboard.delete}
                                >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-[var(--paper)] border-t border-[var(--border)] mt-auto flex justify-end">
                  <a
                    href={`${API_BASE}/api/uploads/${selectedWeek}/${countryId}/archive?pwd=${encodeURIComponent(localStorage.getItem('app-password') || '')}`}
                    download={`uploads_${selectedWeek}_${country?.code || countryId}.zip`}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Download size={16} />
                    {t.dashboard.downloadAll(country?.code)}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewingScript && (
        <div
          className="fixed inset-0 bg-[color:oklch(0.2_0.02_250_/_0.6)] flex items-center justify-center p-4 z-50"
          onClick={() => setViewingScript(null)}
          role="presentation"
        >
          <div
            className="panel w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="script-modal-title"
          >
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--paper)] rounded-t-2xl">
              <h3 id="script-modal-title" className="font-semibold text-[color:var(--ink)] flex items-center gap-2">
                <FileText className="text-[color:var(--signal)]" />
                {viewingScript.name}
              </h3>
              <button
                onClick={() => setViewingScript(null)}
                type="button"
                aria-label={t.common.close}
                className="text-[color:var(--muted)] hover:text-[color:var(--ink)] p-2 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-sm whitespace-pre-wrap text-[color:var(--ink)]">
              {viewingScript.content || t.dashboard.modalEmpty}
            </div>
            <div className="p-4 border-t border-[var(--border)] bg-[var(--paper)] flex justify-end">
              {viewingScript.filename && (
                <a
                  href={`${API_BASE}/uploads/${viewingScript.filename}`}
                  download={viewingScript.name}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Download size={16} /> {t.dashboard.modalDownload}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title={t.dashboard.deleteTitle}
        message={t.dashboard.deleteMsg(fileToDelete?.fileName || '')}
        confirmText={t.dashboard.deleteConfirm}
        cancelText={t.dashboard.cancel}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setFileToDelete(null);
        }}
      />

      <ConfirmDialog
        isOpen={feedbackDialogOpen}
        title={feedbackStatus === 'approved' ? 'Approuver le reportage' : 'Rejeter le reportage'}
        message={
          <div className="mt-2 text-left">
            <p className="text-[color:var(--muted)] mb-4">
              {feedbackStatus === 'approved' ? 'Confirmer la validation de ce reportage.' : 'Expliquez pourquoi ce reportage doit être corrigé ou renvoyé.'}
            </p>
            {feedbackStatus === 'rejected' && (
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Ex: Le son sature à 1:20, peux-tu refaire la prise ?"
                className="w-full px-4 py-3 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all min-h-[100px]"
              />
            )}
          </div>
        }
        confirmText={feedbackStatus === 'approved' ? 'Approuver' : 'Rejeter & Notifier'}
        cancelText="Annuler"
        variant={feedbackStatus === 'approved' ? 'primary' : 'danger'}
        isLoading={isSubmittingFeedback}
        onConfirm={handleConfirmFeedback}
        onCancel={() => {
          setFeedbackDialogOpen(false);
          setFileToFeedback(null);
        }}
      />
    </div>
  );
}
