import { useState, useRef } from 'react';
import {
  UploadCloud, FileText, Video, Mic, CheckCircle,
  Clock, ChevronRight, Trash2, AlertCircle, Plus,
  HelpCircle, X, ArrowLeft, Send
} from 'lucide-react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute, formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import SkeletonCard from './SkeletonCard.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import Tutorial5W1H from './Tutorial5W1H.jsx';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const FILE_ICONS = {
  video: { Icon: Video, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  script: { Icon: FileText, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  audio: { Icon: Mic, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
};

export default function MobileUploaderView({
  country,
  weeks,
  selectedWeek,
  setSelectedWeek,
  uploads,
  setUploads,
  uploading,
  isLoadingUploads,
  reportageCount,
  setReportageCount,
  isLocked,
  extensionStatus,
  handleRequestDelay,
  handleFiles,
  handleScriptSubmit,
  submittingScripts,
  openDeleteDialog,
  hasPhoneNumber,
  phone,
  setPhone,
  handleSubscribe,
  isSubscribing,
  onBack,
  scriptText,
  setScriptText
}) {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const [activeTabId, setActiveTabId] = useState('reportage-0');
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [previewScriptFile, setPreviewScriptFile] = useState(null);
  const fileInputRef = useRef(null);

  // Define sections
  const sections = [
    ...Array.from({ length: reportageCount }, (_, i) => ({
      id: `reportage-${i}`,
      name: t.uploader.reportageName(i + 1),
      badge: `${i + 1}`,
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
    },
  ];

  // Find active section
  const currentSection = sections.find((s) => s.id === activeTabId) || sections[0];
  const activeReportageName = currentSection.name;

  // Active section uploads & active section uploading items
  const activeUploads = uploads.filter(
    (u) => u.reportage === activeReportageName || (!u.reportage && currentSection.isFirst)
  );
  const activeUploading = uploading.filter((u) => u.reportage === activeReportageName);

  const handleTriggerFileInput = () => {
    if (isLocked) {
      addToast('Les envois sont clôturés pour cette semaine.', 'warning');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleScriptModalSubmit = async () => {
    await handleScriptSubmit(activeReportageName);
    setScriptModalOpen(false);
  };

  const activeScriptContent = scriptText[activeReportageName] || '';
  const wordCount = activeScriptContent.trim() ? activeScriptContent.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-4 pb-12">
      {/* 1. TOP APP BAR */}
      <div className="flex items-center justify-between gap-2 bg-[var(--paper)] p-3 rounded-2xl border border-[var(--border)] shadow-sm">
        <button
          onClick={onBack}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--paper-2)] text-[color:var(--ink)] font-semibold text-xs border border-[var(--border)] active:scale-95 transition-transform"
        >
          <ArrowLeft size={14} />
          <span>{t.uploader.back}</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <CountryAvatar country={country} className="w-7 h-7 shrink-0" />
          <span className="font-bold text-sm text-[color:var(--ink)] truncate">
            {country.name}
          </span>
        </div>

        {country.id !== 'tj' && country.id !== 'mj' && (
          <button
            onClick={() => setTutorialOpen(true)}
            type="button"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] font-semibold text-xs active:scale-95 transition-transform"
          >
            <HelpCircle size={14} />
            <span>Guide</span>
          </button>
        )}
      </div>

      {/* 2. WEEK SELECTOR & DEADLINE PILL */}
      <div className="p-3 rounded-2xl bg-[var(--paper)] border border-[var(--border)] shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
            Semaine de diffusion
          </span>
          {isLocked ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--signal)] text-white">
              Clôturé
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
              En cours
            </span>
          )}
        </div>

        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="w-full bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-xs font-semibold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {formatWeekLabel(w, lang)} ({formatWeekDates(w, lang)}){w.status === 'active' ? ' • EN COURS' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 3. LATE / LOCK NOTIFICATION */}
      {isLocked && (
        <div className="p-4 rounded-2xl bg-[var(--signal)]/10 border-2 border-[var(--signal)]/40 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-[var(--signal)] font-bold text-sm">
            <AlertCircle size={18} />
            <span>Délai d'envoi dépassé</span>
          </div>
          <p className="text-xs text-[color:var(--ink)]">
            Les envois pour cette semaine sont clôturés. Vous pouvez demander un délai exceptionnel à l'équipe.
          </p>
          {extensionStatus === 'pending' ? (
            <div className="inline-block px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 text-xs font-bold">
              Demande de délai en cours de validation
            </div>
          ) : (
            <button
              onClick={handleRequestDelay}
              className="w-full py-2.5 rounded-xl bg-[var(--signal)] text-white font-bold text-xs shadow-md active:scale-95 transition-transform"
            >
              Demander un délai supplémentaire
            </button>
          )}
        </div>
      )}

      {/* 4. MANDATORY WHATSAPP SCREEN (If missing) */}
      {!hasPhoneNumber ? (
        <div className="p-5 rounded-2xl bg-[var(--paper)] border-2 border-[color:var(--accent)] shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-[color:var(--accent)] text-white p-2.5 rounded-full shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[color:var(--ink)]">
                {t.uploader.mandatoryPhoneTitle || 'Numéro WhatsApp requis'}
              </h3>
              <p className="text-xs text-[color:var(--muted)] mt-0.5">
                Pour vous notifier immédiatement en cas de problème sur un fichier.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <PhoneInput
              international
              defaultCountry="FR"
              value={phone}
              onChange={setPhone}
              className="w-full uploader-phone-input"
            />
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing || !phone || phone.length < 5}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white font-bold text-xs shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubscribing && (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{t.uploader.mandatoryPhoneSubmit || 'Valider et continuer'}</span>
            </button>
          </div>
        </div>
      ) : country.id === 'tj' || country.id === 'mj' ? (
        /* 5. SPECIAL COUNTRY VIEW (TJ / MJ) */
        <MobileSpecialUploader
          country={country}
          selectedWeek={selectedWeek}
          uploads={uploads}
          setUploads={setUploads}
          openDeleteDialog={openDeleteDialog}
          t={t}
        />
      ) : (
        /* 6. STANDARD REPORTAGES VIEW */
        <div className="space-y-4">
          {/* HORIZONTAL REPORTAGES TABS */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                Sections du JT
              </span>
              {reportageCount < 5 && (
                <button
                  onClick={() => setReportageCount((prev) => Math.min(5, prev + 1))}
                  className="flex items-center gap-1 text-[11px] font-bold text-[color:var(--accent-deep)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full active:scale-95"
                >
                  <Plus size={12} />
                  <span>Ajouter un reportage</span>
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar -mx-4 px-4 custom-scrollbar">
              {sections.map((sec) => {
                const isActive = sec.id === activeTabId;
                const count = uploads.filter(
                  (u) => u.reportage === sec.name || (!u.reportage && sec.isFirst)
                ).length;

                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveTabId(sec.id)}
                    type="button"
                    className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all active:scale-95 ${
                      isActive
                        ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/25 scale-[1.02]'
                        : 'bg-[var(--paper)] text-[color:var(--ink)] border border-[var(--border)]'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[var(--accent)]/15 text-[color:var(--accent-deep)]'
                      }`}
                    >
                      {sec.badge}
                    </span>
                    <span>{sec.name}</span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-white text-[color:var(--accent-deep)]' : 'bg-[var(--paper-2)] text-[color:var(--muted)]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE SECTION CONTAINER */}
          <div className="bg-[var(--paper)] rounded-3xl border border-[var(--border)] p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">
                  {currentSection.badge}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-[color:var(--ink)]">{activeReportageName}</h3>
                  <span className="text-[11px] text-[color:var(--muted)]">
                    {activeUploads.length} {activeUploads.length > 1 ? 'fichiers envoyés' : 'fichier envoyé'}
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS HUB (3 Thumb Buttons) */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Button 1: Add Video / File */}
              <button
                onClick={handleTriggerFileInput}
                disabled={isLocked}
                type="button"
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 text-blue-700 dark:text-blue-400 font-bold text-xs shadow-sm active:scale-95 transition-all text-center gap-1.5 disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
                  <Video size={20} />
                </div>
                <span className="leading-tight">Ajouter Vidéo / Média</span>
                <span className="text-[10px] font-normal opacity-80">Galerie ou Caméra</span>
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,audio/*,image/*,.mp4,.mov,.webm,.avi,.mkv,.pdf,.docx,.doc,.txt"
                className="hidden"
                disabled={isLocked}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files, activeReportageName);
                    e.target.value = '';
                  }
                }}
              />

              {/* Button 2: Submit Script */}
              <button
                onClick={() => setScriptModalOpen(true)}
                disabled={isLocked}
                type="button"
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-400 font-bold text-xs shadow-sm active:scale-95 transition-all text-center gap-1.5 disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                  <FileText size={20} />
                </div>
                <span className="leading-tight">Rédiger un Script</span>
                <span className="text-[10px] font-normal opacity-80">Texte & Voix Off</span>
              </button>
            </div>

            {/* LIVE UPLOAD / COMPRESSION PROGRESS (if active) */}
            {activeUploading.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--paper-2)] border border-[var(--border)] space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-[color:var(--ink)]">
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
                    <span>Envoi en cours...</span>
                  </span>
                  <span className="text-[11px] text-[color:var(--muted)]">
                    {activeUploading.length} {activeUploading.length > 1 ? 'fichiers' : 'fichier'}
                  </span>
                </div>

                <div className="space-y-2">
                  {activeUploading.map((f) => (
                    <div key={f.id} className="bg-[var(--paper)] p-2.5 rounded-xl border border-[var(--border)] space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-semibold text-[color:var(--ink)] truncate">{f.name}</span>
                        <span className="text-[10px] font-bold text-[color:var(--accent-deep)] shrink-0">
                          {f.phase === 'compressing'
                            ? `Compression ${Math.round(f.progress)}%`
                            : f.phase === 'processing'
                            ? 'Finalisation...'
                            : `${Math.round(f.progress)}%`}
                        </span>
                      </div>
                      <div className="w-full bg-[var(--paper-2)] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 bg-[var(--accent)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, f.progress)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UPLOADED FILES LIST FOR THIS REPORTAGE */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[color:var(--ink)]">
                  Fichiers de {activeReportageName}
                </span>
                <span className="text-[11px] text-[color:var(--muted)] font-semibold">
                  {activeUploads.length} total
                </span>
              </div>

              {isLoadingUploads ? (
                <SkeletonCard count={2} />
              ) : activeUploads.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-[var(--paper-2)] border border-dashed border-[var(--border)] text-[color:var(--muted)] space-y-2">
                  <UploadCloud size={24} className="mx-auto text-[color:var(--muted)] opacity-60" />
                  <p className="text-xs font-medium">Aucun fichier pour ce reportage.</p>
                  <p className="text-[11px] opacity-75">
                    Touchez « Ajouter Vidéo » ou « Rédiger un Script » ci-dessus.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeUploads.map((file) => {
                    const iconConfig = FILE_ICONS[file.type] || FILE_ICONS.script;
                    const Icon = iconConfig.Icon;

                    return (
                      <div
                        key={file.id}
                        className="p-3 rounded-2xl bg-[var(--paper-2)] border border-[var(--border)] flex items-center justify-between gap-2.5 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-2.5 rounded-xl shrink-0 ${iconConfig.bg} ${iconConfig.color}`}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[color:var(--ink)] truncate">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-[color:var(--muted)] mt-0.5">
                              <span>{file.size}</span>
                              {file.uploadedAt && (
                                <>
                                  <span>•</span>
                                  <span>{formatRelative(file.uploadedAt, lang)}</span>
                                </>
                              )}
                            </div>
                            {file.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 mt-1">
                                <CheckCircle size={11} /> Validé
                              </span>
                            )}
                            {file.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--signal)] mt-1">
                                <AlertCircle size={11} /> À corriger : {file.feedback}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {file.type === 'script' && (
                            <button
                              onClick={() => setPreviewScriptFile(file)}
                              type="button"
                              className="p-2 text-xs font-semibold text-[color:var(--accent-deep)] bg-[var(--accent)]/10 rounded-xl active:scale-90"
                              title="Lire le script"
                            >
                              <FileText size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteDialog(file)}
                            type="button"
                            className="p-2 text-[color:var(--muted)] hover:text-[var(--signal)] active:scale-90 rounded-xl"
                            title={t.uploader.delete}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. SCRIPT INPUT BOTTOM DRAWER / MODAL */}
      {scriptModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center p-0 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="fixed inset-0" 
            onClick={() => setScriptModalOpen(false)} 
          />
          <div className="relative w-full max-h-[85vh] bg-[var(--paper)] rounded-t-3xl shadow-2xl border-t border-[var(--border)] p-5 flex flex-col space-y-3 z-10 animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto mb-1" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="text-amber-500" size={20} />
                <h3 className="font-bold text-base text-[color:var(--ink)]">
                  Script : {activeReportageName}
                </h3>
              </div>
              <button
                onClick={() => setScriptModalOpen(false)}
                className="p-1.5 rounded-full text-[color:var(--muted)] hover:text-[color:var(--ink)]"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[color:var(--muted)]">
              Collez ou rédigez votre texte de voix off ou vos indications pour le monteur.
            </p>

            <textarea
              rows={6}
              value={scriptText[activeReportageName] || ''}
              onChange={(e) =>
                setScriptText((prev) => ({ ...prev, [activeReportageName]: e.target.value }))
              }
              placeholder={t.uploader.scriptPh}
              className="w-full p-3.5 bg-[var(--paper-2)] border border-[var(--border)] rounded-2xl text-xs text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] resize-none"
            />

            <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
              <span>{wordCount} mots</span>
              <button
                onClick={handleScriptModalSubmit}
                disabled={!activeScriptContent.trim() || submittingScripts[activeReportageName]}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[var(--accent)] text-white font-bold rounded-xl text-xs shadow-md shadow-[var(--accent)]/30 active:scale-95 disabled:opacity-50"
              >
                {submittingScripts[activeReportageName] ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>Enregistrer le script</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. SCRIPT PREVIEW MODAL */}
      {previewScriptFile && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-[var(--paper)] rounded-3xl p-5 border border-[var(--border)] shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-amber-500" size={18} />
                <h3 className="font-bold text-sm text-[color:var(--ink)] truncate">
                  {previewScriptFile.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewScriptFile(null)}
                className="p-1 text-[color:var(--muted)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 bg-[var(--paper-2)] rounded-2xl text-xs text-[color:var(--ink)] whitespace-pre-wrap font-mono">
              {previewScriptFile.content || previewScriptFile.text || 'Chargement du contenu...'}
            </div>

            <button
              onClick={() => setPreviewScriptFile(null)}
              className="w-full py-2.5 rounded-xl bg-[var(--paper-2)] border border-[var(--border)] font-bold text-xs text-[color:var(--ink)]"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* 9. TUTORIAL 5W1H BOTTOM SHEET / MODAL */}
      <Tutorial5W1H isOpen={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}

function MobileSpecialUploader({ country, selectedWeek, uploads, setUploads, openDeleteDialog, t }) {
  const [tab, setTab] = useState('text');
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
      addToast(isMj ? 'Détails sauvegardés' : 'Titres sauvegardés', 'success');
      const ups = await api.getUploads(selectedWeek, country.id);
      setUploads(ups);
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de la sauvegarde', 'error');
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
      const ups = await api.getUploads(selectedWeek, country.id);
      setUploads(ups);
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'upload", 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* 2 Tabs switcher */}
      <div className="grid grid-cols-2 gap-2 bg-[var(--paper)] p-1.5 rounded-2xl border border-[var(--border)]">
        <button
          onClick={() => setTab('text')}
          className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
            tab === 'text'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
          }`}
        >
          {isMj ? '1. Rédiger les Détails' : '1. Rédiger les Titres'}
        </button>
        <button
          onClick={() => setTab('media')}
          className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
            tab === 'media'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
          }`}
        >
          {isMj ? '2. Uploader la Vidéo' : '2. Uploader Médias'}
        </button>
      </div>

      {tab === 'text' ? (
        <div className="p-4 bg-[var(--paper)] rounded-3xl border border-[var(--border)] space-y-3">
          <h3 className="font-bold text-sm text-[color:var(--ink)]">
            {isMj ? "Détails (Orateur, Thème, Pays)" : "Rédiger les Titres & Rappels"}
          </h3>
          <textarea
            rows={5}
            className="w-full p-3.5 bg-[var(--paper-2)] border border-[var(--border)] rounded-2xl text-xs text-[color:var(--ink)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
            placeholder={isMj ? "Orateur, thème, pays..." : "Collez ou tapez les titres..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={handleTextUpload}
            disabled={!text.trim() || isUploading}
            className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white font-bold text-xs shadow-md active:scale-95 disabled:opacity-50"
          >
            {isUploading ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      ) : (
        <div className="p-4 bg-[var(--paper)] rounded-3xl border border-[var(--border)] space-y-3 text-center">
          <h3 className="font-bold text-sm text-[color:var(--ink)]">
            {isMj ? 'Vidéo du Mot du JT' : 'Fichiers Audio & Vidéo'}
          </h3>
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border)] rounded-2xl cursor-pointer bg-[var(--paper-2)] active:scale-98">
            <UploadCloud size={28} className="text-[color:var(--accent-deep)] mb-2" />
            <span className="font-bold text-xs text-[color:var(--ink)]">Touchez pour choisir des fichiers</span>
            <span className="text-[10px] text-[color:var(--muted)] mt-1">
              {isMj ? 'Vidéo MP4, MOV...' : 'Audio MP3, WAV, Vidéo...'}
            </span>
            <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      )}

      {/* Saved files */}
      {uploads.length > 0 && (
        <div className="p-4 bg-[var(--paper)] rounded-3xl border border-[var(--border)] space-y-2">
          <h4 className="font-bold text-xs text-[color:var(--ink)]">Fichiers enregistrés</h4>
          <div className="space-y-1.5">
            {uploads.map((file) => (
              <div
                key={file.id}
                className="p-2.5 bg-[var(--paper-2)] rounded-xl border border-[var(--border)] flex items-center justify-between text-xs"
              >
                <span className="font-medium text-[color:var(--ink)] truncate pr-2">{file.name}</span>
                <button
                  onClick={() => openDeleteDialog(file)}
                  className="text-[var(--signal)] p-1 shrink-0 active:scale-90"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
