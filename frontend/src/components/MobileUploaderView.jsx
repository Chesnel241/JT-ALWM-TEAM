import { useState, useRef, useEffect } from 'react';
import {
  FileText, Video, Mic, CheckCircle,
  Clock, Trash2, AlertCircle,
  HelpCircle, X, ArrowLeft, MessageCircle, Image as ImageIcon, Info,
} from 'lucide-react';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatWeekFull, formatWeekLabel, formatExpiry } from '../lib/dates.js';
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
import ChampWhatsApp from './ChampWhatsApp.jsx';
import ChampScript from './ChampScript.jsx';
import { phoneCountryFor } from '../lib/phone.js';
import { UPLOAD_ACCEPT } from '../lib/mediaTypes.js';
import { reportageTone } from '../lib/branding.js';
import { buildSections, filesForSection, etatNombreReportages, nomAffiche, SECTIONS_FIXES } from '../lib/sujets.js';
import { estEnVol } from '../lib/envoi.js';
import VoyageEnvoi from './VoyageEnvoi.jsx';
import SuiviReportage from './SuiviReportage.jsx';
import PrevenirRedaction from './PrevenirRedaction.jsx';
import OutilsCorrespondant from './OutilsCorrespondant.jsx';

// Charte : bleus du logo et neutres. Le texte coloré sur aplat coloré de la
// version précédente (bleu 500 sur bleu 100, ambre sur ambre) descendait sous
// le seuil de lisibilité ; on passe au bleu profond, à 8:1 sur ces fonds.
const FILE_ICONS = {
  video: { Icon: Video, color: 'text-[color:var(--accent-deep)]', bg: 'bg-v-accent/10' },
  image: { Icon: ImageIcon, color: 'text-[color:var(--accent-deep)]', bg: 'bg-v-accent-soft/25' },
  audio: { Icon: Mic, color: 'text-[color:var(--accent-deep)]', bg: 'bg-v-accent-soft/25' },
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
  onAnnulerModifPhone = null,
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
  onVoirDansLeJT = null,
  onRetryUpload,
  parcours = null,
  isOnline = true,
  queuedCount = 0,
}) {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const currentWeek = weeks.find((w) => w.id === selectedWeek);
  const defaultPhoneCountry = phoneCountryFor(country.id);
  const [activeTabId, setActiveTabId] = useState('reportage-0');
  const [choixSemaine, setChoixSemaine] = useState(false);
  // Après un choix de fichiers, la progression apparaît plus bas que le
  // bouton : on l'amène à l'écran, sinon rien ne semble se passer.
  const progressionRef = useRef(null);
  const nbEnVolRef = useRef(0);
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
      reportage,
      // Un titre de sujet peut être long : l'onglet en montre le début, la
      // carte de section le donne en entier.
      label: nomAffiche(section, t),
      shortName: section.id === 'seminaires' ? t.uploader.sectionSeminairesCourt : nomAffiche(section, t),
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

  const renderOnglet = (sec) => {
    // L'onglet surligné est celui qu'on affiche. Au retour sur la
    // page, `activeTabId` valait encore 'reportage-0' alors que
    // les sections portaient les identifiants du serveur : aucun
    // onglet n'était surligné, et la page montrait le premier.
    const isActive = sec.id === currentSection.id;
    // Par `sujetId`, comme la section elle-même : comparer
    // l'étiquette au titre donnait 0 dès qu'un reportage était
    // renommé, alors que ses fichiers étaient bien là.
    const count = filesForSection(uploads, sec).length;

    return (
      <button
        key={sec.id}
        onClick={() => setActiveTabId(sec.id)}
        type="button"
        aria-current={isActive ? 'true' : undefined}
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
              : (sec.tone ? '' : 'bg-v-accent/15 text-[color:var(--accent-deep)]')
          }`}
        >
          {sec.badge}
        </span>
        {/* Un titre long tronqué, entier au survol et dans la carte : il
          étirait l'onglet sur toute la largeur. */}
      <span className="max-w-[9.5rem] truncate" title={sec.label}>{sec.shortName}</span>
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
  };

  useEffect(() => {
    const enVol = activeUploading.filter(estEnVol).length;
    if (enVol > nbEnVolRef.current && progressionRef.current?.scrollIntoView) {
      const sobre = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      progressionRef.current.scrollIntoView({ behavior: sobre ? 'auto' : 'smooth', block: 'nearest' });
    }
    nbEnVolRef.current = enVol;
  }, [activeUploading]);

  // Le premier reportage encore vide, pour le dire une fois celui-ci reçu.
  const reportageVide = sections.find((sec) => sec.reportage && sec.id !== currentSection.id && filesForSection(uploads, sec).length === 0);

  const handleTriggerFileInput = () => {
    if (isLocked) {
      addToast(t.uploader.lockedToast, 'warning');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleScriptModalSubmit = async () => {
    await handleScriptSubmit(activeReportageName, currentSection.sujetId);
    setScriptModalOpen(false);
  };


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
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-v-accent/10 text-[color:var(--accent-deep)] font-semibold text-xs active:scale-95 transition-transform"
          >
            <HelpCircle size={14} aria-hidden="true" />
            {/* Le libellé court : « Conseils d'écriture » en entier coupait
                le nom du pays en « Came… ». */}
            <span>{t.uploader.guideCourt}</span>
          </button>
        </div>

        {/* La semaine en texte, avec « changer » : le sélecteur ouvert en
            permanence prenait une ligne entière pour un réglage qu'on ne
            touche presque jamais — la semaine en cours est la bonne. */}
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--ink)]" title={currentWeek ? formatWeekFull(currentWeek, lang) : undefined}>
            {currentWeek ? formatWeekLabel(currentWeek, lang) : ''}
            {currentWeek?.status === 'active' ? t.uploader.weekActiveTag : ''}
          </p>
          <button
            type="button"
            onClick={() => setChoixSemaine((v) => !v)}
            aria-expanded={choixSemaine}
            className="shrink-0 min-h-[44px] px-2 text-sm font-bold text-[color:var(--accent-deep)] underline underline-offset-2"
          >
            {t.uploader.changerSemaine}
          </button>
          {isLocked && (
            <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--cta-red)] text-white">
              {t.uploader.lockedBadge}
            </span>
          )}
        </div>
        {choixSemaine && (
          <select
            value={selectedWeek}
            onChange={(e) => { setSelectedWeek(e.target.value); setChoixSemaine(false); }}
            aria-label={t.uploader.weekLabel}
            className="w-full bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-base font-semibold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {formatWeekFull(w, lang)}{w.status === 'active' ? t.uploader.weekActiveTag : ''}
              </option>
            ))}
          </select>
        )}

        {/* L'échéance n'existait que sur ordinateur : sur téléphone, le
            correspondant ne découvrait le retard qu'une fois clôturé. */}
        {currentWeek && <CountdownTimer week={currentWeek} ligne />}
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
        <div className="p-4 rounded-2xl bg-v-cta-red/10 border-2 border-v-cta-red/40 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-[color:var(--cta-red-deep)] font-bold text-base">
            <AlertCircle size={18} />
            <span>{t.uploader.lateTitle}</span>
          </div>
          <p className="text-xs text-[color:var(--ink)]">
            {t.uploader.lateText}
          </p>
          {extensionStatus === 'pending' ? (
            <div className="inline-block px-3 py-1.5 rounded-xl bg-v-cta-orange/10 border border-v-cta-orange/40 text-[color:var(--ink)] text-sm font-bold">
              {t.delais.accuse}
            </div>
          ) : (
            <button
              onClick={handleRequestDelay}
              className="w-full min-h-[52px] rounded-2xl bg-[var(--cta-orange)] text-white font-extrabold text-base shadow-md active:scale-95 motion-tap"
            >
              {t.uploader.delayAsk}
            </button>
          )}
        </div>
      )}

      {/* 4. MANDATORY WHATSAPP SCREEN (If missing) */}
      {!hasPhoneNumber ? (
        <div id="espace-fichiers-mobile" className="p-5 rounded-2xl bg-[var(--paper)] border-2 border-[color:var(--accent)] shadow-sm space-y-4 scroll-mt-24">
          <div className="flex items-center gap-3">
            <div className="bg-[color:var(--accent)] text-white p-2.5 rounded-full shrink-0">
              <Info size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold text-[color:var(--ink)] leading-snug">
                {t.uploader.mandatoryPhoneTitle}
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {/* L'indicatif est déduit du pays choisi : les correspondants
                devaient sinon retrouver le leur dans une longue liste,
                proposée par défaut sur la France. */}
            <ChampWhatsApp
              valeur={phone}
              onChange={setPhone}
              onValider={handleSubscribe}
              enCours={isSubscribing}
              paysDefaut={defaultPhoneCountry}
              onAnnuler={onAnnulerModifPhone}
            />
          </div>
        </div>
      ) : (
        /* 5. STANDARD REPORTAGES VIEW — le conducteur et le Mot du JT ont
           leur propre écran (RubriqueView) : ce ne sont plus des pays. */
        <div id="espace-fichiers-mobile" className="space-y-4 scroll-mt-24">
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
              {sections.filter((sec) => sec.reportage).map((sec) => renderOnglet(sec))}
            </div>
            {/* Annonces et séminaires ne sont pas des reportages : rangés à
                part, sous une étiquette qui dit qu'ils sont facultatifs. Mêlés
                aux reportages, ils passaient pour une étape obligatoire. */}
            <p className="pt-1 text-xs font-bold text-[color:var(--muted)]">{t.uploader.autresEnvois}</p>
            <div className="flex flex-wrap gap-2">
              {sections.filter((sec) => !sec.reportage).map((sec) => renderOnglet(sec))}
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
                <span className="truncate">{currentSection.label}</span>
              </h3>
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">{currentSection.hint}</p>
            </div>

            {/* Où en est ce reportage, du dépôt à la diffusion. */}
            {currentSection.sujetId && <SuiviReportage suivi={currentSection.suivi} onRegarder={onVoirDansLeJT} />}

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
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--action)] text-white font-bold text-base shadow-md shadow-v-action/25 active:scale-[0.98] motion-tap text-left disabled:opacity-50"
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
                <span className="w-12 h-12 rounded-2xl bg-v-accent/10 text-[color:var(--accent-deep)] flex items-center justify-center shrink-0">
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

            {/* Le voyage des fichiers : du drapeau du pays jusqu'au logo ALWM,
                puis Envoi → Traitement → Reçu pour chacun. */}
            <div ref={progressionRef} className="scroll-mt-24">
              <VoyageEnvoi pays={country} envois={activeUploading} onReessayer={onRetryUpload} />
            </div>

            {/* Pense-bête : ce que ce reportage contient déjà. */}
            <ReportageChecklist files={activeUploads} />

            {/* Accusé de réception explicite : la liste de fichiers seule ne
                disait pas au correspondant que son envoi était terminé. */}
            {/* Les envois terminés restent dans la liste jusqu'au rechargement :
                la condition « plus rien en cours » ne pouvait jamais être vraie
                après un envoi fait dans la même séance. */}
            {activeUploads.length > 0 && !activeUploading.some(estEnVol) && (
              <div className="motion-rise flex items-start gap-2.5 p-3.5 rounded-2xl bg-v-success/10 border border-v-success/30">
                <CheckCircle size={20} className="motion-check shrink-0 text-[color:var(--success-deep)]" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[color:var(--success-deep)]">
                    {t.uploader.sectionDone(activeUploads.length)}
                  </p>
                  {/* L'INCIDENT : « Vous pouvez fermer la page » s'affichait
                      alors qu'un envoi tournait encore dans un autre
                      reportage. Fermer l'aurait interrompu. */}
                  <p className="text-xs text-v-ink/75">
                    {uploading.some(estEnVol) ? t.uploader.sectionDoneAutreEnvoi : t.uploader.sectionDoneHint}
                  </p>
                </div>
              </div>
            )}
            {activeUploads.length > 0 && !activeUploading.some(estEnVol) && (
              <PrevenirRedaction
                pays={country.name}
                semaine={formatWeekLabel(currentWeek, lang)}
                nombre={activeUploads.length}
                titre={currentSection.label}
              />
            )}
            {/* Un reportage encore vide : le dire, et y mener d'un geste. Sans
                cela, le correspondant croyait avoir tout envoyé. */}
            {activeUploads.length > 0 && !activeUploading.some(estEnVol) && reportageVide && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-v-cta-orange/40 bg-v-cta-orange/10 p-3">
                <p className="min-w-0 text-sm font-bold text-[color:var(--ink)]">{t.uploader.reportageVide(reportageVide.label)}</p>
                <button
                  type="button"
                  onClick={() => setActiveTabId(reportageVide.id)}
                  className="jr-bouton jr-bouton-orange shrink-0 !min-h-[44px] px-4 text-sm"
                >
                  {t.uploader.yAller}
                </button>
              </div>
            )}

            {/* UPLOADED FILES LIST FOR THIS REPORTAGE */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[color:var(--ink)]">
                  {t.uploader.filesOf(currentSection.label)}
                </span>
                <span className="text-[11px] text-[color:var(--muted)] font-semibold">
                  {t.uploader.totalCount(activeUploads.length)}
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
                                <CheckCircle size={11} /> {t.uploader.approved}
                              </span>
                            )}
                            {file.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--cta-orange-deep)] mt-1">
                                <AlertCircle size={11} /> {t.uploader.toFixNote(file.feedback)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {file.type === 'script' && (
                            <button
                              onClick={() => setPreviewScriptFile(file)}
                              type="button"
                              className="p-2 text-xs font-semibold text-[color:var(--accent-deep)] bg-v-accent/10 rounded-xl active:scale-90"
                              title={t.uploader.readScript}
                              aria-label={t.uploader.readScript}
                            >
                              <FileText size={15} />
                            </button>
                          )}
                          {/* Rouge : supprimer. Une cible de 44 px, et un nom :
                              l'icône seule n'était annoncée par rien, et son
                              infobulle demandait un texte qui n'existait pas. */}
                          <button
                            onClick={() => openDeleteDialog(file)}
                            type="button"
                            className="h-11 w-11 flex items-center justify-center rounded-xl text-[color:var(--cta-red)] bg-v-cta-red/10 hover:bg-v-cta-red/20 active:scale-90 motion-tap"
                            title={t.uploader.supprimerFichier(file.name)}
                            aria-label={t.uploader.supprimerFichier(file.name)}
                          >
                            <Trash2 size={18} />
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
                  {t.uploader.whatsappLabel} {phone}
                </span>
              </span>
              <button
                type="button"
                onClick={() => (onEditPhone ? onEditPhone() : setHasPhoneNumber?.(false))}
                className="shrink-0 rounded-lg px-2.5 py-1.5 font-bold text-[color:var(--accent-deep)] bg-v-accent/10 active:scale-95"
              >
                {t.uploader.edit}
              </button>
            </div>
          )}

          {/* Où en est le pays cette semaine (ParcoursPays, fourni par
              UploaderView) : sous la liste, comme la date d'effacement. En
              tête, il repoussait le bouton d'envoi hors du premier écran. */}
          {parcours}

          {/* Les gestes « une fois pour toutes » : garder l'accès, poser le
              rappel. Ils vivent sous le travail de la semaine, pas devant. */}
          <OutilsCorrespondant pays={country} semaine={weeks.find((w) => w.status === 'active') || currentWeek} />

          {/* Date réelle d'effacement, au lieu du « 48 h » affiché ailleurs :
              la règle est ancrée à la semaine, pas à l'envoi. Sous la liste :
              c'est une information, pas une étape. */}
          {currentWeek?.expiresAt && (
            <p className="flex items-center gap-1.5 text-xs text-[color:var(--muted)]">
              <Clock size={13} className="shrink-0" />
              {t.home.retentionOn(formatExpiry(currentWeek, lang))}
            </p>
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
                  {t.uploader.scriptFor(currentSection.label)}
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
              {t.uploader.scriptModalHint}
            </p>

            <ChampScript
              valeur={scriptText[activeReportageName] || ''}
              onChange={(texte) => setScriptText((prev) => ({ ...prev, [activeReportageName]: texte }))}
              onValider={handleScriptModalSubmit}
              enCours={Boolean(submittingScripts[activeReportageName])}
              lignes={6}
            />
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
              {previewScriptFile.content || previewScriptFile.text || t.uploader.scriptLoading}
            </div>

            <button
              onClick={() => setPreviewScriptFile(null)}
              className="w-full py-2.5 rounded-xl bg-[var(--paper-2)] border border-[var(--border)] font-bold text-xs text-[color:var(--ink)]"
            >
              {t.common.close}
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
