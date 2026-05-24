import { useState, useEffect } from 'react';
import { Folder, FileText, Video, Download, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
  
  // Nouveaux états pour le mot de passe admin (sécurisation)
  const [adminPassword, setAdminPassword] = useState('');

  // Download State
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [fileToDownload, setFileToDownload] = useState(null);

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

  const openDownloadDialog = (file) => {
    setFileToDownload(file);
    setDownloadDialogOpen(true);
  };

  const handleConfirmDownload = () => {
    if (!fileToDownload) return;
    const isArchive = fileToDownload.filename.endsWith('/archive');
    const url = isArchive 
      ? `${API_BASE}/api/uploads/${fileToDownload.filename}?adminPassword=${encodeURIComponent(adminPassword)}&pwd=${encodeURIComponent(localStorage.getItem('app-password') || '')}`
      : `${API_BASE}/uploads/${fileToDownload.filename}?adminPassword=${encodeURIComponent(adminPassword)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileToDownload.name || fileToDownload.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadDialogOpen(false);
    setFileToDownload(null);
    setAdminPassword('');
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteFile(selectedWeek, fileToDelete.countryId, fileToDelete.fileId, adminPassword);
      setDashboard((prev) => ({
        ...prev,
        [fileToDelete.countryId]: prev[fileToDelete.countryId].filter((f) => f.id !== fileToDelete.fileId),
      }));
      addToast(t.uploader.deleted(fileToDelete.fileName), 'success', 3000);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      setAdminPassword('');
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
      await api.updateFileStatus(selectedWeek, fileToFeedback.fileId, feedbackStatus, feedbackText, adminPassword);
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
      setAdminPassword('');
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const countriesWithUploads = Object.keys(dashboard).filter(
    (id) => dashboard[id]?.length > 0 || id === 'tj'
  );

  const [selectedBin, setSelectedBin] = useState(null);

  useEffect(() => {
    if (countriesWithUploads.length > 0 && (!selectedBin || !countriesWithUploads.includes(selectedBin))) {
      setSelectedBin(countriesWithUploads[0]);
    }
  }, [dashboard, selectedBin, countriesWithUploads]);

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
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 h-screen flex flex-col">
      <div className="flex flex-col md:flex-row flex-1 border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden bg-[var(--app-bg)] min-h-0">
        
        {/* Sidebar Bins */}
        <aside className="w-full md:w-64 bg-[var(--paper-2)] border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--paper)]">
            <div className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)] mb-2 inline-block">{t.nav.editing}</div>
            <h2 className="text-xl font-bold text-[color:var(--ink)]">{t.dashboard.title}</h2>
          </div>
          
          <div className="p-4 flex-1">
            <h3 className="text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-wider mb-3 px-2">Chutiers (Pays)</h3>
            {loading ? (
              <div className="space-y-2">
                <SkeletonCard count={2} />
              </div>
            ) : countriesWithUploads.length === 0 ? (
              <div className="p-4 text-sm text-[color:var(--muted)] text-center">Aucun fichier déposé pour l'instant.</div>
            ) : (
              <div className="space-y-1">
                {countriesWithUploads.map(countryId => {
                  const country = countries.find((c) => c.id === countryId);
                  const fileCount = dashboard[countryId].length;
                  const isActive = selectedBin === countryId;
                  return (
                    <button 
                      key={countryId}
                      onClick={() => setSelectedBin(countryId)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                        isActive 
                          ? 'bg-[var(--accent)]/10 text-[color:var(--accent-deep)] font-semibold' 
                          : 'text-[color:var(--muted)] hover:bg-[var(--paper)] hover:text-[color:var(--ink)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder size={16} className={isActive ? 'fill-current opacity-20' : ''} />
                        <span className="truncate">{country?.name || countryId}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-[var(--accent)]/20 text-[color:var(--accent-deep)]' : 'bg-[var(--border)] text-[color:var(--muted)]'}`}>
                        {fileCount}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--paper)]">
          {/* Top Toolbar */}
          <header className="p-4 bg-[var(--paper)] border-b border-[var(--border)] flex flex-wrap justify-between items-center gap-4 z-10 shrink-0">
            <div className="flex items-center gap-3">
              {selectedBin ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center font-bold text-xs text-[color:var(--accent-deep)]">
                    {countries.find(c => c.id === selectedBin)?.code}
                  </div>
                  <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                    {countries.find(c => c.id === selectedBin)?.name}
                  </h2>
                </>
              ) : (
                <h2 className="text-lg font-semibold text-[color:var(--muted)]">Media Pool</h2>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <label className="sr-only" htmlFor="dashboard-week">
                {t.dashboard.weekLabel}
              </label>
              <select
                id="dashboard-week"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-lg px-3 py-1.5 font-medium focus:ring-0 cursor-pointer"
              >
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatWeekLabel(w, lang)}{w.status === 'active' ? t.uploader.weekActiveTag : ''}
                  </option>
                ))}
              </select>

              {selectedBin && (
                selectedBin === 'mj' ? (
                  <button
                    onClick={() => openDownloadDialog({ filename: `${selectedWeek}/mj/archive`, name: `uploads_${selectedWeek}_mj.zip` })}
                    className="btn btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5"
                  >
                    <Download size={14} /> {t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code)}
                  </button>
                ) : (
                  <a
                    href={`${API_BASE}/api/uploads/${selectedWeek}/${selectedBin}/archive?pwd=${encodeURIComponent(localStorage.getItem('app-password') || '')}`}
                    download={`uploads_${selectedWeek}_${selectedBin}.zip`}
                    className="btn btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5"
                  >
                    <Download size={14} /> {t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code)}
                  </a>
                )
              )}
            </div>
          </header>

          {/* Media Grid */}
          <div className="p-6 overflow-y-auto flex-1 bg-[var(--paper-2)]">
            {!selectedBin ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[color:var(--muted)] pb-20">
                <Video size={48} className="mb-4 opacity-20" />
                <p>Sélectionnez un chutier pour voir les médias</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 content-start">
                {(dashboard[selectedBin] || []).length === 0 ? (
                  <div className="col-span-full h-full flex flex-col items-center justify-center text-center text-[color:var(--muted)] pb-20">
                    <Folder size={48} className="mb-4 opacity-20" />
                    <p>Aucun fichier dans ce chutier pour l'instant.</p>
                  </div>
                ) : (
                  (dashboard[selectedBin] || []).map(file => {
                    const isVideo = file.type === 'video';
                    return (
                      <div key={file.id} className="group flex flex-col gap-2">
                      {/* Thumbnail Box */}
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef] border border-[var(--border)] shadow-sm cursor-pointer flex items-center justify-center">
                        
                        {isVideo ? (
                        <>
                          <div className="absolute inset-0 flex items-center justify-center text-[color:var(--ink)]/10 z-0">
                            <Video size={48} />
                          </div>
                          <video 
                            src={`${API_BASE}/uploads/${file.filename}#t=0.1`} 
                            className="w-full h-full object-cover relative z-10 bg-transparent"
                            preload="metadata"
                            muted
                            playsInline
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </>
                      ) : (
                        <FileText className="text-[color:var(--signal)]/40 w-12 h-12 transition-transform duration-500 group-hover:scale-110 relative z-10" />
                      )}

                        {/* Status Badge */}
                        {file.status !== 'pending' && (
                          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md z-20 text-white ${
                            file.status === 'approved' ? 'bg-emerald-500/90' : 'bg-red-500/90'
                          }`}>
                            {file.status === 'approved' ? 'Approuvé' : 'Rejeté'}
                          </div>
                        )}

                        {/* Size Badge */}
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium backdrop-blur-md z-20">
                          {file.size}
                        </div>

                        {/* Hover Overlay with Action Toolbar */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center backdrop-blur-[2px] z-10 p-2">
                          {isVideo && (
                            <div className="w-10 h-10 mb-2 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-lg pointer-events-none">
                              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1"></div>
                            </div>
                          )}
                          {!isVideo && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setViewingScript(file); }}
                              className="w-10 h-10 mb-2 rounded-full bg-white/30 hover:bg-white/50 backdrop-blur-md flex items-center justify-center text-white shadow-lg transition-colors"
                              title="Lire le script"
                            >
                              <FileText size={18} />
                            </button>
                          )}
                          
                          {/* Hover Toolbar */}
                          <div className="flex items-center gap-1 bg-white/95 rounded-lg p-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openFeedbackDialog(selectedBin, file.id, 'approved')}
                              className={`p-1.5 rounded-lg transition-colors ${file.status === 'approved' ? 'text-emerald-500 bg-emerald-100' : 'text-gray-600 hover:text-emerald-500 hover:bg-emerald-50'}`}
                              title="Approuver"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => openFeedbackDialog(selectedBin, file.id, 'rejected')}
                              className={`p-1.5 rounded-lg transition-colors ${file.status === 'rejected' ? 'text-red-500 bg-red-100' : 'text-gray-600 hover:text-red-500 hover:bg-red-50'}`}
                              title="Rejeter (Commentaire)"
                            >
                              <XCircle size={16} />
                            </button>
                            
                            {selectedBin === 'mj' ? (
                              <button
                                onClick={() => openDownloadDialog(file)}
                                className="p-1.5 rounded-lg text-gray-600 hover:text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/10 transition-colors"
                                title={t.dashboard.downloadFile}
                              >
                                <Download size={16} />
                              </button>
                            ) : (
                              <a
                                href={`${API_BASE}/uploads/${file.filename}`}
                                download={file.name}
                                className="p-1.5 rounded-lg text-gray-600 hover:text-[color:var(--accent-deep)] hover:bg-[var(--accent)]/10 transition-colors block"
                                title={t.dashboard.downloadFile}
                              >
                                <Download size={16} />
                              </a>
                            )}
                            
                            <button
                              onClick={() => openDeleteDialog(selectedBin, file.id)}
                              type="button"
                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title={t.dashboard.delete}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Footer Meta */}
                      <div className="px-1 mt-1">
                        <div className="text-[13px] font-semibold text-[color:var(--ink)] truncate w-full" title={file.name}>
                          {file.name}
                        </div>
                        <div className="text-[10px] text-[color:var(--muted)] mt-0.5 truncate" title={file.uploadedAt ? formatAbsolute(file.uploadedAt, lang) : ''}>
                          {file.uploadedAt ? formatRelative(file.uploadedAt, lang) : ''}
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            )}
          </div>
        </main>
      </div>

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
                selectedBin === 'mj' ? (
                  <button
                    onClick={() => openDownloadDialog(viewingScript)}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Download size={16} /> {t.dashboard.modalDownload}
                  </button>
                ) : (
                  <a
                    href={`${API_BASE}/uploads/${viewingScript.filename}`}
                    download={viewingScript.name}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Download size={16} /> {t.dashboard.modalDownload}
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title={t.uploader.deleteTitle}
        message={
          <div className="mt-2 text-left">
            <p className="text-[color:var(--muted)] mb-4">{t.uploader.deleteMsg(fileToDelete?.fileName || '')}</p>
            <input
              type="password"
              placeholder="Mot de passe Administrateur"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
            />
          </div>
        }
        confirmText={t.uploader.deleteConfirm}
        cancelText={t.uploader.cancel}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setFileToDelete(null);
          setAdminPassword('');
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
                className="w-full px-4 py-3 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all min-h-[100px] mb-4"
              />
            )}
            <input
              type="password"
              placeholder="Mot de passe Administrateur"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
            />
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
          setFeedbackText('');
          setAdminPassword('');
        }}
      />

      <ConfirmDialog
        isOpen={downloadDialogOpen}
        title="Télécharger ce fichier"
        message={
          <div className="mt-2 text-left">
            <p className="text-[color:var(--muted)] mb-4">Entrez le mot de passe Administrateur pour télécharger "{fileToDownload?.name}".</p>
            <input
              type="password"
              placeholder="Mot de passe Administrateur"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
            />
          </div>
        }
        confirmText="Télécharger"
        cancelText={t.uploader.cancel}
        variant="primary"
        onConfirm={handleConfirmDownload}
        onCancel={() => {
          setDownloadDialogOpen(false);
          setFileToDownload(null);
          setAdminPassword('');
        }}
      />
      {/* Script Viewer Modal */}
      {viewingScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--paper)] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-[var(--border)] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--paper-2)]">
              <h3 className="font-bold text-lg text-[color:var(--ink)] flex items-center gap-2">
                <FileText className="text-[color:var(--accent)]" size={20} />
                {viewingScript.name}
              </h3>
              <button 
                onClick={() => setViewingScript(null)}
                className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-[var(--paper)] min-h-[300px] relative">
              <ScriptViewerContent file={viewingScript} selectedWeek={selectedWeek} selectedBin={selectedBin} adminPassword={localStorage.getItem('app-password')} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScriptViewerContent({ file, selectedWeek, selectedBin, adminPassword }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let url = `${API_BASE}/uploads/${file.filename}?proxy=true`;
    // If it's MOT DU JT, we need the password. However, static files /uploads/:filename 
    // expects it in the query string `?adminPassword=...`
    if (selectedBin === 'mj' && adminPassword) {
      url += `&adminPassword=${encodeURIComponent(adminPassword)}`;
    }

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Impossible de charger le contenu. (Peut-être protégé ?)');
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [file, selectedBin, adminPassword]);

  if (loading) return <div className="flex justify-center items-center h-full text-[color:var(--muted)]">Chargement du texte...</div>;
  if (error) return <div className="text-red-500 font-medium text-center mt-10 flex flex-col items-center gap-2"><AlertCircle /> {error}</div>;

  return (
    <pre className="whitespace-pre-wrap font-sans text-[color:var(--ink)] text-base leading-relaxed max-w-none">
      {content}
    </pre>
  );
}
