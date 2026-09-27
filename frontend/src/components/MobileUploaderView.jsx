import { useState, useRef } from 'react';
import {
  FileText, Video, Mic, CheckCircle,
  Clock, Trash2, AlertCircle,
  HelpCircle, X, ArrowLeft, Send, MessageCircle, Image as ImageIcon, RotateCcw
} from 'lucide-react';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatWeekFull, formatExpiry } from '../lib/dates.js';
import SkeletonCard from './SkeletonCard.jsx';
import CountdownTimer from './CountdownTimer.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import Tutorial5W1H from './Tutorial5W1H.jsx';
import PendingUploadsCard from './PendingUploadsCard.jsx';
import NombreReportages from './NombreReportages.jsx';
import ReportagesSheet from './ReportagesSheet.jsx';
import ReportageChecklist from './ReportageChecklist.jsx';
import OfflineBanner from './OfflineBanner.jsx';
import EmptyState from './EmptyState.jsx';
import EmptyInbox from './illustrations/EmptyInbox.jsx';
import PhoneInput from 'react-phone-number-input';
import PhoneCountryBadge from './PhoneCountryBadge.jsx';
import { phoneCountryFor } from '../lib/phone.js';
import { UPLOAD_ACCEPT } from '../lib/mediaTypes.js';
import { reportageTone } from '../lib/branding.js';
import { buildSections, filesForSection, etatNombreReportages, SECTIONS_FIXES } from '../lib/sujets.js';
import 'react-phone-number-input/style.css';

