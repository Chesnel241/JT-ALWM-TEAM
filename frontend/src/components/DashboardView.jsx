import { useState, useEffect, useRef, useMemo } from 'react';
import { Folder, FileText, Video, Download, Trash2, CheckCircle, XCircle, AlertCircle, UploadCloud, Mic, MoreVertical } from 'lucide-react';
import { api, API_BASE } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute, formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import SkeletonCard from './SkeletonCard.jsx';
import AIChecklist from './AIChecklist.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import AdminUploadDialog from './AdminUploadDialog.jsx';

function ScriptViewerContent({ file, selectedWeek, selectedBin, adminPassword }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let url = `${API_BASE}/uploads/${file.filename}?proxy=true`;
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
  if (error) return <div className="text-[var(--signal)] font-medium text-center mt-10 flex flex-col items-center gap-2"><AlertCircle /> {error}</div>;

  return (
    <pre className="whitespace-pre-wrap font-sans text-[color:var(--ink)] text-base leading-relaxed max-w-none">
      {content}
    </pre>
  );
}

function ScriptViewerModal({ file, onClose, selectedWeek, selectedBin, adminPassword }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!file) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (dialogRef.current) {
      const closeBtn = dialogRef.current.querySelector('button');
      if (closeBtn) closeBtn.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [file, onClose]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ink)]/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="script-viewer-title">
      <div ref={dialogRef} className="bg-[var(--paper)] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-[var(--border)] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--paper-2)]">
          <h3 id="script-viewer-title" className="font-bold text-lg text-[color:var(--ink)] flex items-center gap-2">
            <FileText className="text-[color:var(--accent)]" size={20} aria-hidden="true" />
            {file.name}
          </h3>
          <button 
            onClick={onClose}
            aria-label="Fermer le lecteur de script"
            className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg transition-colors focus-ring focus:outline-none"
          >
            <XCircle size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-[var(--paper)] min-h-[300px] relative">
          <ScriptViewerContent file={file} selectedWeek={selectedWeek} selectedBin={selectedBin} adminPassword={adminPassword} />
        </div>
      </div>
    </div>
  );
}
export default function DashboardView({ weeks, selectedWeek, setSelectedWeek, countries }) {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const [dashboard, setDashboard] = useState({});

  const [loading, setLoading] = useState(true);
  const [viewingScript, setViewingScript] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Admin Upload State
  const [adminUploadOpen, setAdminUploadOpen] = useState(false);
  const [isUploadingAdmin, setIsUploadingAdmin] = useState(false);

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
    if (!deleteDialogOpen && !feedbackDialogOpen && !downloadDialogOpen) {
      setAdminPassword('');
    }
  }, [deleteDialogOpen, feedbackDialogOpen, downloadDialogOpen]);

  useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    api.getDashboard(selectedWeek)
      .then(setDashboard)
      .catch((err) => {
        console.error(err);
        addToast(err.message || t.uploader.errorPrefix, 'error', 3000);
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

  const handleAdminUpload = async (file, password) => {
    setIsUploadingAdmin(true);
    try {
      await api.uploadFile(selectedWeek, selectedBin, file, {
        adminPassword: password,
        reportage: 'Reportage Assemblé',
      });
      addToast('Upload du reportage assemblé réussi', 'success');
      setAdminUploadOpen(false);
      const updatedDashboard = await api.getDashboard(selectedWeek);
      setDashboard(updatedDashboard);
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 5000);
    } finally {
      setIsUploadingAdmin(false);
    }
  };

  const countriesWithUploads = useMemo(() => {
    return Object.keys(dashboard).filter(
      (id) => dashboard[id]?.length > 0 || id === 'tj'
    );
  }, [dashboard]);

  const [selectedBin, setSelectedBin] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (countriesWithUploads.length > 0 && (!selectedBin || !countriesWithUploads.includes(selectedBin))) {
      setSelectedBin(countriesWithUploads[0]);
    }
  }, [selectedBin, countriesWithUploads]);

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

  const renderFileCard = (file) => {
    const isVideo = file.type === 'video' || !!file.name.match(/\.(mp4|mov|avi|mkv)$/i);
    const isAudio = file.type === 'audio' || !!file.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i);
    
    return (
      <div key={file.id} className="group flex flex-col gap-2 shrink-0 w-64 md:w-auto snap-start relative">
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
          ) : isAudio ? (
            <div className="absolute inset-0 flex items-center justify-center text-[color:var(--signal)]/40 z-0 bg-gradient-to-tr from-[var(--paper)] to-blue-50">
               <Mic className="w-12 h-12 transition-transform duration-500 group-hover:scale-110 relative z-10 text-blue-400" />
            </div>
          ) : (
            <FileText className="text-[color:var(--signal)]/40 w-12 h-12 transition-transform duration-500 group-hover:scale-110 relative z-10" />
          )}

          {/* Status Badge */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-20">
            {file.reportage === 'Reportage Assemblé' && (
              <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md text-white bg-purple-500/90 border border-purple-400/30 flex items-center gap-1" title="Reportage finalisé uploadé par l'équipe de montage">
                <CheckCircle size={10} />
                Assemblé
              </div>
            )}
            {file.status !== 'pending' && (
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md text-white ${
                file.status === 'approved' ? 'bg-[var(--accent)]' : 'bg-[var(--signal)]'
              }`}>
                {file.status === 'approved' ? 'Approuvé' : 'Rejeté'}
              </div>
            )}
          </div>

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
                title={isAudio ? "Écouter / Voir détails" : "Lire le script"}
              >
                {isAudio ? <Mic size={18} /> : <FileText size={18} />}
              </button>
            )}
            
            {/* Hover Toolbar */}
            <div className="flex items-center gap-1 bg-[var(--paper)]/95 rounded-lg p-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => openFeedbackDialog(selectedBin, file.id, 'approved')}
                className={`p-1.5 rounded-lg transition-colors ${file.status === 'approved' ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[color:var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}
                title="Approuver"
              >
                <CheckCircle size={16} />
              </button>
              <button
                onClick={() => openFeedbackDialog(selectedBin, file.id, 'rejected')}
                className={`p-1.5 rounded-lg transition-colors ${file.status === 'rejected' ? 'text-[var(--signal)] bg-[var(--signal)]/10' : 'text-[color:var(--muted)] hover:text-[var(--signal)] hover:bg-[var(--signal)]/10'}`}
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
                className="p-1.5 rounded-lg text-[color:var(--muted)] hover:text-[var(--signal)] hover:bg-[var(--signal)]/10 transition-colors"
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
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 md:h-screen min-h-screen flex flex-col">
      <div className="flex flex-col md:flex-row flex-1 border-0 md:border border-[var(--border)] md:rounded-2xl shadow-sm overflow-hidden bg-[var(--app-bg)] min-h-0">
        
        {/* Sidebar Bins (Mobile Collapsible) */}
        <aside id="tour-editing-sidebar" className={`w-full md:w-64 md:border-r border-[var(--border)] flex flex-col md:overflow-y-auto shrink-0 bg-[var(--paper-2)] z-20 ${isMobileSidebarOpen ? 'block' : 'hidden md:flex'}`}>
          <div className="p-3 md:p-4 border-b border-[var(--border)] bg-[var(--paper)] hidden md:block">
            <div className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)] mb-2 inline-block">{t.nav.editing}</div>
            <h2 className="text-xl font-bold text-[color:var(--ink)]">{t.dashboard.title}</h2>
          </div>
          
          <div className="p-2 md:p-4 md:flex-1 w-full overflow-hidden">
            <div className="flex items-center justify-between px-2 mb-3 md:mb-0">
              <h3 className="text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-wider">Chutiers (Pays)</h3>
              <button className="md:hidden text-xs text-[color:var(--accent)]" onClick={() => setIsMobileSidebarOpen(false)}>Fermer</button>
            </div>
            {loading ? (
              <div className="space-y-2">
                <SkeletonCard count={2} />
              </div>
            ) : countriesWithUploads.length === 0 ? (
              <div className="p-4 text-sm text-[color:var(--muted)] text-center">Aucun fichier déposé pour l'instant.</div>
            ) : (
              <div className="flex overflow-x-auto pb-1 md:pb-0 gap-2 md:space-y-1 md:flex-col md:gap-0 snap-x scrollbar-hide -mx-2 px-2 md:mx-0 md:px-0">
                {countriesWithUploads.map(countryId => {
                  const country = countries.find((c) => c.id === countryId);
                  const fileCount = dashboard[countryId].length;
                  const isActive = selectedBin === countryId;
                  return (
                    <button 
                      key={countryId}
                      onClick={() => setSelectedBin(countryId)}
                      className={`shrink-0 md:w-full flex items-center justify-between px-3 md:px-3 py-2 md:py-2.5 rounded-xl transition-all active:scale-[0.98] snap-start border md:border-transparent ${
                        isActive 
                          ? 'bg-[var(--accent)] text-white font-semibold border-transparent shadow-md' 
                          : 'bg-[var(--paper)] border-[var(--border)] text-[color:var(--muted)] sm:hover:bg-[var(--paper)] sm:hover:text-[color:var(--ink)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder size={16} className={isActive ? 'fill-current opacity-30' : ''} />
                        <span className="truncate whitespace-nowrap text-sm md:text-base">{country?.name || countryId}</span>
                      </div>
                      <span className={`ml-3 text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-black/20 text-white' : 'bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)]'}`}>
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
        <main id="tour-editing-grid" className="flex-1 flex flex-col min-w-0 bg-[var(--paper)]">
          {/* Top Toolbar */}
          <header className="p-4 bg-[var(--paper)] border-b border-[var(--border)] flex justify-between items-center z-10 shrink-0 relative">
            <div className="flex items-center gap-3">
              <button 
                className="md:hidden p-1.5 rounded-lg bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] shrink-0" 
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              >
                <Folder size={18} />
              </button>
              {selectedBin ? (
                <>
                  <CountryAvatar country={countries.find(c => c.id === selectedBin)} className="w-8 h-8" />
                  <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                    {countries.find(c => c.id === selectedBin)?.name}
                  </h2>
                </>
              ) : (
                <h2 className="text-lg font-semibold text-[color:var(--muted)]">Media Pool</h2>
              )}
            </div>
            
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
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
                <>
                  <button
                    onClick={() => setAdminUploadOpen(true)}
                    className="btn border border-transparent bg-[var(--signal)] hover:opacity-90 text-[var(--paper)] shadow-sm py-1.5 px-3 text-sm flex items-center gap-1.5 transition-opacity"
                    title="Uploader un reportage final (Admin)"
                  >
                    <UploadCloud size={14} /> <span className="hidden sm:inline">Uploader le reportage assemblé</span>
                  </button>
                  {selectedBin === 'mj' ? (
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
                  )}
                </>
              )}
            </div>

            {/* Mobile Actions Dropdown */}
            <details className="md:hidden group relative">
              <summary className="list-none cursor-pointer p-2 bg-[var(--paper-2)] border border-[var(--border)] rounded-lg flex items-center justify-center">
                <span className="sr-only">Actions</span>
                <MoreVertical size={20} className="text-[color:var(--ink)]" />
              </summary>
              <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--paper)] border border-[var(--border)] shadow-xl rounded-xl p-4 flex flex-col gap-3 z-50">
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-lg px-3 py-2 font-medium focus:ring-0 cursor-pointer"
                >
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {formatWeekLabel(w, lang)}{w.status === 'active' ? t.uploader.weekActiveTag : ''}
                    </option>
                  ))}
                </select>

                {selectedBin && (
                  <>
                    <button
                      onClick={() => setAdminUploadOpen(true)}
                      className="w-full btn border border-transparent bg-[var(--signal)] hover:opacity-90 text-[var(--paper)] shadow-sm py-2 px-3 text-sm flex items-center justify-center gap-2 transition-opacity"
                    >
                      <UploadCloud size={16} /> <span>Upload Final</span>
                    </button>
                    {selectedBin === 'mj' ? (
                      <button
                        onClick={() => openDownloadDialog({ filename: `${selectedWeek}/mj/archive`, name: `uploads_${selectedWeek}_mj.zip` })}
                        className="w-full btn btn-primary py-2 px-3 text-sm flex items-center justify-center gap-2"
                      >
                        <Download size={16} /> <span>{t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code)}</span>
                      </button>
                    ) : (
                      <a
                        href={`${API_BASE}/api/uploads/${selectedWeek}/${selectedBin}/archive?pwd=${encodeURIComponent(localStorage.getItem('app-password') || '')}`}
                        download={`uploads_${selectedWeek}_${selectedBin}.zip`}
                        className="w-full btn btn-primary py-2 px-3 text-sm flex items-center justify-center gap-2 text-center"
                      >
                        <Download size={16} /> <span>{t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code)}</span>
                      </a>
                    )}
                  </>
                )}
              </div>
            </details>
          </header>

          {/* Media Grid */}
          <div className="p-4 md:p-6 md:overflow-y-auto flex-1 bg-[var(--paper-2)]">
            <AIChecklist 
              dashboard={dashboard} 
              countries={countries} 
              selectedBin={selectedBin} 
            />
            
            {!selectedBin ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[color:var(--muted)] pb-20 pt-10">
                <Video size={48} className="mb-4 opacity-20" />
                <p>Sélectionnez un chutier pour voir les médias</p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-8">
                {(() => {
                  const allFiles = dashboard[selectedBin] || [];
                  if (allFiles.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center text-[color:var(--muted)] py-20">
                        <Folder size={48} className="mb-4 opacity-20" />
                        <p>Aucun fichier dans ce chutier pour l'instant.</p>
                      </div>
                    );
                  }

                  const videoFiles = allFiles.filter(f => f.type === 'video' || !!f.name.match(/\.(mp4|mov|avi|mkv)$/i));
                  const audioFiles = allFiles.filter(f => f.type === 'audio' || !!f.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i));
                  const scriptFiles = allFiles.filter(f => !videoFiles.includes(f) && !audioFiles.includes(f));

                  return (
                    <>
                      {/* Videos & Rushs */}
                      {videoFiles.length > 0 && (
                        <section>
                          <h3 className="text-sm uppercase tracking-widest text-[color:var(--muted)] font-semibold mb-3 flex items-center gap-2">
                            <Video size={16} /> Vidéos & Rushs
                          </h3>
                          <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 gap-4 md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible">
                            {videoFiles.map(file => renderFileCard(file))}
                          </div>
                        </section>
                      )}

                      {/* Voix Off */}
                      {audioFiles.length > 0 && (
                        <section>
                          <h3 className="text-sm uppercase tracking-widest text-[color:var(--muted)] font-semibold mb-3 flex items-center gap-2">
                            <Mic size={16} /> Voix Off
                          </h3>
                          <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 gap-4 md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible">
                            {audioFiles.map(file => renderFileCard(file))}
                          </div>
                        </section>
                      )}

                      {/* Scripts & Documents */}
                      {scriptFiles.length > 0 && (
                        <section>
                          <h3 className="text-sm uppercase tracking-widest text-[color:var(--muted)] font-semibold mb-3 flex items-center gap-2">
                            <FileText size={16} /> Scripts & Documents
                          </h3>
                          <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 gap-4 md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible">
                            {scriptFiles.map(file => renderFileCard(file))}
                          </div>
                        </section>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </main>
      </div>


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
      <ScriptViewerModal 
        file={viewingScript} 
        onClose={() => setViewingScript(null)}
        selectedWeek={selectedWeek}
        selectedBin={selectedBin}
        adminPassword={localStorage.getItem('app-password')}
      />

      {selectedBin && (
        <AdminUploadDialog
          isOpen={adminUploadOpen}
          onClose={() => setAdminUploadOpen(false)}
          onUpload={handleAdminUpload}
          isLoading={isUploadingAdmin}
          countryName={countries.find(c => c.id === selectedBin)?.name || selectedBin}
        />
      )}
    </div>
  );
}

