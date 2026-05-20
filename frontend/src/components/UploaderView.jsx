import { useState, useEffect } from 'react';
import {
  UploadCloud, Folder, FileText, Video,
  CheckCircle, Clock, ChevronRight, Trash2, AlertCircle,
} from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute } from '../lib/dates.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import SkeletonCard from './SkeletonCard.jsx';
import CountdownTimer from './CountdownTimer.jsx';

const FILE_ICONS = {
  video: { Icon: Video, color: 'text-blue-500', bg: 'bg-blue-100' },
  script: { Icon: FileText, color: 'text-amber-500', bg: 'bg-amber-100' },
};

export default function UploaderView({ country, weeks, selectedWeek, setSelectedWeek, onBack }) {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState([]);
  const [reportageCount, setReportageCount] = useState(1);
  const [scriptText, setScriptText] = useState({});
  const [dragActive, setDragActive] = useState({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);

  useEffect(() => {
    if (!selectedWeek) return;
    setIsLoadingUploads(true);
    api.getUploads(selectedWeek, country.id)
      .then(setUploads)
      .catch(console.error)
      .finally(() => setIsLoadingUploads(false));
  }, [selectedWeek, country.id]);

  const handleFiles = (filesList, reportageName) => {
    Array.from(filesList).forEach((file) => {
      const tempId = Math.random().toString(36).slice(2);
      setUploading((prev) => [
        ...prev,
        { id: tempId, name: file.name, progress: 0, status: 'uploading', reportage: reportageName },
      ]);

      api
        .uploadFile(selectedWeek, country.id, file, {
          reportage: reportageName,
          onProgress: (pct) => {
            setUploading((prev) =>
              prev.map((f) =>
                f.id === tempId ? { ...f, progress: Math.min(pct, 99) } : f
              )
            );
          },
        })
        .then((result) => {
          setUploading((prev) =>
            prev.map((f) =>
              f.id === tempId ? { ...f, progress: 100, status: 'completed' } : f
            )
          );
          setUploads((prev) => [...prev, result]);
          addToast(t.uploader.uploadSuccess(result.name), 'success', 3000);
        })
        .catch((err) => {
          setUploading((prev) =>
            prev.map((f) =>
              f.id === tempId
                ? { ...f, progress: 0, status: 'error', error: err.message }
                : f
            )
          );
          addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
        });
    });
  };

  const handleDrag = (e, reportageName) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive((prev) => ({ ...prev, [reportageName]: e.type === 'dragenter' || e.type === 'dragover' }));
  };

  const handleDrop = (e, reportageName) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive((prev) => ({ ...prev, [reportageName]: false }));
    if (e.dataTransfer.files?.[0]) handleFiles(e.dataTransfer.files, reportageName);
  };

  const handleScriptSubmit = async (reportageName) => {
    const text = scriptText[reportageName] || '';
    if (!text.trim()) return;
    try {
      const result = await api.submitScript(selectedWeek, country.id, text, reportageName);
      setUploads((prev) => [...prev, result]);
      setScriptText((prev) => ({ ...prev, [reportageName]: '' }));
      addToast(t.uploader.scriptSuccess, 'success', 3000);
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
    }
  };

  const openDeleteDialog = (file) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteFile(selectedWeek, country.id, fileToDelete.id);
      setUploads((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      addToast(t.uploader.deleted(fileToDelete.name), 'success', 3000);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <button onClick={onBack} type="button" className="btn btn-ghost border border-[var(--border)]">
          {t.uploader.back}
        </button>
        <ChevronRight size={16} className="text-[color:var(--muted)]" />
        <span className="font-semibold text-2xl text-[color:var(--ink)] flex items-center gap-2">
          {country.name}
          <span className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)]">
            {country.code}
          </span>
        </span>
      </div>

      <div className="panel p-5 flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="font-semibold text-[color:var(--ink)]">{t.uploader.weekTitle}</h3>
          <p className="text-sm text-[color:var(--muted)]">{t.uploader.weekSubtitle}</p>
        </div>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="bg-[var(--paper)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-full px-4 py-2 font-medium"
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.dates}){w.status === 'active' ? t.uploader.weekActiveTag : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedWeek && (
        <CountdownTimer week={weeks.find(w => w.id === selectedWeek)} />
      )}

      <div className="panel p-5 flex flex-wrap items-center justify-between gap-4 mb-8 border-l-4 border-l-[color:var(--accent)]">
        <h3 className="font-semibold text-[color:var(--ink)]">{t.uploader.reportageCountTitle}</h3>
        <select
          value={reportageCount}
          onChange={(e) => setReportageCount(Number(e.target.value))}
          className="bg-[var(--paper)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-lg px-4 py-2 font-medium"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {[...Array(reportageCount)].map((_, i) => {
        const reportageName = t.uploader.reportageName(i + 1);
        const repUploads = uploads.filter(u => u.reportage === reportageName || (!u.reportage && i === 0));
        const repUploading = uploading.filter(u => u.reportage === reportageName);
        const isDragActive = dragActive[reportageName];

        return (
          <div key={i} className="mb-12 bg-black/5 dark:bg-white/5 p-6 sm:p-8 rounded-3xl border border-[var(--border)]">
            <h2 className="text-2xl font-bold mb-6 text-[color:var(--ink)] flex items-center gap-2">
              <span className="bg-[var(--accent)] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">{i + 1}</span>
              {reportageName}
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8">
              <div className="space-y-6">
                <div
                  className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-colors ${
                    isDragActive
                      ? 'border-[color:var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)] bg-[var(--paper)] hover:border-[color:var(--accent)]'
                  }`}
                  onDragEnter={(e) => handleDrag(e, reportageName)}
                  onDragLeave={(e) => handleDrag(e, reportageName)}
                  onDragOver={(e) => handleDrag(e, reportageName)}
                  onDrop={(e) => handleDrop(e, reportageName)}
                >
                  <UploadCloud className={`mx-auto h-14 w-14 mb-4 transition-transform duration-200 ${
                    isDragActive ? 'text-[color:var(--accent-deep)] scale-[1.05]' : 'text-[color:var(--muted)]'
                  }`} />
                  <h3 className="text-lg font-semibold text-[color:var(--ink)] mb-2">
                    {t.uploader.dropTitle}
                  </h3>
                  <p className="text-[color:var(--muted)] text-sm mb-6">
                    {t.uploader.dropHint}
                  </p>
                  <label className="btn btn-primary cursor-pointer">
                    {t.uploader.browse}
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => e.target.files && handleFiles(e.target.files, reportageName)}
                    />
                  </label>
                </div>

                <div className="panel p-6">
                  <h3 className="font-semibold text-[color:var(--ink)] mb-3 flex items-center gap-2">
                    <FileText size={18} className="text-[color:var(--signal)]" />
                    {t.uploader.scriptTitle}
                  </h3>
                  <textarea
                    className="w-full border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[color:var(--accent)] outline-none mb-3 bg-[var(--paper)]"
                    rows="4"
                    placeholder={t.uploader.scriptPh}
                    value={scriptText[reportageName] || ''}
                    onChange={(e) => setScriptText(prev => ({ ...prev, [reportageName]: e.target.value }))}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleScriptSubmit(reportageName)}
                      disabled={!(scriptText[reportageName] || '').trim()}
                      type="button"
                      className="btn btn-primary disabled:opacity-50"
                    >
                      {t.uploader.scriptSubmit}
                    </button>
                  </div>
                </div>

                {repUploading.length > 0 && (
                  <div className="panel p-6">
                    <h3 className="font-semibold text-[color:var(--ink)] mb-4">{t.uploader.transfers}</h3>
                    <div className="space-y-4">
                      {repUploading.map((f) => (
                        <div key={f.id} className="bg-[var(--paper)] p-3 rounded-2xl border border-[var(--border)]">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium text-[color:var(--ink)] truncate pr-4">{f.name}</span>
                            {f.status === 'completed' && (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle size={14} /> {t.uploader.done}
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
                                  ? 'bg-emerald-500'
                                  : f.status === 'error'
                                  ? 'bg-red-400'
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

              <div className="panel p-6 h-fit bg-[var(--paper)]">
                <div className="flex items-center gap-2 mb-6">
                  <Folder className="text-[color:var(--muted)]" />
                  <h3 className="font-semibold text-[color:var(--ink)]">
                    {reportageName}
                  </h3>
                </div>

                {isLoadingUploads ? (
                  <SkeletonCard count={2} />
                ) : repUploads.length === 0 ? (
                  <div className="text-center text-[color:var(--muted)] py-8 flex flex-col items-center">
                    <Clock size={32} className="text-[color:var(--muted)] mb-2" />
                    <p className="text-sm">{t.uploader.noFiles}</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {repUploads.map((file) => {
                      const { Icon, color, bg } = FILE_ICONS[file.type] || FILE_ICONS.script;
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
                                    {t.uploader.uploadedAt} {formatRelative(file.uploadedAt, lang)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => openDeleteDialog(file)}
                            type="button"
                            className="text-[color:var(--muted)] hover:text-red-500 p-1 rounded transition-colors"
                            title={t.dashboard.delete}
                          >
                            <Trash2 size={15} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title={t.uploader.deleteTitle}
        message={t.uploader.deleteMsg(fileToDelete?.name || '')}
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