// Charte : bleus du logo et neutres. Le texte coloré sur aplat coloré de la
// version précédente (bleu 500 sur bleu 100, ambre sur ambre) descendait sous
// le seuil de lisibilité ; on passe au bleu profond, à 8:1 sur ces fonds.
const FILE_ICONS = {
  video: { Icon: Video, color: 'text-[color:var(--accent-deep)]', bg: 'bg-[var(--accent)]/10' },
  image: { Icon: ImageIcon, color: 'text-[color:var(--accent-deep)]', bg: 'bg-[var(--accent-soft)]/25' },
  audio: { Icon: Mic, color: 'text-[color:var(--accent-deep)]', bg: 'bg-[var(--accent-soft)]/25' },
  script: { Icon: FileText, color: 'text-[color:var(--ink)]', bg: 'bg-[var(--paper-2)]' },
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
  sujets = [],
  onFixerReportages,
  isLocked,
  extensionStatus,
  handleRequestDelay,
  handleFiles,
  handleScriptSubmit,
  submittingScripts,
  openDeleteDialog,
  hasPhoneNumber,
  // Transmise par UploaderView mais jamais déstructurée ici : le bouton
  // « Modifier » du numéro levait une erreur au lieu de rouvrir le champ.
  setHasPhoneNumber,
  onEditPhone,
  phone,
  setPhone,
  handleSubscribe,
  isSubscribing,
  onBack,
  scriptText,
  setScriptText,
  pendingUploads = [],
  onResumeUpload,
  onDismissPending,
  onRetryUpload,
  isOnline = true,
  queuedCount = 0,
}) {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const currentWeek = weeks.find((w) => w.id === selectedWeek);
  const defaultPhoneCountry = phoneCountryFor(country.id);
  const [activeTabId, setActiveTabId] = useState('reportage-0');
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // Nombre choisi dont on demande les titres ; `null` quand la feuille est fermée.
  const [sheetNombre, setSheetNombre] = useState(null);
  const [previewScriptFile, setPreviewScriptFile] = useState(null);
  const fileInputRef = useRef(null);

  // Chaque section porte une phrase qui dit ce qu'on y dépose : « Annonces »
  // ou « Séminaires » seuls ne parlaient qu'à l'équipe montage.
  const sections = buildSections(sujets, uploads, {
    reportageName: t.uploader.reportageName,
    extras: SECTIONS_FIXES,
  }).map((section, i) => {
    // Un reportage est tout ce qui n'est pas une section fixe — y compris la
    // section de repli « Reportage 1 », qui n'a pas encore de sujet. Le test
    // se faisait sur `sujetId` : la section de repli tombait alors dans le cas
    // par défaut, et un correspondant qui débutait lisait sous « Reportage 1 »
    // la consigne des séminaires.
    const reportage = !SECTIONS_FIXES.some((fixe) => fixe.id === section.id);
    return {
      ...section,
      // Un titre de sujet peut être long : l'onglet en montre le début, la
      // carte de section le donne en entier.
      shortName: section.id === 'seminaires' ? 'Séminaires' : section.name,
      badge: reportage ? `${i + 1}` : section.badge,
      tone: reportage ? reportageTone(i) : undefined,
      hint: reportage
        ? t.uploader.sectionHintReportage
        : section.id === 'annonces'
          ? t.uploader.sectionHintAnnonces
          : t.uploader.sectionHintSeminaires,
    };
  });

  // Le nombre de reportages : choisi, affiché, et le plancher sous lequel on
  // perdrait des fichiers.
  const etatReportages = etatNombreReportages(sujets, uploads);

  // Find active section
  const currentSection = sections.find((s) => s.id === activeTabId) || sections[0];
  const activeReportageName = currentSection.name;

  // Active section uploads & active section uploading items
  const activeUploads = filesForSection(uploads, currentSection);
  // Un envoi en cours porte son sujet ; on retombe sur le nom de section pour
  // les rubriques fixes, qui n'en ont pas.
  const activeUploading = uploading.filter((u) => (
    currentSection.sujetId ? u.sujetId === currentSection.sujetId : u.reportage === activeReportageName
  ));

  const handleTriggerFileInput = () => {
    if (isLocked) {
      addToast('Les envois sont clôturés pour cette semaine.', 'warning');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleScriptModalSubmit = async () => {
    await handleScriptSubmit(activeReportageName, currentSection.sujetId);
    setScriptModalOpen(false);
  };

  const activeScriptContent = scriptText[activeReportageName] || '';
  const wordCount = activeScriptContent.trim() ? activeScriptContent.trim().split(/\s+/).length : 0;

  // pb-28 : la barre d'onglets est fixée en bas de l'écran. Sans cette
  // réserve, elle recouvrait la moitié basse des boutons d'envoi et les
  // appuis partaient sur l'onglet au lieu du bouton.
  return (
    <div className="space-y-4 pb-28">
      {/* En-tête unique : pays, semaine et échéance. Auparavant deux cartes
          empilées poussaient les boutons d'envoi sous la ligne de flottaison —
          le correspondant devait faire défiler pour trouver l'action. */}
      <div className="rounded-2xl bg-[var(--paper)] border border-[var(--border)] shadow-sm p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--paper-2)] text-[color:var(--ink)] font-semibold text-xs border border-[var(--border)] active:scale-95 transition-transform"
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

          <button
            onClick={() => setTutorialOpen(true)}
            type="button"
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] font-semibold text-xs active:scale-95 transition-transform"
          >
            <HelpCircle size={14} />
            <span>Guide</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            aria-label={t.uploader.weekLabel}
            className="min-w-0 flex-1 bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-sm font-semibold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          >
            {/* Le libellé de la rédaction (« Sem. 18 ») tient là où « Semaine
                37 » débordait : les dates reviennent dans le champ, et ce
                sont elles qui disent de quelle semaine on parle. La mention
                « en cours » suit la langue de l'interface — écrite en dur,
                elle restait en français au milieu d'un écran anglais. */}
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {formatWeekFull(w, lang)}{w.status === 'active' ? t.uploader.weekActiveTag : ''}
              </option>
            ))}
          </select>
          {isLocked && (
            <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--signal)] text-white">
              Clôturé
            </span>
          )}
        </div>

        {/* L'échéance n'existait que sur ordinateur : sur téléphone, le
            correspondant ne découvrait le retard qu'une fois clôturé. */}
        {currentWeek && <CountdownTimer week={currentWeek} compact />}

        {/* Date réelle d'effacement, au lieu du « 48 h » affiché ailleurs :
            la règle est ancrée à la semaine, pas à l'envoi. */}
        {currentWeek?.expiresAt && (
          <p className="flex items-center gap-1.5 text-[11px] text-[color:var(--muted)]">
            <Clock size={12} className="shrink-0" />
            {t.home.retentionOn(formatExpiry(currentWeek, lang))}
          </p>
        )}
      </div>

      {!isOnline && <OfflineBanner queuedCount={queuedCount} />}

      {/* Reprise d'un envoi coupé : placé haut, c'est la première chose à
          régler en revenant sur l'application. */}
      <PendingUploadsCard
        entries={pendingUploads}
        onResume={onResumeUpload}
        onDismiss={onDismissPending}
      />

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
            <div className="inline-block px-3 py-1.5 rounded-xl bg-[var(--signal)]/15 border border-[var(--signal)]/40 text-[color:var(--ink)] text-xs font-bold">
              {t.delais.accuse}
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
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[color:var(--ink)]">
                {t.uploader.mandatoryPhoneTitle || 'Numéro WhatsApp requis'}
              </h3>
              <p className="text-sm text-[color:var(--muted)] mt-0.5">
                {t.uploader.phoneWhy}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* L'indicatif est déduit du pays choisi : les correspondants
                devaient sinon retrouver le leur dans une longue liste,
                proposée par défaut sur la France. */}
            <PhoneInput
              international
              defaultCountry={defaultPhoneCountry}
              flagComponent={PhoneCountryBadge}
              value={phone}
              onChange={setPhone}
              className="w-full uploader-phone-input"
            />
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing || !phone || phone.length < 5}
              className="w-full py-4 rounded-2xl bg-[var(--action)] text-white font-bold text-base shadow-md shadow-[var(--action)]/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubscribing && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{t.uploader.mandatoryPhoneSubmit || 'Valider et continuer'}</span>
            </button>
            {/* Dire ce qui vient après : l'écran était un mur sans horizon. */}
            <p className="text-center text-xs text-[color:var(--muted)]">
              {t.uploader.phoneNext}
            </p>
          </div>
        </div>
      ) : (
        /* 5. STANDARD REPORTAGES VIEW — le conducteur et le Mot du JT ont
           leur propre écran (RubriqueView) : ce ne sont plus des pays. */
        <div className="space-y-4">
          {/* Étape 1 : combien de reportages. Le choix se fait d'abord et
              reste visible ; il remplace le bouton « Ajouter un reportage »
              que plusieurs correspondants ne comprenaient pas. */}
          <NombreReportages
            etat={etatReportages}
            onChoisir={(n) => setSheetNombre(n)}
            onModifierTitres={() => setSheetNombre(etatReportages.actuel)}
            disabled={isLocked}
          />

          {/* Sections : une rangée compacte, libellés courts. Le titre en
              pleine largeur repoussait les boutons d'envoi hors du premier
              écran, et le bandeau défilait horizontalement sans indice —
              « Séminaires » restait invisible. */}
          <div className="space-y-1.5">
            {!etatReportages.nommes && (
              <p className="text-xs font-bold text-[color:var(--muted)]">
                {t.uploader.nbReportagesStep2}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {sections.map((sec) => {
                const isActive = sec.id === activeTabId;
                // Par `sujetId`, comme la section elle-même : comparer
                // l'étiquette au titre donnait 0 dès qu'un reportage était
                // renommé, alors que ses fichiers étaient bien là.
                const count = filesForSection(uploads, sec).length;

                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveTabId(sec.id)}
                    type="button"
                    style={isActive && sec.tone ? { backgroundColor: sec.tone.fill, color: sec.tone.onFill } : undefined}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl font-bold text-xs motion-tap active:scale-95 ${
                      isActive
                        ? (sec.tone ? 'shadow-md scale-[1.02]' : 'bg-[var(--accent)] text-white shadow-md scale-[1.02]')
                        : 'bg-[var(--paper)] text-[color:var(--ink)] border border-[var(--border)]'
                    }`}
                  >
                    {/* La pastille garde la teinte du reportage même quand
                        l'onglet n'est pas actif : c'est elle qui distingue
                        Reportage 1 de Reportage 2 d'un coup d'œil. */}
                    <span
                      style={sec.tone && !isActive ? { backgroundColor: sec.tone.fill, color: sec.tone.onFill } : undefined}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                        isActive
                          ? 'bg-white/25'
                          : (sec.tone ? '' : 'bg-[var(--accent)]/15 text-[color:var(--accent-deep)]')
                      }`}
                    >
                      {sec.badge}
                    </span>
                    <span>{sec.shortName}</span>
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
          <div className="bg-[var(--paper)] rounded-3xl border border-[var(--border)] p-3.5 shadow-sm space-y-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-base text-[color:var(--ink)]">
                <span
                  style={currentSection.tone ? { backgroundColor: currentSection.tone.fill, color: currentSection.tone.onFill } : undefined}
                  className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                    currentSection.tone ? '' : 'bg-[var(--accent)] text-white'
                  }`}
                >
                  {currentSection.badge}
                </span>
                <span className="truncate">{activeReportageName}</span>
              </h3>
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">{currentSection.hint}</p>
            </div>

            {/* Deux actions, une seule hiérarchie : l'envoi de fichier est
                l'action principale (bouton plein), le script la seconde
                (bouton bordé). Le bleu et l'orange d'origine mettaient les
                deux au même niveau et juraient avec l'accent maison. */}
            <div className="space-y-2.5">
              {/* Button 1: Add Video / File */}
              <button
                onClick={handleTriggerFileInput}
                disabled={isLocked}
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--action)] text-white font-bold text-base shadow-md shadow-[var(--action)]/25 active:scale-[0.98] motion-tap text-left disabled:opacity-50"
              >
                <span className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Video size={24} />
                </span>
                <span className="min-w-0">
                  <span className="block leading-tight">{t.uploader.addMedia}</span>
                  <span className="block text-xs font-medium opacity-85">{t.uploader.addMediaHint}</span>
                </span>
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={UPLOAD_ACCEPT}
                className="hidden"
                disabled={isLocked}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files, activeReportageName, currentSection.sujetId);
                    e.target.value = '';
                  }
                }}
              />

              {/* Button 2: Submit Script */}
              <button
                onClick={() => setScriptModalOpen(true)}
                disabled={isLocked}
                type="button"
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--paper-2)] border-2 border-[var(--border)] text-[color:var(--ink)] font-bold text-base active:scale-[0.98] motion-tap text-left disabled:opacity-50"
              >
                <span className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] flex items-center justify-center shrink-0">
                  <FileText size={24} />
                </span>
                <span className="min-w-0">
                  <span className="block leading-tight">{t.uploader.addScript}</span>
                  <span className="block text-xs font-medium text-[color:var(--muted)]">{t.uploader.addScriptHint}</span>
                </span>
              </button>
              <p className="pt-0.5 text-center text-xs text-[color:var(--muted)]">
                {t.uploader.formatsHint}
              </p>
            </div>

            {/* LIVE UPLOAD / COMPRESSION PROGRESS (if active) */}
            {activeUploading.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--paper-2)] border border-[var(--border)] space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-[color:var(--ink)]">
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border-2 border-[var(--action)]/30 border-t-[var(--action)] rounded-full animate-spin" />
                    <span>Envoi en cours...</span>
                  </span>
                  <span className="text-[11px] text-[color:var(--muted)]">
                    {activeUploading.length} {activeUploading.length > 1 ? 'fichiers' : 'fichier'}
                  </span>
                </div>

                {/* La compression tourne dans le téléphone : quitter la page
                    perdait le travail sans que rien ne l'ait annoncé. */}
                <p className="text-[11px] font-medium text-[color:var(--muted)]">
                  {t.uploader.keepOpen}
                </p>

                <div className="space-y-2">
                  {activeUploading.map((f) => (
                    <div key={f.id} className="bg-[var(--paper)] p-2.5 rounded-xl border border-[var(--border)] space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-semibold text-[color:var(--ink)] truncate">{f.name}</span>
                        <span className="text-[10px] font-bold text-[color:var(--action-deep)] shrink-0">
                          {f.status === 'queued'
                            ? t.uploader.offlineBadge
                            : f.phase === 'processing'
                            ? 'Finalisation...'
                            : `${Math.round(f.progress)}%`}
                        </span>
                      </div>
                      <div className="w-full bg-[var(--paper-2)] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 w-full rounded-full motion-gauge ${
                            f.status === 'error'
                              ? 'bg-[var(--signal)]'
                              : f.status === 'queued'
                              ? 'bg-[var(--border)]'
                              : 'bg-[var(--action)]'
                          }`}
                          style={{ transform: `scaleX(${Math.max(5, f.progress) / 100})` }}
                        />
                      </div>
                      {f.status === 'error' && (
                        <button
                          type="button"
                          onClick={() => onRetryUpload?.(f.id)}
                          className="mt-1 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--action)] text-white font-bold text-xs active:scale-[0.98] transition-transform"
                        >
                          <RotateCcw size={14} />
                          {t.uploader.retryCta}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pense-bête : ce que ce reportage contient déjà. */}
            <ReportageChecklist files={activeUploads} />

            {/* Accusé de réception explicite : la liste de fichiers seule ne
                disait pas au correspondant que son envoi était terminé. */}
            {activeUploads.length > 0 && activeUploading.length === 0 && (
              <div className="motion-rise flex items-start gap-2.5 p-3.5 rounded-2xl bg-[var(--success)]/10 border border-[var(--success)]/30">
                <CheckCircle size={20} className="motion-check shrink-0 text-[color:var(--success-deep)]" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[color:var(--success-deep)]">
                    {t.uploader.sectionDone(activeUploads.length)}
                  </p>
                  <p className="text-xs text-[color:var(--ink)]/75">
                    {t.uploader.sectionDoneHint}
                  </p>
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
                <div className="rounded-2xl bg-[var(--paper-2)] border border-dashed border-[var(--border)]">
                  <EmptyState
                    illustration={<EmptyInbox size={124} />}
                    title={t.uploader.emptySectionTitle}
                    hint={t.uploader.emptySectionHint(t.uploader.addMedia, t.uploader.addScript)}
                    compact
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {activeUploads.map((file) => {
                    const iconConfig = FILE_ICONS[file.type] || FILE_ICONS.script;
                    const Icon = iconConfig.Icon;

                    return (
                      <div
                        key={file.id}
                        className="p-3 rounded-2xl bg-[var(--paper-2)] border border-[var(--border)] flex items-center justify-between gap-2.5 motion-tap shadow-sm"
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
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[color:var(--success-deep)] mt-1">
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

          {/* Rappel du contact, relégué en bas : ce n'est pas une étape du
              parcours, seulement un réglage à vérifier de temps en temps. */}
          {hasPhoneNumber && phone && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[var(--paper-2)] border border-[var(--border)] text-xs">
              <span className="flex items-center gap-2 min-w-0">
                <MessageCircle size={15} className="shrink-0 text-[#25D366]" />
                <span className="font-semibold text-[color:var(--ink)] truncate">
                  WhatsApp : {phone}
                </span>
              </span>
              <button
                type="button"
                onClick={() => (onEditPhone ? onEditPhone() : setHasPhoneNumber?.(false))}
                className="shrink-0 rounded-lg px-2.5 py-1.5 font-bold text-[color:var(--accent-deep)] bg-[var(--accent)]/10 active:scale-95"
              >
                Modifier
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. SCRIPT INPUT BOTTOM DRAWER / MODAL */}
      {scriptModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center p-0 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="fixed inset-0" 
            onClick={() => setScriptModalOpen(false)} 
          />
          <div className="relative w-full max-h-[85vh] bg-[var(--paper)] rounded-t-3xl shadow-2xl border-t border-[var(--border)] p-5 flex flex-col space-y-3 z-10 motion-boite">
            <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto mb-1" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="text-[color:var(--accent-deep)]" size={20} />
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
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[var(--action)] text-white font-bold rounded-xl text-xs shadow-md shadow-[var(--action)]/30 active:scale-95 disabled:opacity-50"
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
                <FileText className="text-[color:var(--accent-deep)]" size={18} />
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

      <ReportagesSheet
        isOpen={sheetNombre !== null}
        nombre={sheetNombre || 0}
        sujets={sujets}
        onClose={() => setSheetNombre(null)}
        onValider={async (reportages) => {
          const res = await onFixerReportages?.(reportages);
          // On se place sur le premier reportage ajouté : c'est là qu'on va
          // déposer. Sinon on reste où l'on était, s'il existe encore.
          const anciens = new Set(sujets.map((x) => x.id));
          const nouveau = (res?.sujets || []).find((x) => !anciens.has(x.id));
          if (nouveau) setActiveTabId(nouveau.id);
          else if (!(res?.sujets || []).some((x) => x.id === activeTabId)) setActiveTabId(res?.sujets?.[0]?.id || 'reportage-0');
        }}
      />
    </div>
  );
}
