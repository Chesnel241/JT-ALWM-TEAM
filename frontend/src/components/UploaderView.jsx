import { useState, useEffect, useRef } from 'react';
import {
  UploadCloud, Folder, FileText, Video,
  CheckCircle, Clock, ChevronRight, ChevronDown, Trash2, AlertCircle,
} from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute, formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import SkeletonCard from './SkeletonCard.jsx';
import CountdownTimer from './CountdownTimer.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const FILE_ICONS = {
  video: { Icon: Video, color: 'text-blue-500', bg: 'bg-blue-100' },
  script: { Icon: FileText, color: 'text-amber-500', bg: 'bg-amber-100' },
};

import Tutorial5W1H from './Tutorial5W1H.jsx';

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
  const [submittingScripts, setSubmittingScripts] = useState({});
  const [expandedSection, setExpandedSection] = useState(null);

  // Notifications
  const [hasPhoneNumber, setHasPhoneNumber] = useState(true); // default true before check
  const [phone, setPhone] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    const savedPhone = localStorage.getItem('uploader_phone');
    if (savedPhone) {
      setHasPhoneNumber(true);
      setPhone(savedPhone);
    } else {
      setHasPhoneNumber(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedWeek) return;
    setIsLoadingUploads(true);
    api.getUploads(selectedWeek, country.id)
      .then(setUploads)
      .catch(console.error)
      .finally(() => setIsLoadingUploads(false));
  }, [selectedWeek, country.id]);

  // Cutoff dimanche 17h30 — recalculé chaque seconde via le re-render
  // déclenché par CountdownTimer (qui partage le même `now`). Pour
  // garder le composant léger, on calcule ici à chaque render.
  const currentWeek = weeks.find(w => w.id === selectedWeek);
  const isLocked = (() => {
    if (!currentWeek?.startDate) return false;
    const cutoff = new Date(currentWeek.startDate);
    cutoff.setDate(cutoff.getDate() + 6);
    cutoff.setHours(17, 30, 0, 0);
    return new Date() > cutoff;
  })();

  const handleFiles = (filesList, reportageName) => {
    Array.from(filesList).forEach((file) => {
      const tempId = Math.random().toString(36).slice(2);
      const isVideo = /\.(mp4|mov|webm)$/i.test(file.name);
      setUploading((prev) => [
        ...prev,
        { id: tempId, name: file.name, progress: 0, status: 'uploading', phase: 'uploading', isVideo, reportage: reportageName },
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
          // Octets envoyés → serveur compresse/traite. Message clair.
          onPhase: (phase) => {
            setUploading((prev) =>
              prev.map((f) =>
                f.id === tempId
                  ? { ...f, phase, progress: phase === 'processing' ? 99 : f.progress }
                  : f
              )
            );
          },
        })
        .then((result) => {
          setUploading((prev) =>
            prev.map((f) =>
              f.id === tempId ? { ...f, progress: 100, status: 'completed', phase: 'done' } : f
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
    setSubmittingScripts(prev => ({ ...prev, [reportageName]: true }));
    try {
      const result = await api.submitScript(selectedWeek, country.id, text, reportageName);
      setUploads((prev) => [...prev, result]);
      setScriptText((prev) => ({ ...prev, [reportageName]: '' }));
      addToast(t.uploader.scriptSuccess, 'success', 3000);
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
    } finally {
      setSubmittingScripts(prev => ({ ...prev, [reportageName]: false }));
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

  const handleSubscribe = async () => {
    if (!phone || phone.trim().length < 5) return;
    setIsSubscribing(true);
    try {
      await api.subscribeToNotifications(selectedWeek, country.id, phone);
      localStorage.setItem('uploader_phone', phone);
      setHasPhoneNumber(true);
      addToast(t.uploader.notifySuccess, 'success', 3000);
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 4000);
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <button onClick={onBack} type="button" className="btn btn-ghost border border-[var(--border)] py-1.5 sm:py-2 text-sm sm:text-base active:scale-[0.97]">
          {t.uploader.back}
        </button>
        <ChevronRight size={16} className="text-[color:var(--muted)] hidden sm:block" />
        <span className="font-semibold text-xl sm:text-2xl text-[color:var(--ink)] flex items-center gap-2">
          <CountryAvatar country={country} className="w-8 h-8 mr-1" />
          {country.name}
        </span>
      </div>

      {country.id !== 'tj' && country.id !== 'mj' && <Tutorial5W1H />}

      <div className="panel p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h3 className="font-semibold text-[color:var(--ink)]">{t.uploader.weekTitle}</h3>
          <p className="text-sm text-[color:var(--muted)]">{t.uploader.weekSubtitle}</p>
        </div>
        <select
          id="tour-week-selector"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="w-full sm:w-auto bg-[var(--paper)] border border-[var(--border)] text-[color:var(--ink)] text-sm rounded-full px-4 py-2.5 sm:py-2 font-medium"
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {formatWeekLabel(w, lang)} ({formatWeekDates(w, lang)}){w.status === 'active' ? t.uploader.weekActiveTag : ''}
            </option>
          ))}
        </select>
      </div>

      {currentWeek && <CountdownTimer week={currentWeek} />}
      {isLocked && (
        <div role="alert" className="panel p-5 mb-8 border-2 !border-[var(--signal)]/50 !bg-[var(--signal)]/10 flex items-start gap-3">
          <AlertCircle className="text-[var(--signal)] flex-shrink-0 mt-0.5" size={22} />
          <div>
            <p className="font-bold text-[var(--signal)]">{t.uploader.lockedTitle}</p>
            <p className="text-sm text-[var(--signal)]/90 mt-1">{t.uploader.lockedDesc}</p>
          </div>
        </div>
      )}

      {!hasPhoneNumber ? (
        <div className="panel p-6 sm:p-8 mb-8 border-2 border-[color:var(--accent)] bg-[color:var(--accent)]/5">
          <div className="flex items-start gap-4 mb-6">
            <div className="bg-[color:var(--accent)] text-white p-3 rounded-full flex-shrink-0">
              <AlertCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[color:var(--ink)] mb-2">
                {t.uploader.mandatoryPhoneTitle || 'Un contact WhatsApp est obligatoire'}
              </h2>
              <p className="text-[color:var(--muted)]">
                {t.uploader.mandatoryPhoneDesc || 'Afin de vous avertir rapidement en cas de problème (vidéo refusée, son inaudible, etc.) ou vous prévenir de la disponibilité du JT, veuillez renseigner le numéro WhatsApp de votre pays.'}
              </p>
            </div>
          </div>
          
          <div className="max-w-md mx-auto bg-[var(--paper)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
            <label className="block text-sm font-medium text-[color:var(--ink)] mb-3">
              Numéro de téléphone avec indicatif
            </label>
            <PhoneInput
              international
              defaultCountry="FR"
              value={phone}
              onChange={setPhone}
              className="w-full mb-4 uploader-phone-input"
            />
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing || !phone || phone.length < 5}
              className="btn btn-primary w-full flex justify-center items-center gap-2"
            >
              {isSubscribing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {t.uploader.mandatoryPhoneSubmit || 'Valider et débloquer l\'upload'}
            </button>
          </div>
        </div>
      ) : country.id === 'tj' || country.id === 'mj' ? (
        <>
          <TjUploader 
            selectedWeek={selectedWeek} 
            country={country} 
            onUploaded={() => {
              api.getUploads(selectedWeek, country.id)
                .then(setUploads)
                .catch(console.error);
            }} 
            t={t} 
          />
          {uploads.length > 0 && (
            <div className="mb-8 p-6 bg-[var(--paper)] border border-[var(--border)] rounded-2xl shadow-sm">
              <h3 className="font-bold text-lg mb-4 text-[color:var(--ink)]">Fichiers sauvegardés</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uploads.map(file => (
                  <div key={file.id} className="bg-[var(--paper-2)] p-4 rounded-xl border border-[var(--border)] flex items-center justify-between">
                    <div className="flex flex-col overflow-hidden mr-3">
                      <span className="font-medium text-sm truncate text-[color:var(--ink)]">{file.name}</span>
                      <span className="text-xs text-[color:var(--muted)]">{file.reportage || (country.id === 'tj' ? 'Titres / Audio' : 'Mot du JT')}</span>
                    </div>
                    <button onClick={() => openDeleteDialog(file)} className="text-[var(--signal)] hover:opacity-80 p-2 flex-shrink-0" title={t.uploader.delete}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
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

      {[
        ...[...Array(reportageCount)].map((_, i) => ({
          id: `reportage-${i}`,
          name: t.uploader.reportageName(i + 1),
          badge: i + 1,
          isFirst: i === 0,
        })),
        {
          id: 'annonces',
          name: 'Annonces',
          badge: 'A',
          isFirst: false,
        },
        {
          id: 'seminaires',
          name: 'Séminaires de la semaine',
          badge: 'S',
          isFirst: false,
        }
      ].map((section, i) => {
        const reportageName = section.name;
        const repUploads = uploads.filter(u => u.reportage === reportageName || (!u.reportage && section.isFirst));
        const repUploading = uploading.filter(u => u.reportage === reportageName);
        const isDragActive = dragActive[reportageName];

        return (
          <div key={section.id} id={i === 0 ? 'tour-uploader-accordion' : undefined} className="mb-3 sm:mb-4 md:mb-12 bg-[var(--paper)] md:bg-black/5 md:dark:bg-white/5 rounded-2xl md:rounded-[2rem] border border-[var(--border)] md:p-8 overflow-hidden md:overflow-visible shadow-sm md:shadow-none transition-all duration-300">
            {/* Accordion Header (Mobile) / Normal Header (Desktop) */}
            <div
              onClick={() => {
                if (window.innerWidth < 768) {
                  setExpandedSection(expandedSection === section.id ? null : section.id);
                }
              }}
              className="w-full p-4 sm:p-6 md:p-0 flex items-center justify-between transition-colors text-left cursor-pointer md:cursor-default"
            >
              <div className="flex items-center gap-2 md:gap-3 md:mb-6">
                <span className="bg-[var(--accent)] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm md:shadow-none">{section.badge}</span>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[color:var(--ink)]">{reportageName}</h2>
              </div>
              <div className="flex items-center gap-4">
                {repUploads.length > 0 && (
                  <span className="text-xs sm:text-sm font-medium text-[color:var(--muted)] bg-[var(--paper-2)] border border-[var(--border)] px-3 py-1 rounded-full hidden sm:inline-block md:hidden">
                    {repUploads.length} {repUploads.length > 1 ? 'fichiers' : 'fichier'}
                  </span>
                )}
                <div className={`p-1 rounded-full transition-transform duration-300 md:hidden ${expandedSection === section.id ? 'bg-[var(--accent)] text-white rotate-180' : 'bg-black/5 dark:bg-white/5 text-[color:var(--ink)]'}`}>
                  <ChevronDown size={20} />
                </div>
              </div>
            </div>
            
            {/* Content Container (Collapsible on Mobile, Always Open on Desktop) */}
            <div
              className={`grid transition-all duration-500 ease-in-out md:!grid-rows-[1fr] md:!opacity-100 md:!overflow-visible ${
                expandedSection === section.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 overflow-hidden'
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div 
                  className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8 md:!p-0 md:!border-t-0 md:!bg-transparent md:!mt-0 md:!overflow-visible ${
                    expandedSection === section.id ? 'p-4 sm:p-6 border-t border-[var(--border)] bg-black/5 dark:bg-white/5' : 'p-0 m-0'
                  }`}
                >
                  <div className="space-y-4 sm:space-y-6">
                <div
                  id={i === 0 ? 'tour-dropzone' : undefined}
                  className={`relative border-2 border-dashed rounded-[1.5rem] p-6 sm:p-10 text-center transition-all ${
                    isLocked
                      ? 'border-[var(--border)] bg-[var(--paper-2)] opacity-50 cursor-not-allowed'
                      : isDragActive
                        ? 'border-[color:var(--accent)] bg-[var(--accent)]/10 scale-[1.02]'
                        : 'border-[var(--border)] bg-[var(--paper)] sm:hover:border-[color:var(--accent)]'
                  }`}
                  onDragEnter={(e) => !isLocked && handleDrag(e, reportageName)}
                  onDragLeave={(e) => !isLocked && handleDrag(e, reportageName)}
                  onDragOver={(e) => !isLocked && handleDrag(e, reportageName)}
                  onDrop={(e) => !isLocked && handleDrop(e, reportageName)}
                  aria-disabled={isLocked}
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
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <label className={`btn btn-primary w-full sm:w-auto text-center active:scale-[0.98] ${isLocked ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}>
                      {t.uploader.browse}
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        disabled={isLocked}
                        onChange={(e) => e.target.files && handleFiles(e.target.files, reportageName)}
                      />
                    </label>
                    <label className={`btn btn-primary w-full sm:w-auto text-center active:scale-[0.98] ${isLocked ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}>
                      {t.uploader.browseFolder}
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        webkitdirectory="true"
                        directory="true"
                        disabled={isLocked}
                        onChange={(e) => e.target.files && handleFiles(e.target.files, reportageName)}
                      />
                    </label>
                  </div>
                </div>

                {repUploading.length > 0 && (
                  <div className="panel p-6">
                    <h3 className="font-semibold text-[color:var(--ink)] mb-4">{t.uploader.transfers}</h3>
                    <div className="space-y-4">
                      {repUploading.map((f) => (
                        <div key={f.id} className="bg-[var(--paper)] p-3 rounded-2xl border border-[var(--border)]">
                          <div className="flex justify-between text-sm mb-2 gap-2">
                            <span className="font-medium text-[color:var(--ink)] truncate pr-4">{f.name}</span>
                            {f.status === 'completed' && (
                              <span className="text-[var(--accent)] flex items-center gap-1 shrink-0">
                                <CheckCircle size={14} /> {t.uploader.phaseDone}
                              </span>
                            )}
                            {f.status === 'error' && (
                              <span className="text-[var(--signal)] flex items-center gap-1 shrink-0">
                                <AlertCircle size={14} /> {f.error}
                              </span>
                            )}
                            {f.status === 'uploading' && (
                              <span className="text-[color:var(--accent-deep)] shrink-0 text-xs sm:text-sm">
                                {f.phase === 'processing'
                                  ? (f.isVideo ? t.uploader.phaseCompressing : t.uploader.phaseProcessing)
                                  : `${t.uploader.phaseUploading} ${Math.round(f.progress)}%`}
                              </span>
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
                              } ${f.status === 'uploading' && f.phase === 'processing' ? 'animate-pulse' : ''}`}
                              style={{ width: `${f.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div id={i === 0 ? 'tour-script-box' : undefined} className="panel p-6">
                  <h3 className="font-semibold text-[color:var(--ink)] mb-3 flex items-center gap-2">
                    <FileText size={18} className="text-[color:var(--signal)]" />
                    {t.uploader.scriptTitle}
                  </h3>
                  <textarea
                    className="w-full border border-[var(--border)] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[color:var(--accent)] outline-none mb-3 bg-[var(--paper)] disabled:opacity-50 disabled:cursor-not-allowed"
                    rows="4"
                    placeholder={t.uploader.scriptPh}
                    value={scriptText[reportageName] || ''}
                    onChange={(e) => setScriptText(prev => ({ ...prev, [reportageName]: e.target.value }))}
                    disabled={isLocked}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleScriptSubmit(reportageName)}
                      disabled={isLocked || !(scriptText[reportageName] || '').trim() || submittingScripts[reportageName]}
                      type="button"
                      className="btn btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {submittingScripts[reportageName] ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        t.uploader.scriptSubmit
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div id={i === 0 ? 'tour-upload-list' : undefined} className="panel p-6 h-fit bg-[var(--paper)]">
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
                            {file.status === 'approved' && (
                              <p className="text-xs font-medium text-[var(--accent)] mt-1 flex items-center gap-1">
                                <CheckCircle size={12} /> Validé
                              </p>
                            )}
                            {file.status === 'rejected' && (
                              <div className="mt-2 p-2 bg-[var(--signal)]/10 rounded-lg border border-[var(--signal)]/20">
                                <p className="text-xs font-bold text-[var(--signal)] flex items-center gap-1 mb-1">
                                  <AlertCircle size={12} /> À corriger
                                </p>
                                <p className="text-xs text-[var(--signal)]/90">{file.feedback}</p>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => openDeleteDialog(file)}
                            type="button"
                            className="text-[color:var(--muted)] hover:text-[var(--signal)] p-1 rounded transition-colors"
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
            </div>
          </div>
        );
      })}
      </>
      )}

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

      <ConfirmDialog
        isOpen={phoneModalOpen}
        title="WhatsApp"
        message={
          <div className="mt-2 text-left">
            <p className="text-[color:var(--muted)] mb-4">
              {t.uploader.notifyPrompt}
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.uploader.phonePlaceholder}
              className="w-full px-4 py-3 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] transition-all"
            />
          </div>
        }
        confirmText={t.uploader.notifyYes}
        cancelText={t.uploader.notifyNo}
        variant="primary"
        isLoading={isSubscribing}
        onConfirm={handleSubscribe}
        onCancel={() => {
          hasSubscribedSession.current = true; // Don't ask again this session
          setPhoneModalOpen(false);
        }}
      />
    </div>
  );
}

function TjUploader({ selectedWeek, country, onUploaded, t }) {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useToast();

  const isMj = country.id === 'mj';

  const handleTextUpload = async () => {
    if (!text.trim()) return;
    setIsUploading(true);
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const filename = isMj ? `details_mot_du_jt_${Date.now()}.txt` : `titres_et_rappels_${Date.now()}.txt`;
      const file = new File([blob], filename, { type: 'text/plain' });
      await api.uploadFile(selectedWeek, country.id, file, { reportage: isMj ? 'Détails' : 'Titres' });
      setText('');
      addToast(isMj ? 'Détails sauvegardés avec succès' : 'Titres sauvegardés avec succès', 'success');
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de la sauvegarde", 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        await api.uploadFile(selectedWeek, country.id, file, { reportage: isMj ? 'Vidéo' : 'Audio/Voix Off' });
      }
      addToast('Fichiers uploadés avec succès', 'success');
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'upload", 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="mb-8 p-6 bg-[var(--paper)] border border-[var(--border)] rounded-2xl shadow-sm flex flex-col lg:flex-row gap-6">
      <div className="flex-1">
        <h3 className="font-bold text-lg mb-2 text-[color:var(--ink)]">
          {isMj ? "Détails (Orateur, Thème, Pays)" : "Rédiger les Titres"}
        </h3>
        <textarea 
          className="w-full min-h-[150px] p-3 rounded-xl border border-[var(--border)] bg-[var(--paper-2)] text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] resize-y mb-3"
          placeholder={isMj ? "Collez ou tapez les détails de l'orateur, le thème, et le pays ici..." : "Collez ou tapez les titres et rappels ici..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button 
          onClick={handleTextUpload}
          disabled={!text.trim() || isUploading}
          className="btn btn-primary px-4 py-2 w-full disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-[var(--paper)]/30 border-t-[var(--paper)] rounded-full animate-spin" />
              Sauvegarde...
            </>
          ) : (
            isMj ? 'Sauvegarder les Détails' : 'Sauvegarder les Titres'
          )}
        </button>
      </div>

      <div className="w-px bg-[var(--border)] hidden lg:block"></div>

      <div className="flex-1 flex flex-col justify-center">
        <h3 className="font-bold text-lg mb-2 text-[color:var(--ink)]">
          {isMj ? "Uploader la Vidéo" : "Uploader Audio & Vidéo"}
        </h3>
        <p className="text-sm text-[color:var(--muted)] mb-4">
          {isMj ? "Sélectionnez le fichier vidéo du Mot du JT." : "Sélectionnez les voix off, les virgules sonores, etc."}
        </p>
        
        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:bg-[color:var(--accent)]/5 hover:border-[color:var(--accent)] transition-colors group">
          <UploadCloud className="w-8 h-8 text-[color:var(--muted)] group-hover:text-[color:var(--accent)] mb-3" />
          <span className="font-medium text-[color:var(--ink)]">Cliquez pour choisir des fichiers</span>
          <span className="text-xs text-[color:var(--muted)] mt-1">
            {isMj ? "Vidéo (MP4, MOV), etc." : "Audio (MP3, WAV), Vidéo, etc."}
          </span>
          <input 
            type="file" 
            className="hidden" 
            multiple 
            onChange={handleFileUpload} 
            disabled={isUploading}
          />
        </label>
        {isUploading && (
          <div className="flex items-center justify-center gap-2 mt-3 text-[color:var(--accent)] font-medium">
            <div className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
            <p className="text-sm">Upload en cours...</p>
          </div>
        )}
      </div>
    </div>
  );
}
