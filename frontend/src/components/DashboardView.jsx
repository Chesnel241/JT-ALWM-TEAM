import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Folder, FileText, Video, Download, Trash2, CheckCircle, XCircle, AlertCircle, UploadCloud, Mic, MoreVertical, Scissors, GripHorizontal, FolderOpen, Sparkles, Plus, Layers, Newspaper, X, Play, Search, Eye, MessageSquare, Phone, Link2, Image as ImageIcon, ListOrdered } from 'lucide-react';
import { api, API_BASE, getClientId } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute, formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import RelancePanel from './RelancePanel.jsx';
import RubriquePanel from './RubriquePanel.jsx';
import { formaterDuree, formaterTotal } from '../lib/duree.js';
import { MEDIA_ORDER, MEDIA_TYPES, groupByReportage, classifyFile } from '../lib/mediaTypes.js';
import { reportageTone } from '../lib/branding.js';

// Les quatre familles de rushes, dans l'ordre où l'équipe montage les
// parcourt. Les images n'avaient pas de rubrique : elles se retrouvaient
// mélangées aux scripts.
const MEDIA_SECTIONS = {
  [MEDIA_TYPES.VIDEO]: { label: 'Vidéos', Icon: Video },
  [MEDIA_TYPES.IMAGE]: { label: 'Images', Icon: ImageIcon },
  [MEDIA_TYPES.AUDIO]: { label: 'Audios', Icon: Mic },
  [MEDIA_TYPES.DOCUMENT]: { label: 'Textes & documents', Icon: FileText },
};
import ConfirmDialog from './ConfirmDialog.jsx';
import SkeletonCard from './SkeletonCard.jsx';
import AIChecklist from './AIChecklist.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import AdminUploadDialog from './AdminUploadDialog.jsx';
import Timeline from './editor/Timeline.jsx';
import TrimModal from './editor/TrimModal.jsx';
import OverlayPanel from './editor/OverlayPanel.jsx';
import GlobalLayerPanel from './editor/GlobalLayerPanel.jsx';
import RemotionLivePreview from './editor/RemotionLivePreview.jsx';
import ExportStatus from './editor/ExportStatus.jsx';
import SubtitlePanel from './editor/SubtitlePanel.jsx';
import InspecteurClip from './editor/InspecteurClip.jsx';
import { DEFAULT_BRANDING, normalizeWorkspace } from './editor/timelineWorkspace.js';
import {
  annuler as annulerHistorique,
  creerHistorique,
  enregistrer,
  peutAnnuler,
  peutRetablir,
  etiquetteSaisie,
  reinitialiser,
  retablir as retablirHistorique,
} from './editor/historiqueMontage.js';
import ActionSheet from './ActionSheet.jsx';
import FeedbackModal from './FeedbackModal.jsx';
import ReporterLinkDialog from './ReporterLinkDialog.jsx';
import { usePiegeFocus } from '../hooks/usePiegeFocus.jsx';

// Clés localStorage : la timeline et le job de montage en cours survivent au
// refresh/changement d'onglet (le rendu continue côté serveur).
const JOB_STORE_KEY = 'jt-editor-job';
const STUDIO_TIMELINE_HEIGHT_KEY = 'jt-studio-timeline-height';
const STUDIO_TIMELINE_MIN_HEIGHT = 340;
const STUDIO_PREVIEW_MIN_HEIGHT = 220;
const STUDIO_SPLITTER_HEIGHT = 16;
const STUDIO_TIMELINE_DEFAULT_HEIGHT = 360;
const timelineKey = (weekId) => `jt-timeline-${weekId}`;
const brandingKey = (weekId) => `jt-branding-${weekId}`;

// Les états d'un sujet, en clair. C'est ce que la rédaction lit sur ses
// blocs : « recu » brut ne dit rien à quelqu'un qui prépare un conducteur.
const ETAT_LABELS = {
  attendu: 'Attendu',
  recu: 'Reçu',
  a_corriger: 'À corriger',
  valide: 'Validé',
  au_conducteur: 'Au conducteur',
};

function clampTimelineHeight(value, maxHeight) {
  const safeMax = Math.max(STUDIO_TIMELINE_MIN_HEIGHT, maxHeight);
  return Math.min(safeMax, Math.max(STUDIO_TIMELINE_MIN_HEIGHT, Math.round(value)));
}

function probeVideoDuration(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    let timeout;
    const finish = (duration = 0) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
    };
    timeout = setTimeout(() => finish(), 5000);

    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish();
    video.src = url;
  });
}

// Le chutier aligne des dizaines de vignettes : avec preload="metadata" sur
// chacune, ouvrir un pays déclenchait autant de requêtes vidéo d'un coup. On
// ne demande les métadonnées que pour les vignettes réellement à l'écran ;
// l'icône de fond reste visible tant que l'aperçu n'est pas chargé.
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver !== 'function') {
      // Navigateur (ou jsdom) sans IntersectionObserver : mieux vaut une
      // vignette chargée qu'une vignette qui n'apparaît jamais.
      setInView(true);
      return undefined;
    }
    // La marge laisse le temps de charger avant que la carte n'entre à l'écran.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setInView(true);
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  return [ref, inView];
}

function LazyVideoThumbnail({ src, className }) {
  const [ref, inView] = useInView();

  return (
    <video
      ref={ref}
      src={inView ? src : undefined}
      className={className}
      preload={inView ? 'metadata' : 'none'}
      muted
      playsInline
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}

// Même économie pour la grille de cartes, qui lit au survol : sans ce garde,
// ouvrir un pays réclamait les métadonnées de toutes les vidéos d'un coup,
// sur des masters de plusieurs gigaoctets.
function HoverPreviewVideo({ src, className }) {
  const [ref, inView] = useInView();

  return (
    <video
      ref={ref}
      src={inView ? src : undefined}
      className={className}
      preload={inView ? 'metadata' : 'none'}
      onMouseEnter={(e) => { if (inView) e.currentTarget.play().catch(() => {}); }}
      onMouseLeave={(e) => {
        e.currentTarget.pause();
        e.currentTarget.currentTime = 0.1;
      }}
      muted
      playsInline
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}

function ScriptViewerContent({ file, selectedWeek, selectedBin, adminPassword, onContentChange }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const url = `${API_BASE}/uploads/${file.filename}?proxy=true`;
    // Mot de passe admin en en-tête (jamais en query : fuite dans logs/historique).
    const headers = {};
    if (selectedBin === 'mj' && adminPassword) headers['X-Admin-Password'] = adminPassword;

    fetch(url, { headers })
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const isMj = selectedBin === 'mj';
      // Maintient l'extension .txt
      const newFile = new File([content], file.name || file.filename, { type: 'text/plain' });
      await api.uploadFile(selectedWeek, selectedBin, newFile, { 
        adminPassword,
        reportage: isMj ? 'Détails' : (selectedBin === 'tj' ? 'Titres' : '')
      });
      addToast('Script sauvegardé avec succès', 'success');
      setIsEditing(false);
      if (onContentChange) onContentChange();
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de la sauvegarde du script', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full text-[color:var(--muted)]">Chargement du texte...</div>;
  if (error) return <div className="text-[var(--signal)] font-medium text-center mt-10 flex flex-col items-center gap-2"><AlertCircle /> {error}</div>;

  return (
    <div className="w-full h-full flex flex-col">
      {isEditing ? (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full flex-1 min-h-[300px] p-4 bg-[var(--paper-2)] border border-[var(--border)] rounded text-[color:var(--ink)] font-sans text-base leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <div className="flex justify-end gap-3 mt-4">
            <button 
              onClick={() => setIsEditing(false)} 
              className="px-4 py-2 rounded-lg font-medium text-sm border border-[var(--border)] text-[color:var(--ink)] hover:bg-[var(--paper-2)] transition-colors disabled:opacity-50"
              disabled={isSaving}
            >
              Annuler
            </button>
            <button 
              onClick={handleSave} 
              className="px-4 py-2 rounded-lg font-medium text-sm bg-[var(--action)] text-white hover:bg-[var(--action-deep)] transition-colors shadow-sm disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </>
      ) : (
        <>
          {adminPassword && (
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-deep)] flex items-center gap-1 transition-colors"
              >
                <FileText size={16} /> Éditer le texte
              </button>
            </div>
          )}
          <pre className="whitespace-pre-wrap font-sans text-[color:var(--ink)] text-base leading-relaxed max-w-none p-4 bg-[var(--paper-2)] border border-[var(--border)] rounded flex-1 overflow-y-auto min-h-[300px]">
            {content}
          </pre>
        </>
      )}
    </div>
  );
}

function ScriptViewerModal({ file, onClose, selectedWeek, selectedBin, adminPassword, onContentChange }) {
  // Troisième copie du même piège de focus, après `ConfirmDialog` et
  // `AdminUploadDialog`. Trois copies de quarante lignes pour un geste que
  // sept autres panneaux n'avaient pas du tout : c'est exactement ce que le
  // hook commun corrige.
  const dialogRef = usePiegeFocus(Boolean(file), onClose);

  if (!file) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="script-viewer-title">
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-[var(--border)] motion-boite">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--paper-2)]">
          <h3 id="script-viewer-title" className="font-bold text-lg text-[color:var(--ink)] flex items-center gap-2">
            {file?.type === 'video' || !!file?.name?.match(/\.(mp4|mov|avi|mkv)$/i) ? (
              <Video className="text-[color:var(--accent)]" size={20} aria-hidden="true" />
            ) : file?.type === 'audio' || !!file?.name?.match(/\.(mp3|wav|m4a|webm|ogg)$/i) ? (
              <Mic className="text-[color:var(--accent)]" size={20} aria-hidden="true" />
            ) : (
              <FileText className="text-[color:var(--accent)]" size={20} aria-hidden="true" />
            )}
            <span className="truncate max-w-[250px] sm:max-w-md">{file?.name}</span>
          </h3>
          <button 
            onClick={onClose}
            aria-label="Fermer le lecteur de script"
            className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] rounded-lg transition-colors focus-ring focus:outline-none"
          >
            <XCircle size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-[var(--paper)] min-h-[300px] relative flex flex-col items-center justify-center">
          {(() => {
            const isVideo = file?.type === 'video' || !!file?.name?.match(/\.(mp4|mov|avi|mkv)$/i);
            const isAudio = file?.type === 'audio' || !!file?.name?.match(/\.(mp3|wav|m4a|webm|ogg)$/i);
            const url = `${API_BASE}/uploads/${file?.filename}`;
            
            if (isVideo) {
              return <video src={url} controls autoPlay className="max-w-full max-h-[60vh] rounded shadow-lg" playsInline />;
            } else if (isAudio) {
              return <audio src={url} controls autoPlay className="w-full mt-4" />;
            } else {
              return <ScriptViewerContent file={file} selectedWeek={selectedWeek} selectedBin={selectedBin} adminPassword={adminPassword} onContentChange={onContentChange} />;
            }
          })()}
        </div>
      </div>
    </div>
  );
}
export default function DashboardView({ weeks, selectedWeek, setSelectedWeek, countries, isActive = true, isDesktopEditorAvailable = true }) {
  const { t, lang } = useI18n();
  const { addToast } = useToast();
  const [dashboard, setDashboard] = useState({});
  // Sujets de la semaine, toutes équipes confondues : ce sont eux qui portent
  // le titre et l'état, là où le fichier ne porte qu'une étiquette.
  const [sujets, setSujets] = useState([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [manualBins, setManualBins] = useState([]);
  const [selectedBin, setSelectedBin] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mobileRushFilter, setMobileRushFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [viewingScript, setViewingScript] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSheetFile, setActionSheetFile] = useState(null);
  
  // Admin Upload State
  const [adminUploadOpen, setAdminUploadOpen] = useState(false);
  const [isUploadingAdmin, setIsUploadingAdmin] = useState(false);

  const [authenticatedAdminPassword, setAuthenticatedAdminPassword] = useState('');
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');

  // Delivery Upload State
  const [deliveryUploading, setDeliveryUploading] = useState([]);
  const [deliveryDragActive, setDeliveryDragActive] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  // Download State
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [fileToDownload, setFileToDownload] = useState(null);

  // Feedback State
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackPhone, setFeedbackPhone] = useState(null);
  const [fileToFeedback, setFileToFeedback] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  
  // Editor State
  const [timelineClips, setTimelineClips] = useState([]);
  const [timelineOverlays, setTimelineOverlays] = useState([]);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  // L'annulation porte sur le montage entier — clips, titres de la piste T1 et
  // habillage global — et elle vit ici parce que c'est le seul endroit qui
  // détienne les trois. Elle vivait dans la timeline et ne connaissait que les
  // clips : supprimer un titre était définitif, et taper une lettre dans
  // l'inspecteur effaçait toute la pile.
  const [historique, setHistorique] = useState(creerHistorique);
  const montageRef = useRef({ clips: [], overlays: [], branding: DEFAULT_BRANDING });
  const [showGlobalPanel, setShowGlobalPanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [subtitleTarget, setSubtitleTarget] = useState(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState('');
  const [exportError, setExportError] = useState(null);
  const [exportStartedAt, setExportStartedAt] = useState(null);
  const [exportElapsed, setExportElapsed] = useState(0);
  const [trimTarget, setTrimTarget] = useState(null); // file being trimmed
  const [overlayTarget, setOverlayTarget] = useState(null); // clip being annotated
  const [showRushesDrawer, setShowRushesDrawer] = useState(false);
  const [rushesSearch, setRushesSearch] = useState('');
  const [rushesCountryFilter, setRushesCountryFilter] = useState('all');
  const sseRef = useRef(null);
  const pollRef = useRef(null);
  const safetyRef = useRef(null);
  const playerRef = useRef(null);
  const lastRushBinRef = useRef(null);
  const timelineHydratedWeekRef = useRef(null);
  const timelineSaveTimerRef = useRef(null);
  const pendingTimelineSaveRef = useRef(null);
  const lastSyncedTimelineRef = useRef('');
  const studioWorkspaceRef = useRef(null);
  const timelineResizeRef = useRef(null);
  const [studioTimelineMaxHeight, setStudioTimelineMaxHeight] = useState(STUDIO_TIMELINE_DEFAULT_HEIGHT);
  const [studioTimelineHeight, setStudioTimelineHeight] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(STUDIO_TIMELINE_HEIGHT_KEY));
      return Number.isFinite(saved) ? Math.max(STUDIO_TIMELINE_MIN_HEIGHT, saved) : STUDIO_TIMELINE_DEFAULT_HEIGHT;
    } catch {
      return STUDIO_TIMELINE_DEFAULT_HEIGHT;
    }
  });
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const [timelineSyncState, setTimelineSyncState] = useState('loading');
  const [editorPresenceCount, setEditorPresenceCount] = useState(1);
  const generateLockRef = useRef(false);
  // Révision du montage telle que le serveur nous l'a donnée : renvoyée en
  // baseRevision pour qu'il refuse (409) d'écraser le travail d'un collègue.
  const timelineRevisionRef = useRef(null);
  // Valeurs lues depuis des fermetures de longue durée (flush au démontage,
  // gestionnaires socket). Les mettre en dépendance d'effet reconnecterait la
  // socket ou relancerait l'hydratation à chaque changement.
  const adminPasswordRef = useRef(authenticatedAdminPassword);
  const isGeneratingVideoRef = useRef(false);
  useEffect(() => { adminPasswordRef.current = authenticatedAdminPassword; }, [authenticatedAdminPassword]);
  useEffect(() => { isGeneratingVideoRef.current = isGeneratingVideo; }, [isGeneratingVideo]);

  // Miroir de rendu : `modifierMontage` lit cette référence de façon
  // synchrone, avant le rendu suivant. Même convention que `clipsRef` dans la
  // timeline.
  montageRef.current = { clips: timelineClips, overlays: timelineOverlays, branding };

  /** Pose un état de montage complet, sans rien enregistrer dans l'historique. */
  const poserMontage = useCallback((etat) => {
    montageRef.current = etat;
    setTimelineClips(etat.clips);
    setTimelineOverlays(etat.overlays);
    setBranding(etat.branding);
  }, []);

  /**
   * Le seul chemin par lequel une modification LOCALE passe.
   *
   * `etiquette` dit de quel geste il s'agit : deux frappes successives dans le
   * même champ n'en font qu'une, mais couper puis taper restent deux gestes.
   * Sans cela, taper un titre de quarante caractères demanderait quarante
   * « Annuler ».
   */
  const ajusterSansHistorique = useCallback((maj) => {
    const apres = maj(montageRef.current);
    if (apres && apres !== montageRef.current) poserMontage(apres);
  }, [poserMontage]);

  const modifierMontage = useCallback((maj, etiquette = null, fenetre = undefined) => {
    const avant = montageRef.current;
    const apres = typeof maj === 'function' ? maj(avant) : { ...avant, ...maj };
    if (!apres || apres === avant) return;
    setHistorique((h) => enregistrer(h, avant, { etiquette, maintenant: Date.now(), ...(fenetre !== undefined ? { fenetre } : {}) }));
    poserMontage(apres);
  }, [poserMontage]);

  /**
   * Ce que l'inspecteur écrit, qu'il s'agisse d'un habillage de clip ou des
   * titres de la piste T1.
   */
  const appliquerInspecteur = useCallback((updatedClip) => {
    if (updatedClip.isTimelineOverlays) {
      modifierMontage((m) => ({ ...m, overlays: updatedClip.overlays || [] }), etiquetteSaisie('T1', 'inspecteur'));
      return;
    }
    modifierMontage(
      (m) => ({ ...m, clips: m.clips.map((c) => (c.instanceId === updatedClip.instanceId ? updatedClip : c)) }),
      etiquetteSaisie(updatedClip.instanceId, 'inspecteur'),
    );
  }, [modifierMontage]);

  const annulerMontage = useCallback(() => {
    setHistorique((h) => {
      const recul = annulerHistorique(h, montageRef.current);
      if (recul.etat) poserMontage(recul.etat);
      return recul.historique;
    });
  }, [poserMontage]);

  const retablirMontage = useCallback(() => {
    setHistorique((h) => {
      const avance = retablirHistorique(h, montageRef.current);
      if (avance.etat) poserMontage(avance.etat);
      return avance.historique;
    });
  }, [poserMontage]);

  // Charge un workspace serveur dans l'état local. markSynced=false marque le
  // montage comme non synchronisé (mode hors ligne) sans toucher à l'affichage.
  //
  // C'est le SEUL chemin qui efface l'historique : hydratation d'une semaine,
  // notification socket d'un collègue, adoption de la copie serveur après un
  // 409. Annuler l'arrivée d'un collègue réécraserait son travail en silence.
  const applyWorkspace = useCallback((workspace, { markSynced = true } = {}) => {
    const next = normalizeWorkspace(workspace);
    poserMontage({ clips: next.clips, overlays: next.overlays, branding: next.branding });
    setHistorique(reinitialiser());
    timelineRevisionRef.current = next.revision;
    lastSyncedTimelineRef.current = markSynced ? JSON.stringify(next.payload) : '';
    return next;
  }, [poserMontage]);

  const countriesWithUploads = useMemo(() => {
    const uploaded = Object.keys(dashboard).filter(
      (id) => dashboard[id]?.length > 0 || id === 'tj'
    );
    // Un pays qui a ouvert un sujet sans encore rien envoyer doit apparaître :
    // c'est précisément lui qu'il faut relancer le dimanche après-midi. Avant,
    // il était simplement absent de la liste, donc invisible.
    const annonces = sujets.map((s) => s.countryId).filter(Boolean);
    // Les rubriques ont leur propre groupe dans la barre latérale : les
    // laisser ici les remettrait au milieu des pays.
    return Array.from(new Set([...uploaded, ...annonces, ...manualBins]))
      .filter((id) => id !== 'tj' && id !== 'mj');
  }, [dashboard, manualBins, sujets]);

  /** Pays qui ont annoncé un sujet mais n'ont encore rien déposé. */
  const countriesAttendus = useMemo(() => {
    const set = new Set();
    for (const sujet of sujets) {
      if (!sujet.countryId) continue;
      if ((dashboard[sujet.countryId]?.length || 0) === 0) set.add(sujet.countryId);
    }
    return set;
  }, [sujets, dashboard]);

  const SPECIAL_BINS = ['delivery', 'mj', 'tj', 'studio'];

  // Depuis que le conducteur et le Mot du JT ont quitté la liste des pays, la
  // barre latérale ne trouvait plus de nom pour leurs tiroirs et retombait sur
  // les codes bruts « tj » et « mj ». On demande au serveur comment il les
  // nomme, plutôt que de recopier ici une table qui existe déjà deux fois.
  const [nomsRubriques, setNomsRubriques] = useState({});
  useEffect(() => {
    api.getDescriptionsRubriques()
      .then((liste) => {
        if (!Array.isArray(liste)) return;
        setNomsRubriques(Object.fromEntries(liste.map((r) => [r.bin, r.nom])));
      })
      .catch(() => { /* les codes bruts restent le repli */ });
  }, []);

  /** Le nom d'un tiroir : un pays, une rubrique, ou son identifiant brut. */
  const nomDuChutier = (id) => (
    countries.find((c) => c.id === id)?.name || nomsRubriques[id] || id
  );

  // Les deux rubriques du journal sont toujours là, même sans fichier : leur
  // TEXTE existe avant leur audio, et c'est justement ce que le monteur vient
  // chercher. Tant qu'elles dépendaient d'un dépôt, le conducteur écrit par la
  // rédaction restait invisible depuis l'espace montage.
  const binsRubriques = ['tj', 'mj'];

  const binIsValid = (bin) =>
    bin && (SPECIAL_BINS.includes(bin) || countriesWithUploads.includes(bin));

  const isStudioActive = isDesktopEditorAvailable && selectedBin === 'studio';

  const getCountryPhone = (cId) => {
    const sub = subscriptions.find((s) => s.countryId === cId);
    return sub ? sub.phone : null;
  };

  const { weekAudioFiles, weekImageFiles, weekVideoFiles } = useMemo(() => {
    const audio = [];
    const image = [];
    const video = [];
    Object.entries(dashboard || {}).forEach(([countryId, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach((f) => {
        if (!f || !f.filename) return;
        const entry = { ...f, countryId, filename: f.filename, name: f.name || f.filename };
        if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.filename) || f.type === 'image') image.push(entry);
        else if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(f.filename) || f.type === 'audio') audio.push(entry);
        else if (/\.(mp4|mov|avi|mkv|webm)$/i.test(f.filename) || f.type === 'video') video.push(entry);
      });
    });
    return { weekAudioFiles: audio, weekImageFiles: image, weekVideoFiles: video };
  }, [dashboard]);

  const openRushes = () => {
    let savedBin = null;
    try { savedBin = selectedWeek ? localStorage.getItem(`jt-bin-${selectedWeek}`) : null; } catch { /* ignore */ }
    const candidates = [lastRushBinRef.current, savedBin, ...countriesWithUploads];
    const target = candidates.find((bin) => (
      bin && bin !== 'studio' && bin !== 'delivery' && binIsValid(bin)
    )) || countries[0]?.id || 'tj';
    lastRushBinRef.current = target;
    setSelectedBin(target);
  };

  const addClipDirectlyToTimeline = (file) => {
    const generateId = () => (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
    const isExternal = file.filename?.startsWith('http') || file.filename?.startsWith('blob:');
    // Pas de mot de passe dans l'URL : /uploads est servi sans authentification
    // et une query string finit dans les journaux d'accès et l'historique.
    const url = isExternal ? file.filename : `${API_BASE}/uploads/${file.filename || file.name}?cors=2`;
    const newClip = {
      ...file,
      url,
      inPoint: 0,
      outPoint: undefined,
      durationSec: file.durationSec || 10,
      instanceId: generateId(),
      overlays: file.overlays || [],
    };
    modifierMontage((m) => ({ ...m, clips: [...m.clips, newClip] }));
    addToast(`"${file.name || file.filename}" ajouté à la timeline`, 'success', 2000);
  };

  // Un seul inspecteur doit être visible à la fois.
  // Le clip sélectionné dans la timeline, pour que l'inspecteur au repos le
  // montre au lieu de dire qu'aucun clip n'est sélectionné.
  const [clipSelectionne, setClipSelectionne] = useState(null);
  const openTrimInspector = (clip) => {
    setOverlayTarget(null);
    setSubtitleTarget(null);
    setShowGlobalPanel(false);
    setTrimTarget(clip);
  };
  const openOverlayInspector = (clip) => {
    setTrimTarget(null);
    setSubtitleTarget(null);
    setShowGlobalPanel(false);
    setOverlayTarget(clip);
  };
  const openSubtitleInspector = (clip) => {
    setTrimTarget(null);
    setOverlayTarget(null);
    setShowGlobalPanel(false);
    setSubtitleTarget(clip);
  };
  const openGlobalInspector = () => {
    setTrimTarget(null);
    setOverlayTarget(null);
    setSubtitleTarget(null);
    setShowGlobalPanel(true);
  };

  const addRushDirectlyToTimeline = (file, loadedDuration = 0) => {
    const instanceId = window.crypto?.randomUUID?.()
      || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const filename = file.filename || file.name || '';
    const isExternal = filename.startsWith('http') || filename.startsWith('blob:');
    const url = file.url?.startsWith('http') || file.url?.startsWith('blob:')
      ? file.url
      : isExternal
        ? filename
        : `${API_BASE}/uploads/${encodeURIComponent(filename)}?cors=2`;
    const knownDuration = Number(loadedDuration) > 0
      ? Number(loadedDuration)
      : Number(file.sourceDurationSec) > 0
        ? Number(file.sourceDurationSec)
        : 0;
    const newClip = {
      ...file,
      url,
      instanceId,
      ...(knownDuration > 0
        ? { sourceDurationSec: knownDuration, durationSec: knownDuration }
        : {}),
    };

    modifierMontage((m) => ({ ...m, clips: [...m.clips, newClip] }));
    setTrimTarget(null);
    setOverlayTarget(null);
    setSubtitleTarget(null);
    setShowGlobalPanel(false);
    setSelectedBin('studio');
    addToast('Clip ajouté directement à la timeline', 'success', 2000);

    // La carte possède généralement déjà la durée grâce à sa miniature. Si
    // ce n'est pas le cas, on complète silencieusement le clip dès que les
    // métadonnées arrivent, sans écraser un trim effectué entre-temps.
    if (knownDuration <= 0) {
      probeVideoDuration(url).then((duration) => {
        if (duration <= 0) return;
        ajusterSansHistorique((m) => ({ ...m, clips: m.clips.map((clip) => {
          if (clip.instanceId !== instanceId) return clip;
          const hasBeenTrimmed = clip.outPoint != null || Number(clip.durationSec) > 0;
          return {
            ...clip,
            sourceDurationSec: duration,
            ...(!hasBeenTrimmed ? { durationSec: duration } : {}),
          };
        }) }));
      });
    }
  };

  useEffect(() => {
    if (selectedBin && selectedBin !== 'studio' && selectedBin !== 'delivery') {
      lastRushBinRef.current = selectedBin;
    }
  }, [selectedBin]);

  const updateStudioTimelineHeight = (nextHeight) => {
    setStudioTimelineHeight(clampTimelineHeight(nextHeight, studioTimelineMaxHeight));
  };

  const beginTimelineResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    timelineResizeRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: studioTimelineHeight,
    };
    setIsResizingTimeline(true);
  };

  const handleTimelineResizeKeyDown = (event) => {
    const step = event.shiftKey ? 64 : 24;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      updateStudioTimelineHeight(studioTimelineHeight + step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      updateStudioTimelineHeight(studioTimelineHeight - step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      updateStudioTimelineHeight(studioTimelineMaxHeight);
    } else if (event.key === 'End') {
      event.preventDefault();
      updateStudioTimelineHeight(STUDIO_TIMELINE_MIN_HEIGHT);
    }
  };

  useEffect(() => {
    try { localStorage.setItem(STUDIO_TIMELINE_HEIGHT_KEY, String(studioTimelineHeight)); } catch { /* mode privé */ }
  }, [studioTimelineHeight]);

  useEffect(() => {
    if (selectedBin !== 'studio' || !studioWorkspaceRef.current) return undefined;
    const workspace = studioWorkspaceRef.current;
    const updateBounds = () => {
      const availableHeight = workspace.getBoundingClientRect().height;
      const maxHeight = Math.max(
        STUDIO_TIMELINE_MIN_HEIGHT,
        availableHeight - STUDIO_PREVIEW_MIN_HEIGHT - STUDIO_SPLITTER_HEIGHT,
      );
      setStudioTimelineMaxHeight(maxHeight);
      setStudioTimelineHeight((current) => clampTimelineHeight(current, maxHeight));
    };
    updateBounds();
    // Deux mesures différées couvrent le chargement paresseux du studio et
    // les navigateurs embarqués qui n'exposent pas ResizeObserver.
    const settleFrame = window.requestAnimationFrame(updateBounds);
    const settleTimer = window.setTimeout(updateBounds, 250);
    const finalSettleTimer = window.setTimeout(updateBounds, 1000);
    window.addEventListener('resize', updateBounds);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateBounds) : null;
    observer?.observe(workspace);
    return () => {
      window.cancelAnimationFrame(settleFrame);
      window.clearTimeout(settleTimer);
      window.clearTimeout(finalSettleTimer);
      window.removeEventListener('resize', updateBounds);
      observer?.disconnect();
    };
  }, [selectedBin]);

  useEffect(() => {
    const move = (event) => {
      const drag = timelineResizeRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const nextHeight = drag.startHeight + (drag.startY - event.clientY);
      setStudioTimelineHeight(clampTimelineHeight(nextHeight, studioTimelineMaxHeight));
    };
    const finish = (event) => {
      const drag = timelineResizeRef.current;
      if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
      timelineResizeRef.current = null;
      setIsResizingTimeline(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [studioTimelineMaxHeight]);

  // Chrono d'assemblage : temps écoulé depuis le lancement du rendu.
  useEffect(() => {
    if (!isGeneratingVideo || !exportStartedAt) { setExportElapsed(0); return undefined; }
    const id = setInterval(() => setExportElapsed(Math.floor((Date.now() - exportStartedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isGeneratingVideo, exportStartedAt]);

  useEffect(() => {
    return () => {
      if (sseRef.current) {
        try { sseRef.current.close(); } catch { /* ignore */ }
      }
      if (pollRef.current) clearInterval(pollRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    };
  }, []);

  // Supression de l'effacement du mot de passe (le mot de passe est gardé en mémoire pour la session)

  // Charge le dashboard et le projet de montage partagé à chaque changement
  // de semaine. Le serveur est la source de vérité ; le localStorage ne sert
  // qu'à migrer une ancienne timeline créée avant cette fonctionnalité.
  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;
    setLoading(true);
    setGeneratedVideoUrl(null);
    setTimelineSyncState('loading');
    timelineHydratedWeekRef.current = null;

    const pending = pendingTimelineSaveRef.current;
    if (pending && pending.weekId !== selectedWeek) {
      window.clearTimeout(timelineSaveTimerRef.current);
      api.saveTimelineWorkspace(pending.weekId, pending.payload, adminPasswordRef.current).catch(console.error);
      pendingTimelineSaveRef.current = null;
    }

    const readLegacyWorkspace = () => {
      try {
        const clips = JSON.parse(localStorage.getItem(timelineKey(selectedWeek)) || '[]');
        const overlays = JSON.parse(localStorage.getItem(`jt-timeline-overlays-${selectedWeek}`) || '[]');
        const savedBranding = JSON.parse(localStorage.getItem(brandingKey(selectedWeek)) || 'null');
        return {
          clips: Array.isArray(clips) ? clips : [],
          overlays: Array.isArray(overlays) ? overlays : [],
          branding: savedBranding && typeof savedBranding === 'object'
            ? { ...DEFAULT_BRANDING, ...savedBranding }
            : DEFAULT_BRANDING,
        };
      } catch {
        return { clips: [], overlays: [], branding: DEFAULT_BRANDING };
      }
    };

    const hydrateTimeline = async () => {
      let workspace;
      let migratedFromBrowser = false;
      let onlineAvailable = true;
      try {
        const response = await api.getTimelineWorkspace(selectedWeek, adminPasswordRef.current);
        workspace = response?.workspace;
        if (!workspace) {
          workspace = readLegacyWorkspace();
          migratedFromBrowser = workspace.clips.length > 0
            || workspace.overlays.length > 0
            || localStorage.getItem(brandingKey(selectedWeek)) != null;
        }
      } catch (error) {
        console.error(error);
        onlineAvailable = false;
        workspace = readLegacyWorkspace();
        if (!cancelled) {
          setTimelineSyncState('error');
          addToast('Sauvegarde en ligne indisponible, montage conservé sur ce poste', 'error');
        }
      }
      if (cancelled) return;

      const { payload } = applyWorkspace(workspace, { markSynced: onlineAvailable });
      timelineHydratedWeekRef.current = selectedWeek;
      setTimelineSyncState(onlineAvailable ? 'saved' : 'error');

      if (migratedFromBrowser) {
        try {
          setTimelineSyncState('saving');
          const migrated = await api.saveTimelineWorkspace(
            selectedWeek,
            { ...payload, baseRevision: timelineRevisionRef.current },
            adminPasswordRef.current,
          );
          if (migrated?.workspace?.revision != null) timelineRevisionRef.current = migrated.workspace.revision;
          if (cancelled) return;
          localStorage.removeItem(timelineKey(selectedWeek));
          localStorage.removeItem(`jt-timeline-overlays-${selectedWeek}`);
          localStorage.removeItem(brandingKey(selectedWeek));
          setTimelineSyncState('saved');
          addToast('Ancien montage transféré vers la sauvegarde en ligne', 'success', 2500);
        } catch (error) {
          console.error(error);
          if (!cancelled) setTimelineSyncState('error');
        }
      }
    };

    hydrateTimeline();

    api.getDashboard(selectedWeek, adminPasswordRef.current)
      .then(setDashboard)
      .catch((err) => {
        console.error(err);
        addToast(err.message || t.uploader.errorPrefix, 'error');
      })
      .finally(() => setLoading(false));

    api.getSujets(selectedWeek, null, adminPasswordRef.current)
      .then((list) => setSujets(Array.isArray(list) ? list : []))
      .catch(() => setSujets([]));

    api.getDeliveries(selectedWeek)
      .then(setDeliveries)
      .catch(console.error);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, authenticatedAdminPassword]);

  // Sauvegarde en ligne, debouncée pour ne pas envoyer une requête à chaque
  // pixel pendant le rognage. Le projet est ensuite disponible sur tout poste.
  useEffect(() => {
    if (!selectedWeek || timelineHydratedWeekRef.current !== selectedWeek) return;
    const payload = {
      clips: timelineClips.map(({ url: _url, ...clip }) => clip),
      overlays: timelineOverlays,
      branding,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSyncedTimelineRef.current) return;

    window.clearTimeout(timelineSaveTimerRef.current);
    pendingTimelineSaveRef.current = { weekId: selectedWeek, payload, serialized };
    setTimelineSyncState('saving');
    timelineSaveTimerRef.current = window.setTimeout(async () => {
      const pendingSave = pendingTimelineSaveRef.current;
      if (!pendingSave || pendingSave.weekId !== selectedWeek) return;
      try {
        // baseRevision : le serveur refuse (409) si un collègue a sauvegardé
        // entre notre dernière lecture et cet envoi.
        const response = await api.saveTimelineWorkspace(
          selectedWeek,
          { ...pendingSave.payload, baseRevision: timelineRevisionRef.current },
          adminPasswordRef.current,
        );
        if (response?.workspace?.revision != null) timelineRevisionRef.current = response.workspace.revision;
        if (pendingTimelineSaveRef.current?.serialized === pendingSave.serialized) {
          lastSyncedTimelineRef.current = pendingSave.serialized;
          pendingTimelineSaveRef.current = null;
          setTimelineSyncState('saved');
        }
      } catch (error) {
        console.error(error);
        if (error?.status === 409 && error?.code === 'TIMELINE_CONFLICT' && error.body?.workspace) {
          // Conflit : on abandonne notre envoi plutôt que d'écraser le travail
          // de l'autre monteur, et on repart de sa version.
          pendingTimelineSaveRef.current = null;
          applyWorkspace(error.body.workspace);
          setTimelineSyncState('saved');
          addToast('Un autre monteur a modifié le montage. Votre vue a été actualisée.', 'error');
          return;
        }
        setTimelineSyncState('error');
        addToast('Le montage n’a pas pu être sauvegardé en ligne', 'error');
      }
    }, 600);
  }, [timelineClips, timelineOverlays, branding, selectedWeek, applyWorkspace, addToast]);

  useEffect(() => () => {
    window.clearTimeout(timelineSaveTimerRef.current);
    const pending = pendingTimelineSaveRef.current;
    if (pending) api.saveTimelineWorkspace(pending.weekId, pending.payload, adminPasswordRef.current).catch(console.error);
  }, []);

  // Reprend le suivi d'un montage en cours après un refresh/onglet ou si un collègue
  // a lancé le rendu sur cette semaine : le rendu continue côté serveur, on récupère sa progression.
  useEffect(() => {
    const localJobId = localStorage.getItem(JOB_STORE_KEY);
    if (localJobId) {
      trackJob(localJobId, { resume: true });
    } else if (selectedWeek && isAuthenticatedAdmin) {
      api.getWeekActiveJob(selectedWeek)
        .then((res) => {
          if (res?.job && res.job.status === 'processing') {
            trackJob(res.job.jobId, { resume: true });
          } else if (res?.job && res.job.status === 'done' && res.job.url) {
            setGeneratedVideoUrl(/^https?:\/\//.test(res.job.url) ? res.job.url : `${API_BASE}${res.job.url}`);
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, isAuthenticatedAdmin]);

  // Refresh dashboard quietly when becoming active
  useEffect(() => {
    if (!selectedWeek || !isActive) return;
    api.getDashboard(selectedWeek, adminPasswordRef.current)
      .then(setDashboard)
      .catch(console.error);
    api.getDeliveries(selectedWeek)
      .then(setDeliveries)
      .catch(console.error);
  }, [isActive, selectedWeek, authenticatedAdminPassword]);

  // Connect socket.io for real-time updates when authenticated as admin
  useEffect(() => {
    if (!isAuthenticatedAdmin || !selectedWeek) return;

    const socketUrl = API_BASE || window.location.origin;
    const token = localStorage.getItem('app-password') || '';
    const socket = io(socketUrl, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    socket.on('connect', () => {
      socket.emit('join_week', selectedWeek);
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error', err.message);
    });

    socket.on('editor_presence', (data) => {
      if (data.weekId === selectedWeek && typeof data.count === 'number') {
        setEditorPresenceCount(data.count);
      }
    });

    socket.on('upload_update', (data) => {
      if (data.weekId === selectedWeek) {
        addToast('Nouveau fichier !', 'info');
        api.getDashboard(selectedWeek, adminPasswordRef.current).then(setDashboard).catch(console.error);
        api.getDeliveries(selectedWeek).then(setDeliveries).catch(console.error);
        api.getSujets(selectedWeek, null, adminPasswordRef.current).then((l) => setSujets(Array.isArray(l) ? l : [])).catch(() => {});
      }
    });

    // Un sujet ouvert ou renommé par un correspondant doit apparaître sans
    // recharger : le monteur travaille avec cet écran ouvert des heures.
    socket.on('sujet_update', (data) => {
      if (data.weekId === selectedWeek) {
        api.getSujets(selectedWeek, null, adminPasswordRef.current).then((l) => setSujets(Array.isArray(l) ? l : [])).catch(() => {});
      }
    });

    socket.on('timeline_update', async (data) => {
      if (data.weekId === selectedWeek && data.clientId !== getClientId()) {
        // Synchronisation automatique si nous n'avons pas de modification locale en attente d'enregistrement
        if (!pendingTimelineSaveRef.current) {
          try {
            const resp = await api.getTimelineWorkspace(selectedWeek, adminPasswordRef.current);
            if (resp?.workspace) {
              applyWorkspace(resp.workspace);
              setTimelineSyncState('saved');
              addToast('⚡ Timeline synchronisée avec un collaborateur', 'info', 2500);
            }
          } catch (err) {
            console.error(err);
          }
        }
      }
    });

    socket.on('editor_job_update', (data) => {
      if (data.weekId === selectedWeek) {
        // Lu dans une ref : mettre isGeneratingVideo en dépendance de l'effet
        // rouvrirait la socket à chaque changement d'état de rendu.
        if (data.status === 'processing' && !isGeneratingVideoRef.current) {
          trackJob(data.jobId, { resume: true });
        } else if (data.status === 'done' && data.url) {
          setGeneratedVideoUrl(/^https?:\/\//.test(data.url) ? data.url : `${API_BASE}${data.url}`);
          setIsGeneratingVideo(false);
          setExportProgress(100);
          setExportPhase('done');
        }
      }
    });

    return () => {
      socket.emit('leave_week', selectedWeek);
      socket.disconnect();
    };
  }, [isAuthenticatedAdmin, selectedWeek, addToast, applyWorkspace]);

  // Suit un job de montage (SSE temps réel + polling de secours). Réutilisé
  // pour démarrer un montage ET pour reprendre le suivi après refresh/onglet
  // (le rendu continue côté serveur, on récupère son résultat).
  const trackJob = (jobId, { resume = false } = {}) => {
    const token = localStorage.getItem('app-password') || '';
    let settled = false;

    // Nettoyage immédiat avant de créer de nouveaux timers
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null; }
    if (sseRef.current) { try { sseRef.current.close(); } catch { /* ignore */ } sseRef.current = null; }

    const stop = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null; }
      if (sseRef.current) { try { sseRef.current.close(); } catch { /* ignore */ } sseRef.current = null; }
    };
    const succeed = (url) => {
      if (settled) return;
      settled = true;
      stop();
      localStorage.removeItem(JOB_STORE_KEY);
      const finalUrl = /^https?:\/\//.test(url) ? url : `${API_BASE}${url}`;
      setExportProgress(100);
      setExportPhase('done');
      setGeneratedVideoUrl(finalUrl);
      addToast('Assemblage vidéo terminé avec succès !', 'success', 5000);
      setIsGeneratingVideo(false);
    };
    const fail = (msg, silent = false) => {
      if (settled) return;
      settled = true;
      stop();
      localStorage.removeItem(JOB_STORE_KEY);
      setIsGeneratingVideo(false);
      setExportError(msg);
      if (!silent) addToast(msg, 'error', 6000);
    };
    const handleState = ({ percent, status, url }) => {
      if (typeof percent === 'number') setExportProgress(percent);
      if (status && status !== 'unknown') setExportPhase(status);
      if (status === 'done' && url) succeed(url);
      else if (status === 'error') fail('Erreur serveur lors du montage.');
    };

    setIsGeneratingVideo(true);
    setExportError(null);
    setExportStartedAt(Date.now());
    localStorage.setItem(JOB_STORE_KEY, jobId);
    if (!resume) {
      setGeneratedVideoUrl(null);
      setExportProgress(0);
      setExportPhase('downloading');
    }

    if (sseRef.current) { try { sseRef.current.close(); } catch { /* ignore */ } }

    // Flux SSE temps réel. onerror n'est PAS fatal : EventSource se reconnecte
    // seul et le polling sert de filet de sécurité (Render free coupe souvent
    // les connexions pendant l'encodage CPU-intensif).
    const es = new EventSource(
      `${API_BASE}/api/editor/progress/${jobId}?pwd=${encodeURIComponent(token)}`
    );
    sseRef.current = es;
    es.onmessage = (e) => {
      try { handleState(JSON.parse(e.data)); } catch { /* ligne ignorée */ }
    };
    es.onerror = () => { /* laisser EventSource se reconnecter ; polling prend le relais */ };

    // Polling de secours toutes les 4 s. À la reprise, un 404 signifie que le
    // job a expiré/été purgé → on abandonne silencieusement.
    let misses = 0;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/editor/result/${jobId}`, {
          headers: { 'X-App-Password': token },
          credentials: 'include',
        });
        if (r.ok) { misses = 0; handleState(await r.json()); }
        else if (r.status === 404 && resume && ++misses >= 2) {
          fail('Job de montage expiré.', true);
        }
      } catch { /* réseau instable, on réessaiera */ }
    }, 4000);

    // Filet de sécurité absolu : abandon de l'UI après 2 h (aligné sur le
    // JOB_TTL_MS backend de 3 h). Un master de 30 min peut légitimement
    // encoder > 1 h sur VPS — l'ancien filet de 20 min faisait afficher
    // "trop long" en plein rendu sain. Le vrai détecteur d'échec reste le
    // watchdog backend (status 'error' → fail immédiat via SSE/polling).
    safetyRef.current = setTimeout(
      () => fail('Le montage prend trop de temps. Réessayez ou vérifiez la connexion.'),
      2 * 60 * 60 * 1000
    );

    return { fail };
  };

  const handleGenerateVideo = async () => {
    if (timelineClips.length === 0) return;
    if (isGeneratingVideo || generateLockRef.current) return;
    generateLockRef.current = true;

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tracker = trackJob(jobId);

    // Habillage global → overlays appliqués à tout le master.
    const globalOverlays = [];
    if (branding?.ticker?.enabled && typeof branding.ticker.texte === 'string' && branding.ticker.texte.trim()) {
      globalOverlays.push({ 
        templateId: 'ticker', 
        posX: branding.ticker.posX, posY: branding.ticker.posY, scale: branding.ticker.scale,
        fontSize: branding.ticker.fontSize, lineHeight: branding.ticker.lineHeight,
        fields: { categorie: branding.ticker.categorie, texte: branding.ticker.texte, speed: branding.ticker.speed || 1 }
      });
    }
    if (branding?.live?.enabled) {
      globalOverlays.push({ 
        templateId: 'live_badge', 
        posX: branding.live.posX, posY: branding.live.posY, scale: branding.live.scale,
        fontSize: branding.live.fontSize, lineHeight: branding.live.lineHeight,
        fields: { label: branding.live.label || 'LIVE' } 
      });
    }
    globalOverlays.push(...(branding?.overlays || []), ...timelineOverlays);
    const music = branding?.music?.enabled && branding.music.filename
      ? { filename: branding.music.filename, volume: branding.music.volume, duck: branding.music.duck }
      : undefined;
    const voiceover = branding?.voiceover?.enabled && branding.voiceover.filename
      ? { filename: branding.voiceover.filename, startTime: branding.voiceover.startTime, volume: branding.voiceover.volume }
      : undefined;
    const imageOverlays = (branding.imageOverlays || []).filter((o) => o.filename);

    // Durée de chaque segment (sec) : trim si défini, sinon metadata de la
    // vidéo. Nécessaire au moteur Remotion (durationInFrames).
    const probeDur = (url) => new Promise((resolve) => {
      let settled = false;
      const v = document.createElement('video');
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; resolve(0); }
      }, 5000);
      
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        if (!settled) { settled = true; clearTimeout(timeout); resolve(v.duration || 0); }
      };
      v.onerror = () => {
        if (!settled) { settled = true; clearTimeout(timeout); resolve(0); }
      };
      v.src = url;
    });
    const durations = await Promise.all(timelineClips.map(async (clip) => {
      if (clip.outPoint != null) return Math.max(0.3, clip.outPoint - (clip.inPoint || 0));
      const explicitDuration = Number(clip.durationSec);
      if (Number.isFinite(explicitDuration) && explicitDuration >= 0.3) return explicitDuration;
      const full = await probeDur(`${API_BASE}/uploads/${encodeURIComponent(clip.filename)}`);
      return Math.max(0.3, (full || 5) - (clip.inPoint || 0));
    }));

    try {
      // Passe par le client d'API plutôt que par un fetch à la main : il pose
      // X-App-Password et X-Admin-Password (la route est réservée aux admins).
      await api.editorConcat({
        jobId,
        weekId: selectedWeek,
        clips: timelineClips.map((clip, i) => ({
          filename: clip.filename,
          inPoint: clip.inPoint,
          outPoint: clip.outPoint,
          durationSec: durations[i],
          overlays: clip.overlays || [],
          transition: clip.transition,
          kenBurns: clip.kenBurns,
          subtitles: clip.subtitles,
          subtitleStyle: clip.subtitleStyle,
        })),
        globalOverlays,
        logo: branding.logo,
        logoPosition: branding.logoPosition,
        logoPosX: branding.logoPosX,
        logoPosY: branding.logoPosY,
        logoScale: branding.logoScale,
        music,
        voiceover,
        imageOverlays,
        atmosphere: branding.atmosphere,
      }, authenticatedAdminPassword);
      // Succès : le suivi (SSE + polling) met à jour l'UI jusqu'au résultat.
    } catch (err) {
      console.error(err);
      // Affiche le champ précis quand le backend renvoie une erreur de
      // validation (sinon « Invalid value » seul est inexploitable).
      const first = err.body?.errors?.[0];
      const detail = first ? `${first.path} : ${first.msg}` : null;
      tracker.fail(err.body?.message || detail || err.message || 'Erreur lors du montage vidéo');
    } finally {
      // Libère le verrou — l'UI est désormais gérée par isGeneratingVideo
      // (set true dans trackJob). Si un autre clic tombait pile pendant
      // la requête, isGeneratingVideo couvrait déjà la suite.
      generateLockRef.current = false;
    }
  };

  const handleSplitTextAtPlayhead = async () => {
    if (!playerRef.current || timelineClips.length === 0) return;
    const frame = playerRef.current.getCurrentFrame();
    if (frame === null || frame === undefined) return;
    
    const currentGlobalSec = frame / 30; // FPS = 30
    
    const probeDur = (url) => new Promise((resolve) => {
      let settled = false;
      const v = document.createElement('video');
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; resolve(0); }
      }, 5000);
      
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        if (!settled) { settled = true; clearTimeout(timeout); resolve(v.duration || 0); }
      };
      v.onerror = () => {
        if (!settled) { settled = true; clearTimeout(timeout); resolve(0); }
      };
      v.src = url;
    });

    const durations = await Promise.all(timelineClips.map(async (clip) => {
      if (clip.outPoint != null) return Math.max(0.3, clip.outPoint - (clip.inPoint || 0));
      const full = await probeDur(`${API_BASE}/uploads/${clip.filename}`);
      return Math.max(0.3, (full || 5) - (clip.inPoint || 0));
    }));

    const overlayIndex = timelineOverlays.findIndex(o => {
      const start = o.startTime || 0;
      const oDur = o.duration ?? 99999;
      return currentGlobalSec >= start && currentGlobalSec < start + oDur;
    });

    if (overlayIndex === -1) {
      addToast("Aucun texte n'est actif à ce moment précis.", 'error');
      return;
    }

    const o = timelineOverlays[overlayIndex];
    const start = o.startTime || 0;
    const oDur = o.duration ?? 99999;
    
    if (currentGlobalSec - start < 0.1 || (oDur !== 99999 && (start + oDur) - currentGlobalSec < 0.1)) {
      addToast('Impossible de couper si près du bord.', 'error');
      return;
    }

    const o1 = { ...o, duration: currentGlobalSec - start };
    const o2 = { 
      ...o, 
      startTime: currentGlobalSec, 
      duration: oDur === 99999 ? null : oDur - (currentGlobalSec - start), 
      id: Math.random().toString(36).slice(2) 
    };

    const newOverlays = [...timelineOverlays];
    newOverlays.splice(overlayIndex, 1, o1, o2);

    modifierMontage((m) => ({ ...m, overlays: newOverlays }));

    addToast('Texte coupé en deux !', 'success');
  };

  const handleDeliveryFiles = (filesList) => {
    Array.from(filesList).forEach((file) => {
      const tempId = Math.random().toString(36).slice(2);
      setDeliveryUploading((prev) => [
        ...prev,
        { id: tempId, name: file.name, progress: 0, status: 'uploading', phase: 'uploading' },
      ]);

      api.uploadDelivery(selectedWeek, file, authenticatedAdminPassword, {
        onProgress: (pct) =>
          setDeliveryUploading((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, progress: Math.min(pct, 99) } : f))
          ),
        onPhase: (phase) =>
          setDeliveryUploading((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, phase, progress: phase === 'processing' ? 99 : f.progress } : f))
          ),
      })
        .then((result) => {
          setDeliveryUploading((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, progress: 100, status: 'completed', phase: 'done' } : f))
          );
          setDeliveries((prev) => [...prev, result]);
          addToast(t.delivery.uploadSuccess(result.name), 'success');
        })
        .catch((err) => {
          setDeliveryUploading((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, progress: 0, status: 'error', error: err.message } : f))
          );
          addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error');
        });
    });
  };

  const handleDeliveryDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDeliveryDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDeliveryDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDeliveryDragActive(false);
    if (e.dataTransfer.files?.[0]) handleDeliveryFiles(e.dataTransfer.files);
  };
  
  // Le `window.confirm()` natif bloquait le fil, ignorait le thème sombre et
  // se contentait de « Supprimer machin.mp4 ? » — sans dire que c'est
  // irréversible. La suppression d'un fichier de chutier, juste à côté,
  // passait déjà par `ConfirmDialog` : les deux gestes se ressemblent trop
  // pour se comporter différemment.
  const [montageASupprimer, setMontageASupprimer] = useState(null);

  const handleDeleteDelivery = (fileId, fileName) => setMontageASupprimer({ id: fileId, name: fileName });

  const confirmerSuppressionMontage = async () => {
    const cible = montageASupprimer;
    setMontageASupprimer(null);
    if (!cible) return;
    const { id: fileId, name: fileName } = cible;

    let previousDeliveries = [];
    setDeliveries((prev) => {
      previousDeliveries = prev;
      return prev.filter((f) => f.id !== fileId);
    });

    try {
      await api.deleteDelivery(selectedWeek, fileId, authenticatedAdminPassword);
      addToast(t.delivery.deleteSuccess(fileName), 'success');
    } catch (err) {
      setDeliveries(previousDeliveries);
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error');
    }
  };

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

  const handleConfirmDownload = async () => {
    if (!fileToDownload) return;
    const isArchive = fileToDownload.filename.endsWith('/archive');

    try {
      let downloadUrl;

      if (isArchive) {
        // Le zip d'un chutier s'ouvre par une navigation : aucun en-tête ne
        // peut l'accompagner. On demande un jeton signé, qui sert à la fois
        // de preuve du droit et de vérification préalable — s'il est délivré,
        // le zip suivra. Le sonder par un HEAD relancerait la fabrication de
        // l'archive entière pour rien.
        const [weekId, countryId] = fileToDownload.filename.split('/');
        const { token } = await api.createArchiveToken(weekId, countryId, adminPasswordRef.current);
        downloadUrl = `${API_BASE}/api/uploads/${fileToDownload.filename}?dl_token=${encodeURIComponent(token)}`;
      } else {
        // Pour la rubrique mj on n'expose PLUS le mot de passe admin en query
        // string (logs proxy/Render/Sentry, historique navigateur). On
        // demande un dl_token signé (HMAC, 1 h, lié au filename).
        let dlTokenQuery = '';
        if (selectedBin === 'mj' && adminPasswordRef.current) {
          const { token } = await api.createDownloadToken(
            fileToDownload.filename,
            adminPasswordRef.current,
          );
          dlTokenQuery = `&dl_token=${encodeURIComponent(token)}`;
        }
        downloadUrl = `${API_BASE}/uploads/${fileToDownload.filename}?dl=1${dlTokenQuery}`;

        // Un <a> qui échoue ouvre un onglet blanc sans rien dire, et
        // l'interface affirmait quand même « Téléchargement lancé… ». On
        // vérifie d'abord : sur un fichier statique, un HEAD ne coûte rien.
        const sonde = await fetch(downloadUrl, { method: 'HEAD' });
        if (!sonde.ok) {
          addToast(
            sonde.status === 404
              ? 'Ce fichier n\'est plus sur le serveur (il a peut-être été purgé).'
              : 'Téléchargement refusé : reconnectez-vous à l\'espace montage.',
            'error',
            5000,
          );
          setDownloadDialogOpen(false);
          setFileToDownload(null);
          return;
        }
      }

      // Déclenchement non-bloquant et non-naviguant : évite que la page recharge ou perde la semaine sélectionnée
      const link = document.createElement('a');
      link.href = downloadUrl;
      if (fileToDownload.name) {
        link.download = fileToDownload.name;
      }
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
        } catch {}
      }, 2000);
      addToast('Téléchargement lancé…', 'info', 2000);
    } catch (err) {
      console.error('Erreur de téléchargement', err);
      addToast(err.message || 'Erreur de téléchargement (vérifiez vos droits)', 'error', 5000);
    }

    setDownloadDialogOpen(false);
    setFileToDownload(null);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);

    const targetFileId = fileToDelete.fileId;
    const targetCountryId = fileToDelete.countryId;
    const targetFileName = fileToDelete.fileName;
    
    let previousBinState = [];
    
    setDashboard((prev) => {
      previousBinState = prev[targetCountryId] || [];
      return {
        ...prev,
        [targetCountryId]: previousBinState.filter((f) => f.id !== targetFileId),
      };
    });
    setDeleteDialogOpen(false);
    setFileToDelete(null);

    try {
      await api.deleteFile(selectedWeek, targetCountryId, targetFileId, authenticatedAdminPassword);
      addToast(t.dashboard.deleted(targetFileName), 'success');
    } catch (err) {
      setDashboard((prev) => ({
        ...prev,
        [targetCountryId]: previousBinState,
      }));
      addToast(`${t.dashboard.deleteError} : ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openFeedbackDialog = (countryId, fileId, status) => {
    const file = dashboard[countryId]?.find(f => f.id === fileId);
    if (file) {
      // Le modal lit tout depuis ce fichier : l'état souhaité par l'appelant
      // voyage donc avec lui, au lieu de passer par un état de composant que
      // plus personne ne consommait.
      setFileToFeedback({
        ...file,
        status: status || file.status || 'rejected',
        countryId,
        fileId,
        fileName: file.name,
      });
      const directPhone = getCountryPhone(countryId);
      setFeedbackPhone(directPhone);
      setFeedbackDialogOpen(true);
      
      if (authenticatedAdminPassword && !directPhone) {
        api.getSubscriptions(selectedWeek, authenticatedAdminPassword)
          .then(subs => {
            if (Array.isArray(subs)) {
              setSubscriptions(subs);
              const found = subs.find(s => s.countryId === countryId);
              if (found) setFeedbackPhone(found.phone);
            }
          })
          .catch(() => {});
      }
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
      const updatedDashboard = await api.getDashboard(selectedWeek, adminPasswordRef.current);
      setDashboard(updatedDashboard);
    } catch (err) {
      addToast(`${t.uploader.errorPrefix} : ${err.message}`, 'error', 5000);
    } finally {
      setIsUploadingAdmin(false);
    }
  };

  // Upload d'un asset d'habillage (musique/voix-off/image) vers le chutier
  // "tj" (Titres & Rappels). adminPassword → contourne la deadline d'upload.
  // Rafraîchit le dashboard puis retourne le fichier ajouté { filename, name }.
  const uploadAsset = async (fileObj) => {
    await api.uploadFile(selectedWeek, 'tj', fileObj, { adminPassword: authenticatedAdminPassword });
    const fresh = await api.getDashboard(selectedWeek, adminPasswordRef.current);
    setDashboard(fresh);
    const list = Array.isArray(fresh?.tj) ? fresh.tj : [];
    const match = [...list].reverse().find((f) => f.name === fileObj.name) || list[list.length - 1];
    return match ? { filename: match.filename, name: match.name } : null;
  };

  useEffect(() => {
    if (!isDesktopEditorAvailable && selectedBin === 'studio') openRushes();
    // openRushes est volontairement recalculé avec les chutiers disponibles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktopEditorAvailable, selectedBin, selectedWeek, countriesWithUploads]);

  useEffect(() => {
    if (binIsValid(selectedBin)) return;
    // Restaure le dernier chutier choisi (survit refresh/onglet) s'il est
    // encore valide, sinon premier pays disponible.
    const saved = selectedWeek ? localStorage.getItem(`jt-bin-${selectedWeek}`) : null;
    if (binIsValid(saved)) setSelectedBin(saved);
    else if (countriesWithUploads.length > 0) setSelectedBin(countriesWithUploads[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBin, countriesWithUploads, selectedWeek]);

  // Persiste le chutier sélectionné.
  useEffect(() => {
    if (selectedBin && selectedWeek) {
      try { localStorage.setItem(`jt-bin-${selectedWeek}`, selectedBin); } catch { /* ignore */ }
    }
  }, [selectedBin, selectedWeek]);

  const renderUploadMeta = (file) => (
    <span
      className="text-[10px] text-[color:var(--muted)] mt-0.5 block"
      title={formatAbsolute(file.uploadedAt, lang)}
    >
      {/* La durée avant le poids : c'est le premier chiffre que cherche un
          monteur, et il n'était affiché nulle part alors que le serveur la
          mesure déjà pour fabriquer le master. */}
      {formaterDuree(file.duree) && <>{formaterDuree(file.duree)} · </>}
      {file.size}
      {file.uploadedAt && (
        <> · {t.dashboard.uploadedAt} {formatRelative(file.uploadedAt, lang)}</>
      )}
    </span>
  );

  const renderFileCard = (file) => {
    // Même classement que le regroupement au-dessus : une carte montrait une
    // caméra pour un fichier audio et une feuille pour une photo, parce que
    // sa détection était plus étroite que celle des sections.
    const kind = classifyFile(file);
    const isVideo = kind === MEDIA_TYPES.VIDEO;
    const isAudio = kind === MEDIA_TYPES.AUDIO;
    const isImage = kind === MEDIA_TYPES.IMAGE;
    
    return (
      <div key={file.id} className="group flex flex-col gap-2 shrink-0 w-64 md:w-auto snap-start relative">
        {/* Thumbnail Box */}
        <div 
          onClick={() => setViewingScript(file)}
          onMouseEnter={(e) => {
            if (isVideo) {
              const video = e.currentTarget.querySelector('video');
              if (video) video.play().catch(() => {});
            }
          }}
          onMouseLeave={(e) => {
            if (isVideo) {
              const video = e.currentTarget.querySelector('video');
              if (video) {
                video.pause();
                video.currentTime = 0.1;
              }
            }
          }}
          className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef] border border-[var(--border)] shadow-sm cursor-pointer flex items-center justify-center"
        >
          
          {isVideo ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center text-[color:var(--ink)]/10 z-0">
                <Video size={48} />
              </div>
              <LazyVideoThumbnail
                src={`${API_BASE}/uploads/${file.filename}#t=0.1`}
                className="w-full h-full object-cover relative z-10 bg-transparent"
              />
            </>
          ) : isImage ? (
            /* Une photo mérite son aperçu : elle tombait dans la branche
               « document » et s'affichait comme une feuille de papier. */
            <img
              src={`${API_BASE}/uploads/${file.filename}`}
              alt={file.name || file.filename}
              loading="lazy"
              className="w-full h-full object-cover relative z-10"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : isAudio ? (
            <div className="absolute inset-0 flex items-center justify-center z-0 bg-[var(--accent-soft)]/15">
               <Mic className="w-12 h-12 transition-transform duration-500 group-hover:scale-110 relative z-10 text-[color:var(--accent-deep)]" />
            </div>
          ) : (
            <FileText className="text-[color:var(--accent-deep)]/60 w-12 h-12 transition-transform duration-500 group-hover:scale-110 relative z-10" />
          )}

          {/* Status Badge */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-20">
            {file.reportage === 'Reportage Assemblé' && (
              <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md text-white bg-purple-500/90 border border-purple-400/30 flex items-center gap-1" title="Reportage finalisé uploadé par l'équipe de montage">
                <CheckCircle size={10} />
                Assemblé
              </div>
            )}
            {(file.status === 'approved' || file.status === 'rejected') && (
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md text-white ${
                file.status === 'approved' ? 'bg-[var(--action)]' : 'bg-[var(--signal)]'
              }`}>
                {file.status === 'approved' ? 'Approuvé' : 'Refusé'}
              </div>
            )}
          </div>

          {/* La pastille de la vignette : la durée quand on la connaît, le
              poids sinon. Sur une vignette, on n'a la place que d'un chiffre,
              et c'est la durée qui sert au montage. */}
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium backdrop-blur-md z-20">
            {formaterDuree(file.duree) || file.size}
          </div>

          {/* Hover Play Button for Video */}
          {isVideo && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none z-10">
              <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-lg">
                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1"></div>
              </div>
            </div>
          )}

          {/* More actions button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActionSheetFile(file);
            }}
            className="absolute top-2 left-2 p-1.5 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors z-30"
            title="Options"
          >
            <MoreVertical size={16} />
          </button>
        </div>
        
        {/* Footer Meta */}
        <div className="px-1 mt-1 flex flex-col gap-1">
          <div className="text-[13px] font-semibold text-[color:var(--ink)] truncate w-full flex items-center gap-2" title={file.name}>
            <span>{file.name}</span>
            {file.isLate && (
              <span className="text-[10px] bg-[var(--signal)] text-white px-2 py-0.5 rounded-full font-bold">
                EN RETARD
              </span>
            )}
          </div>
          <div className="text-[10px] text-[color:var(--muted)] truncate" title={file.uploadedAt ? formatAbsolute(file.uploadedAt, lang) : ''}>
            {file.uploadedAt ? formatRelative(file.uploadedAt, lang) : ''}
          </div>

          {/* Motif de refus / commentaire si présent */}
          {file.feedback && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                openFeedbackDialog(selectedBin, file.id, file.status || 'rejected');
              }}
              className="mt-0.5 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer border border-red-500/20 transition-colors"
              title={`Motif : ${file.feedback} (Cliquer pour modifier/notifier)`}
            >
              <MessageSquare size={12} className="shrink-0 text-red-500" />
              <span className="truncate">{file.feedback}</span>
            </div>
          )}

          {/* Bouton WhatsApp direct / Statut */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openFeedbackDialog(selectedBin, file.id, file.status || 'rejected');
            }}
            className={`mt-1.5 w-full text-xs font-semibold py-1.5 px-2 rounded-lg border motion-tap flex items-center justify-center gap-1.5 active:scale-95 shadow-sm ${
              file.status === 'rejected'
                ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                : file.status === 'approved'
                ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-500/20'
                : 'bg-[var(--paper-2)] border-[var(--border)] text-[color:var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
            title="Refuser ou valider le rush et notifier sur WhatsApp"
          >
            <MessageSquare size={13} className={file.status === 'rejected' ? 'text-red-500' : file.status === 'approved' ? 'text-green-600' : 'text-[#25D366]'} />
            <span>{file.status === 'rejected' ? 'Refusé (WhatsApp)' : file.status === 'approved' ? 'Validé (WhatsApp)' : 'Statut & WhatsApp'}</span>
          </button>

          {isVideo && isDesktopEditorAvailable && (
            <button
              type="button"
              onClick={(event) => {
                const cardDuration = event.currentTarget
                  .closest('.group')
                  ?.querySelector('video')
                  ?.duration;
                addRushDirectlyToTimeline(file, cardDuration);
              }}
              className="mt-1 w-full text-xs font-bold py-1.5 rounded-lg bg-[var(--action)] text-white hover:opacity-90 transition-[transform,opacity] duration-150 active:scale-[0.97] focus:outline-none shadow-sm flex items-center justify-center gap-1.5"
            >
              <Video size={14} aria-hidden="true" />
              Ajouter à la timeline
            </button>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('jt-admin-pass');
    if (saved) {
      api.checkAdminPassword(saved).then((ok) => {
        if (ok) {
          setAuthenticatedAdminPassword(saved);
          setIsAuthenticatedAdmin(true);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isAuthenticatedAdmin && authenticatedAdminPassword && selectedWeek) {
      api.getSubscriptions(selectedWeek, authenticatedAdminPassword)
        .then((subs) => {
          if (Array.isArray(subs)) setSubscriptions(subs);
        })
        .catch(() => {});
    }
  }, [isAuthenticatedAdmin, authenticatedAdminPassword, selectedWeek]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const ok = await api.checkAdminPassword(authenticatedAdminPassword);
      if (ok) {
        setIsAuthenticatedAdmin(true);
        sessionStorage.setItem('jt-admin-pass', authenticatedAdminPassword);
        api.getSubscriptions(selectedWeek, authenticatedAdminPassword)
          .then((subs) => {
            if (Array.isArray(subs)) setSubscriptions(subs);
          })
          .catch(() => {});
      } else {
        setAuthError('Mot de passe incorrect');
      }
    } catch (err) {
      setAuthError(err.message || 'Erreur de connexion');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isAuthenticatedAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-[var(--paper)] rounded-2xl shadow-sm border border-[var(--border)]">
        <h2 className="text-2xl font-bold text-center mb-6 text-[color:var(--ink)]">Espace Montage Sécurisé</h2>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[color:var(--ink)]">Mot de passe équipe montage</label>
            <input
              type="password"
              className="w-full bg-[var(--paper-2)] border border-[var(--border)] rounded-lg px-4 py-2 focus:ring-2 focus:ring-[var(--accent)] text-[color:var(--ink)]"
              value={authenticatedAdminPassword}
              onChange={(e) => setAuthenticatedAdminPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full btn btn-primary flex justify-center py-2"
          >
            {isAuthenticating ? 'Vérification...' : 'Déverrouiller'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={isDesktopEditorAvailable
      ? 'flex h-full min-h-0 w-full flex-col overflow-hidden'
      : 'w-full min-h-[calc(100dvh-8rem)]'
    }>
      <div className={isDesktopEditorAvailable
        ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-bg)]'
        : 'bg-[var(--app-bg)]'
      }>
        
        {/* Top Tabs (Tableau de bord) */}
        {!isStudioActive && <div className="flex h-11 shrink-0 overflow-x-auto border-b border-[var(--border)] bg-[var(--paper)]">
          <button 
            onClick={openRushes}
            className={`flex items-center gap-2 border-b-2 px-5 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${selectedBin !== 'studio' && selectedBin !== 'delivery' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--ink)]'}`}
          >
            <Folder size={18} /> Chutiers (Rushs)
          </button>
          {isDesktopEditorAvailable && (
            <button
              onClick={() => setSelectedBin('studio')}
              className="flex items-center gap-2 border-b-2 border-transparent px-5 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)] transition-colors whitespace-nowrap hover:text-[color:var(--ink)]"
            >
              <Video size={18} /> {t.studio.timeline.ongletStudio}
            </button>
          )}
          <button 
            onClick={() => setSelectedBin('delivery')} 
            className={`flex items-center gap-2 border-b-2 px-5 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${selectedBin === 'delivery' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--ink)]'}`}
          >
            <UploadCloud size={18} /> Livraison JT
          </button>
        </div>}

        {/* La relance du samedi et les demandes de délai, là où l'équipe
            travaille. Le panneau ne s'affiche que s'il a quelque chose à
            dire : un bandeau permanent finit par ne plus être lu. */}
        {!isStudioActive && (
          <RelancePanel
            selectedWeek={selectedWeek}
            adminPassword={authenticatedAdminPassword}
            week={(weeks || []).find((w) => w.id === selectedWeek)}
          />
        )}

        <div className={isDesktopEditorAvailable
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row'
          : 'block'
        }>
          
        {/* Sidebar Bins (Mobile Collapsible) - Seulement visible pour les chutiers */}
        {!isStudioActive && selectedBin !== 'delivery' && (
        <aside id="tour-editing-sidebar" className={`w-full md:w-64 md:border-r border-[var(--border)] flex flex-col md:overflow-y-auto shrink-0 bg-[var(--paper-2)] z-20 ${isMobileSidebarOpen ? 'block' : 'hidden md:flex'}`}>
          <div className="p-2 md:p-4 md:flex-1 w-full overflow-hidden">
            <div className="flex items-center justify-between px-2 mb-3 md:mb-0">
              <h3 className="text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-wider">{t.rubriqueLue.chutiersTitre}</h3>
              <button className="md:hidden text-xs text-[color:var(--accent)]" onClick={() => setIsMobileSidebarOpen(false)}>Fermer</button>
            </div>

            {/* Le journal lui-même, avant les pays : le conducteur et le Mot
                du JT ne sont pas des chutiers de correspondants, et leur texte
                existe avant qu'un fichier n'y soit déposé. */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 md:mb-4 md:flex-col md:gap-0 md:space-y-1 md:overflow-visible md:pb-0 -mx-2 px-2 md:mx-0 md:px-0">
              {binsRubriques.map((bin) => {
                const isActive = selectedBin === bin;
                const fileCount = dashboard[bin]?.length ?? 0;
                return (
                  <button
                    key={bin}
                    onClick={() => setSelectedBin(bin)}
                    className={`shrink-0 md:w-full flex items-center justify-between px-3 py-2 md:py-2.5 rounded-xl motion-tap active:scale-[0.98] border ${
                      isActive
                        ? 'bg-[var(--accent)] text-white font-semibold border-transparent shadow-md'
                        : 'bg-[var(--paper)] border-[var(--border)] text-[color:var(--muted)] sm:hover:text-[color:var(--ink)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ListOrdered size={16} className={isActive ? 'opacity-80' : ''} />
                      <span className="truncate whitespace-nowrap text-sm md:text-base">{nomDuChutier(bin)}</span>
                    </div>
                    <span className={`ml-3 text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-black/20 text-white' : 'bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)]'}`}>
                      {fileCount}
                    </span>
                  </button>
                );
              })}
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
                  const fileCount = dashboard[countryId]?.length ?? 0;
                  const isActive = selectedBin === countryId;
                  return (
                    <button 
                      key={countryId}
                      onClick={() => setSelectedBin(countryId)}
                      className={`shrink-0 md:w-full flex items-center justify-between px-3 md:px-3 py-2 md:py-2.5 rounded-xl motion-tap active:scale-[0.98] snap-start border md:border-transparent ${
                        isActive 
                          ? 'bg-[var(--accent)] text-white font-semibold border-transparent shadow-md' 
                          : 'bg-[var(--paper)] border-[var(--border)] text-[color:var(--muted)] sm:hover:bg-[var(--paper)] sm:hover:text-[color:var(--ink)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder size={16} className={isActive ? 'fill-current opacity-30' : ''} />
                        <span className="truncate whitespace-nowrap text-sm md:text-base">{nomDuChutier(countryId)}</span>
                      </div>
                      {countriesAttendus.has(countryId) ? (
                        // Sujet annoncé, rien reçu : c'est le pays à relancer.
                        <span className={`ml-3 text-[10px] px-1.5 py-0.5 rounded font-bold ${isActive ? 'bg-black/20 text-white' : 'bg-[var(--signal)]/15 border border-[var(--signal)]/40 text-[color:var(--ink)]'}`}>
                          Attendu
                        </span>
                      ) : (
                        <span className={`ml-3 text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-black/20 text-white' : 'bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)]'}`}>
                          {fileCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            
            <div className="mt-4 px-2">
              <select 
                className="w-full text-xs p-2 bg-[var(--paper)] border border-[var(--border)] rounded mb-2 text-[color:var(--ink)] cursor-pointer"
                onChange={(e) => {
                  if (e.target.value) {
                    setManualBins(prev => Array.from(new Set([...prev, e.target.value])));
                    setSelectedBin(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>+ Ajouter un pays sans upload</option>
                {countries.filter(c => !countriesWithUploads.includes(c.id) && c.id !== '_subscriptions').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </aside>
        )}

        {/* Main Content Area */}
        <main id="tour-editing-grid" className={`flex min-w-0 flex-1 flex-col bg-[var(--paper)] ${!isStudioActive ? 'overflow-y-auto' : ''}`}>
          
          {isStudioActive ? (
            
            /* =========================================
               STUDIO DE MONTAGE (NLE Workspace) 
               ========================================= */
            <div ref={studioWorkspaceRef} className={`studio-shell flex h-full w-full flex-col overflow-hidden bg-[var(--editor-bg)] ${isResizingTimeline ? 'select-none cursor-row-resize' : ''}`}>
              <h2 className="sr-only">Studio de montage</h2>

              {/* MODAL / DRAWER BIBLIOTHÈQUE DE RUSHS DU STUDIO */}
              {showRushesDrawer && (
                <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4 bg-[var(--ink)]/70 backdrop-blur-sm motion-voile">
                  <div className="bg-[var(--paper)] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-[var(--border)] overflow-hidden">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold">
                          <FolderOpen size={18} />
                        </div>
                        <div>
                          <h3 className="font-bold text-[color:var(--ink)] text-base">Bibliothèque de Rushs Vidéo</h3>
                          <p className="text-xs text-[color:var(--muted)]">
                            {weekVideoFiles.length} rush{weekVideoFiles.length > 1 ? 's' : ''} disponible{weekVideoFiles.length > 1 ? 's' : ''} cette semaine
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowRushesDrawer(false)}
                        className="p-2 rounded-xl text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[var(--border)] transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Filters and search */}
                    <div className="p-4 border-b border-[var(--border)] bg-[var(--paper)] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                        <button
                          onClick={() => setRushesCountryFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold motion-tap ${
                            rushesCountryFilter === 'all'
                              ? 'bg-[var(--accent)] text-white shadow-sm'
                              : 'bg-[var(--paper-2)] text-[color:var(--ink)] border border-[var(--border)] hover:bg-[var(--border)]'
                          }`}
                        >
                          Tous ({weekVideoFiles.length})
                        </button>
                        {countriesWithUploads.map((cId) => {
                          const cObj = countries.find((c) => c.id === cId);
                          const count = weekVideoFiles.filter((f) => f.countryId === cId).length;
                          if (count === 0) return null;
                          return (
                            <button
                              key={cId}
                              onClick={() => setRushesCountryFilter(cId)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 motion-tap ${
                                rushesCountryFilter === cId
                                  ? 'bg-[var(--accent)] text-white shadow-sm'
                                  : 'bg-[var(--paper-2)] text-[color:var(--ink)] border border-[var(--border)] hover:bg-[var(--border)]'
                              }`}
                            >
                              <span>{cObj?.name || cId}</span>
                              <span className="text-[10px] opacity-75 font-mono">({count})</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="relative min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" />
                        <input
                          type="text"
                          placeholder="Filtrer par nom..."
                          value={rushesSearch}
                          onChange={(e) => setRushesSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--paper-2)] border border-[var(--border)] text-xs text-[color:var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                    </div>

                    {/* Video Grid */}
                    <div className="p-5 overflow-y-auto flex-1 bg-[var(--paper-2)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {weekVideoFiles
                        .filter((f) => rushesCountryFilter === 'all' || f.countryId === rushesCountryFilter)
                        .filter((f) => !rushesSearch || (f.name || f.filename).toLowerCase().includes(rushesSearch.toLowerCase()))
                        .map((file) => {
                          const cObj = countries.find((c) => c.id === file.countryId);
                          return (
                            <div
                              key={file.id}
                              className="bg-[var(--paper)] rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-md motion-tap overflow-hidden flex flex-col group"
                            >
                              <div className="aspect-video bg-black/90 relative flex items-center justify-center overflow-hidden">
                                <HoverPreviewVideo
                                  src={`${API_BASE}/uploads/${file.filename}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                                  <span className="px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold backdrop-blur-xs">
                                    {cObj?.name || file.countryId}
                                  </span>
                                  {/* De quel reportage vient ce rush : sans ça, le
                                      tiroir mélangeait les sujets d'un même pays. */}
                                  {file.reportage && (
                                    <span className="px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold backdrop-blur-xs">
                                      {file.reportage}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                                <div>
                                  <p className="font-bold text-xs text-[color:var(--ink)] line-clamp-1" title={file.name || file.filename}>
                                    {file.name || file.filename}
                                  </p>
                                  <p className="text-[10px] text-[color:var(--muted)] mt-0.5">
                                    {formaterDuree(file.duree) ? `${formaterDuree(file.duree)} · ${file.size}` : file.size}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => {
                                      setTrimTarget(file);
                                      setShowRushesDrawer(false);
                                    }}
                                    className="py-1.5 px-2 rounded-xl bg-[var(--paper-2)] hover:bg-[var(--border)] border border-[var(--border)] text-[color:var(--ink)] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                  >
                                    <Scissors size={13} /> Rogner
                                  </button>
                                  <button
                                    onClick={() => addClipDirectlyToTimeline(file)}
                                    className="py-1.5 px-2 rounded-xl bg-[var(--action)] hover:bg-[var(--action-deep)] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm motion-tap active:scale-95"
                                  >
                                    <Plus size={13} /> Ajouter
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {weekVideoFiles.length === 0 && (
                        <div className="col-span-full py-12 text-center text-[color:var(--muted)]">
                          <Video size={36} className="mx-auto mb-2 opacity-30" />
                          <p className="font-bold text-sm text-[color:var(--ink)]">Aucun rush vidéo disponible</p>
                          <p className="text-xs mt-1">Les vidéos déposées par les correspondants apparaîtront ici.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Zone Supérieure : Player (Centre) + Inspecteur (Droite) */}
              <div className="flex h-auto xl:h-[55vh] xl:min-h-[450px] border-b border-[var(--border)] bg-[var(--paper-2)] shrink-0">
                
                {/* PLAYER CENTER */}
                <div className="relative flex min-w-0 flex-1 items-center justify-center bg-[oklch(0.11_0.018_245)] p-2 shadow-[inset_0_0_32px_oklch(0.05_0.02_245/0.6)]">
                  <RemotionLivePreview 
                    playerRef={playerRef} 
                    inline={true} 
                    clips={timelineClips} 
                    timelineOverlays={timelineOverlays}
                    branding={branding} 
                    onClose={() => {}} 
                  />
                  {/* Depuis le studio, « Générer le master » ne donnait aucun
                      retour : progression, résultat et téléchargement ne
                      vivaient que dans la branche « chutiers ». */}
                  <ExportStatus
                    enCours={isGeneratingVideo}
                    progression={exportProgress}
                    phase={exportPhase}
                    secondes={exportElapsed}
                    erreur={exportError}
                    urlVideo={generatedVideoUrl}
                    semaine={selectedWeek}
                    onReessayer={() => { setExportError(null); handleGenerateVideo(); }}
                  />
                </div>

                {/* INSPECTOR RIGHT */}
                <div className="relative z-10 flex w-[clamp(360px,32vw,520px)] shrink-0 flex-col overflow-y-auto border-l border-[var(--editor-border)] bg-[var(--editor-panel)]">
                  {overlayTarget ? (
                    <OverlayPanel
                      inline={true}
                      clip={overlayTarget}
                      onClose={() => setOverlayTarget(null)}
                      onSave={(updatedClip) => {
                        appliquerInspecteur(updatedClip);
                        addToast('Animations mises à jour', 'success', 2000);
                      }}
                      // Appelé à CHAQUE frappe : c'est lui qui pilote l'aperçu
                      // en direct, et c'est lui qui effaçait toute la pile
                      // d'annulation. L'étiquette porte la cible, donc une
                      // salve de frappes dans le même habillage ne fait qu'une
                      // entrée — mais couper puis taper restent deux gestes.
                      onChangePreview={appliquerInspecteur}
                    />
                  ) : showGlobalPanel ? (
                    <GlobalLayerPanel
                      inline={true}
                      value={branding}
                      onChange={(suivant) => modifierMontage((m) => ({ ...m, branding: suivant }), 'habillage')}
                      onClose={() => setShowGlobalPanel(false)}
                      audioFiles={weekAudioFiles}
                      imageFiles={weekImageFiles}
                      uploadAsset={uploadAsset}
                      adminPassword={authenticatedAdminPassword}
                    />
                  ) : subtitleTarget ? (
                    <SubtitlePanel
                      inline={true}
                      clip={subtitleTarget}
                      onClose={() => setSubtitleTarget(null)}
                      onSave={(updatedClip) => {
                        modifierMontage(
                          (m) => ({ ...m, clips: m.clips.map((c) => (c.instanceId === updatedClip.instanceId ? updatedClip : c)) }),
                        );
                        addToast('Sous-titres appliqués', 'success', 2000);
                      }}
                    />
                  ) : trimTarget ? (
                    <TrimModal
                      inline={true}
                      file={trimTarget}
                      onClose={() => setTrimTarget(null)}
                      onConfirm={(trimmedClip) => {
                        modifierMontage((m) => {
                          const index = m.clips.findIndex((c) => c.instanceId === trimmedClip.instanceId);
                          if (index >= 0) {
                            return { ...m, clips: m.clips.map((c) => (c.instanceId === trimmedClip.instanceId ? trimmedClip : c)) };
                          }
                          const generateId = () => (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
                          const isExternal = trimmedClip.filename?.startsWith('http') || trimmedClip.filename?.startsWith('blob:');
                          const url = isExternal ? trimmedClip.filename : `${API_BASE}/uploads/${trimmedClip.filename || trimmedClip.name}?cors=2`;
                          const newClip = { ...trimmedClip, url, instanceId: trimmedClip.instanceId || generateId() };
                          return { ...m, clips: [...m.clips, newClip] };
                        });
                        addToast('Clip ajouté à la timeline', 'success', 2000);
                        setTrimTarget(null);
                      }}
                    />
                  ) : (
                    <InspecteurClip
                      clip={clipSelectionne}
                      onRogner={openTrimInspector}
                      onHabiller={openOverlayInspector}
                      onSousTitrer={openSubtitleInspector}
                    />
                  )}
                </div>
              </div>

              {/* Séparateur redimensionnable : glisser vers le haut agrandit
                  la timeline, vers le bas rend plus de place au player. */}
              <div
                role="separator"
                aria-label="Redimensionner la hauteur de la timeline"
                aria-orientation="horizontal"
                aria-valuemin={STUDIO_TIMELINE_MIN_HEIGHT}
                aria-valuemax={Math.round(studioTimelineMaxHeight)}
                aria-valuenow={Math.round(studioTimelineHeight)}
                aria-valuetext={`Timeline haute de ${Math.round(studioTimelineHeight)} pixels`}
                tabIndex={0}
                onPointerDown={beginTimelineResize}
                onKeyDown={handleTimelineResizeKeyDown}
                onDoubleClick={() => updateStudioTimelineHeight(STUDIO_TIMELINE_DEFAULT_HEIGHT)}
                title="Glisser pour régler la hauteur. Flèches haut/bas au clavier. Double-clic pour réinitialiser."
                className={`group relative z-30 flex h-4 shrink-0 touch-none cursor-row-resize items-center justify-center border-y bg-[var(--editor-panel)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${isResizingTimeline ? 'border-[var(--accent)]' : 'border-[var(--editor-border)] hover:border-[var(--accent)]'}`}
              >
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--editor-border)] group-hover:bg-[var(--accent)]" aria-hidden="true" />
                <span className="relative flex h-4 items-center gap-1 rounded border border-[var(--editor-border)] bg-[var(--editor-panel)] px-2 text-[9px] font-semibold text-[color:var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[color:var(--accent)]">
                  <GripHorizontal size={12} aria-hidden="true" />
                  {t.studio.timeline.poigneeTimeline} · {Math.round(studioTimelineHeight)} px · {
                    timelineSyncState === 'saving'
                      ? t.studio.timeline.etatSauvegarde
                      : timelineSyncState === 'error'
                        ? t.studio.timeline.etatHorsLigne
                        : timelineSyncState === 'loading'
                          ? t.studio.timeline.etatChargement
                          : t.studio.timeline.etatEnregistree
                  }
                </span>
              </div>

              {/* TIMELINE BOTTOM */}
              <div
                className="flex min-h-[340px] shrink-0 flex-col overflow-hidden bg-[var(--editor-bg)]"
                style={{ height: `min(${Math.round(studioTimelineHeight)}px, 100%)` }}
              >
                <Timeline
                  clips={timelineClips}
                  setClips={setTimelineClips}
                  timelineOverlays={timelineOverlays}
                  setTimelineOverlays={setTimelineOverlays}
                  onGenerate={handleGenerateVideo}
                  isGenerating={isGeneratingVideo}
                  onTrimClip={openTrimInspector}
                  onOverlayClip={openOverlayInspector}
                  onGlobalLayer={openGlobalInspector}
                  brandingActive={branding.ticker.enabled || branding.live.enabled || branding.logo}
                  onSubtitleClip={openSubtitleInspector}
                  playerRef={playerRef}
                  onSplitText={handleSplitTextAtPlayhead}
                  onBrowseRushes={openRushes}
                  modifierMontage={modifierMontage}
                  annulerMontage={annulerMontage}
                  retablirMontage={retablirMontage}
                  annulationPossible={peutAnnuler(historique)}
                  retablissementPossible={peutRetablir(historique)}
                  syncState={timelineSyncState}
                  presenceCount={editorPresenceCount}
                  onSelectionChange={setClipSelectionne}
                />
              </div>
            </div>
          ) : (
            
            /* =========================================
               MEDIA POOL (Dashboard Classique) 
               ========================================= */
            <>
              {/* Top Toolbar */}
              <header id="tour-dashboard-header" className="p-4 bg-[var(--paper)] border-b border-[var(--border)] flex justify-between items-center z-10 shrink-0 relative">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Choisir un chutier"
                    title="Choisir un pays ou un chutier"
                    className="md:hidden p-1.5 rounded-lg bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] shrink-0"
                    onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                  >
                    <Folder size={18} />
                  </button>
                  {selectedBin ? (
                    <>
                      {selectedBin === 'delivery' ? (
                        <UploadCloud className="w-6 h-6 text-[color:var(--accent)]" />
                      ) : (
                        <CountryAvatar country={countries.find(c => c.id === selectedBin)} className="w-8 h-8" />
                      )}
                      <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                        {selectedBin === 'delivery' ? 'Livraison JT' : nomDuChutier(selectedBin)}
                      </h2>
                      {selectedBin && selectedBin !== 'delivery' && selectedBin !== 'studio' && selectedBin !== 'tj' && selectedBin !== 'mj' && (
                        <div className="ml-2 hidden sm:block">
                          {getCountryPhone(selectedBin) ? (
                            <a
                              href={`https://wa.me/${getCountryPhone(selectedBin).replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent(`Bonjour ${countries.find(c => c.id === selectedBin)?.name || selectedBin}, ici l'équipe de montage ALWM (Semaine ${selectedWeek}).`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-semibold text-xs border border-[#25D366]/30 motion-tap shadow-sm active:scale-95"
                              title={`Contacter le correspondant (${getCountryPhone(selectedBin)}) sur WhatsApp`}
                            >
                              <MessageSquare size={13} className="text-[#25D366]" />
                              <span>WhatsApp : {getCountryPhone(selectedBin)}</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setFileToFeedback({ id: 'general', name: `Contact ${countries.find(c => c.id === selectedBin)?.name || selectedBin}`, countryId: selectedBin });
                                setFeedbackDialogOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[var(--signal)]/15 text-[color:var(--ink)] text-xs font-semibold border border-[var(--signal)]/40 hover:bg-[var(--signal)]/25 motion-tap"
                              title="Ajouter un contact WhatsApp pour ce pays"
                            >
                              <span>📱 Aucun WhatsApp (+ Ajouter)</span>
                            </button>
                          )}
                        </div>
                      )}
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
                    className="btn border border-transparent bg-[var(--action)] hover:bg-[var(--action-deep)] text-white shadow-sm py-1.5 px-3 text-sm flex items-center gap-1.5 transition-colors"
                    title="Uploader un reportage final (Admin)"
                  >
                    <UploadCloud size={14} /> <span className="hidden sm:inline">Uploader le reportage assemblé</span>
                  </button>
                  {selectedBin === 'mj' ? (
                    <button
                      onClick={() => openDownloadDialog({ filename: `${selectedWeek}/mj/archive`, name: `uploads_${selectedWeek}_mj.zip` })}
                      className="btn btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5"
                    >
                      <Download size={14} /> {t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code || nomDuChutier(selectedBin))}
                    </button>
                  ) : (
                    <button
                      onClick={() => openDownloadDialog({ filename: `${selectedWeek}/${selectedBin}/archive`, name: `uploads_${selectedWeek}_${selectedBin}.zip` })}
                      className="btn btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5"
                    >
                      <Download size={14} /> {t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code || nomDuChutier(selectedBin))}
                    </button>
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
                        <Download size={16} /> <span>{t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code || nomDuChutier(selectedBin))}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openDownloadDialog({ filename: `${selectedWeek}/${selectedBin}/archive`, name: `uploads_${selectedWeek}_${selectedBin}.zip` })}
                        className="w-full btn btn-primary py-2 px-3 text-sm flex items-center justify-center gap-2 text-center"
                      >
                        <Download size={16} /> <span>{t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code || nomDuChutier(selectedBin))}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </details>
          </header>

          {/* Media Grid */}
          <div className="p-4 md:p-6 flex-1 bg-[var(--paper-2)] border-b border-[var(--border)]">
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
            ) : selectedBin === 'delivery' ? (
              <div className="flex flex-col gap-8 h-full pb-10">
                <div
                  className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-colors ${
                    deliveryDragActive
                      ? 'border-[color:var(--action)] bg-[var(--action)]/10'
                      : 'border-[var(--border)] bg-[var(--paper)] hover:border-[color:var(--accent)]'
                  }`}
                  onDragEnter={handleDeliveryDrag}
                  onDragLeave={handleDeliveryDrag}
                  onDragOver={handleDeliveryDrag}
                  onDrop={handleDeliveryDrop}
                >
                  <UploadCloud className={`mx-auto h-14 w-14 mb-4 transition-transform duration-200 ${
                    deliveryDragActive ? 'text-[color:var(--accent-deep)] scale-[1.05]' : 'text-[color:var(--muted)]'
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
                        onChange={(e) => e.target.files && handleDeliveryFiles(e.target.files)}
                      />
                    </label>
                  </div>
                </div>
                {deliveryUploading.length > 0 && (
                  <div className="panel p-6">
                    <h3 className="font-semibold text-[color:var(--ink)] mb-4">{t.delivery.transfers}</h3>
                    <div className="space-y-4">
                      {deliveryUploading.map((f) => (
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
                              <span className="text-[color:var(--accent-deep)] text-xs sm:text-sm">
                                {f.phase === 'processing'
                                  ? t.uploader.phaseProcessing
                                  : `${t.uploader.phaseUploading} ${Math.round(f.progress)}%`}
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-[var(--paper-2)] rounded-full h-2">
                            <div
                              className={`h-2 w-full rounded-full motion-gauge ${
                                f.status === 'completed'
                                  ? 'bg-[var(--action)]'
                                  : f.status === 'error'
                                  ? 'bg-[var(--signal)]'
                                  : 'bg-[color:var(--accent)]'
                              }`}
                              style={{ transform: `scaleX(${f.progress / 100})` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {deliveries.length > 0 && (
                  <div className="panel p-6">
                    <h3 className="font-semibold text-[color:var(--ink)] mb-4">Fichiers uploadés</h3>
                    <ul className="space-y-3">
                      {deliveries.map((file) => (
                        <li key={file.id} className="group bg-[var(--paper-2)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 motion-tap">
                          <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className={`p-2 rounded-lg bg-blue-100 text-blue-500 shrink-0`}>
                              <Video size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-[color:var(--ink)] text-sm md:text-base truncate flex items-center gap-2" title={file.name}>
                                <span>{file.name}</span>
                                {file.isLate && (
                                  <span className="text-[10px] bg-[var(--signal)] text-white px-2 py-0.5 rounded-full font-bold">
                                    EN RETARD
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-[color:var(--muted)] flex items-center gap-1.5 mt-0.5">
                                <span>{file.uploadedAt ? formatAbsolute(file.uploadedAt, lang) : ''}</span>
                                <span>•</span>
                                <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`${API_BASE}/uploads/${file.filename}?dl=1`}
                              download={file.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 md:p-2 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--accent)] hover:bg-[var(--accent)]/10 motion-tap"
                              title={t.delivery.download}
                            >
                              <Download size={16} />
                            </a>
                            <button
                              onClick={() => handleDeleteDelivery(file.id, file.name)}
                              type="button"
                              className="text-[color:var(--muted)] hover:text-red-500 p-1.5 rounded-lg"
                              title={t.delivery.delete}
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
            ) : (
              <div className="mt-4 flex flex-col gap-6">
                {/* Mobile Country Bar & Rush Filters */}
                <div className="md:hidden px-2 pt-1 pb-3 space-y-2 border-b border-[var(--border)]">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 custom-scrollbar">
                    {countriesWithUploads.map((countryId) => {
                      const country = countries.find((c) => c.id === countryId);
                      const count = dashboard[countryId]?.length || 0;
                      const isActive = selectedBin === countryId;
                      return (
                        <button
                          key={`mob-dash-bin-${countryId}`}
                          onClick={() => setSelectedBin(countryId)}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-bold text-xs transition-transform active:scale-95 ${
                            isActive
                              ? 'bg-[var(--accent)] text-white shadow-sm'
                              : 'bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)]'
                          }`}
                        >
                          <CountryAvatar country={country || { id: countryId, name: countryId }} className="w-4 h-4" />
                          <span className="truncate max-w-[100px]">{country?.name || countryId}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-black/20 text-white' : 'bg-[var(--paper)] text-[color:var(--muted)] border border-[var(--border)]'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Filter Pills & ZIP */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                      {[
                        { id: 'all', label: 'Tous' },
                        { id: MEDIA_TYPES.VIDEO, label: 'Vidéos' },
                        { id: MEDIA_TYPES.IMAGE, label: 'Images' },
                        { id: MEDIA_TYPES.AUDIO, label: 'Audios' },
                        { id: MEDIA_TYPES.DOCUMENT, label: 'Textes' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setMobileRushFilter(f.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 motion-tap ${
                            mobileRushFilter === f.id
                              ? 'bg-[color:var(--ink)] text-[var(--paper)]'
                              : 'bg-[var(--paper-2)] text-[color:var(--muted)] border border-[var(--border)]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    {selectedBin && (
                      <button
                        onClick={() => openDownloadDialog({ filename: `${selectedWeek}/${selectedBin}/archive`, name: `uploads_${selectedWeek}_${selectedBin}.zip` })}
                        className="px-2.5 py-1 rounded-xl bg-[var(--action)]/10 text-[color:var(--action-deep)] text-xs font-bold shrink-0 flex items-center gap-1 active:scale-95"
                        title="Télécharger tout le pays en ZIP"
                      >
                        <Download size={12} /> ZIP
                      </button>
                    )}
                  </div>

                  {/* Lien personnel : c'est ce qui permet de savoir qui a
                      envoyé quoi, et à qui écrire. */}
                  {selectedBin && !SPECIAL_BINS.includes(selectedBin) && (
                    <button
                      type="button"
                      onClick={() => setLinkDialogOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[color:var(--accent-deep)] font-semibold text-xs border border-[color:var(--accent)]/25 motion-tap active:scale-95"
                      title="Émettre le lien personnel de ce correspondant"
                    >
                      <Link2 size={13} />
                      <span>Lien du correspondant</span>
                    </button>
                  )}

                  {/* Mobile WhatsApp Correspondent Contact */}
                  {selectedBin && selectedBin !== 'delivery' && selectedBin !== 'tj' && selectedBin !== 'mj' && selectedBin !== 'studio' && (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MessageSquare size={14} className="text-[#25D366] shrink-0" />
                        <span className="text-xs font-semibold text-[color:var(--ink)] truncate">
                          {getCountryPhone(selectedBin) ? `WhatsApp : ${getCountryPhone(selectedBin)}` : 'Aucun WhatsApp pour ce pays'}
                        </span>
                      </div>
                      {getCountryPhone(selectedBin) ? (
                        <a
                          href={`https://wa.me/${getCountryPhone(selectedBin).replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent(`Bonjour ${countries.find(c => c.id === selectedBin)?.name || selectedBin}, ici l'équipe de montage ALWM (Semaine ${selectedWeek}).`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-lg bg-[#25D366] text-white text-xs font-bold shrink-0 flex items-center gap-1 shadow-sm active:scale-95"
                        >
                          <span>Écrire</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setFileToFeedback({ id: 'general', name: `Contact ${countries.find(c => c.id === selectedBin)?.name || selectedBin}`, countryId: selectedBin });
                            setFeedbackDialogOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold shrink-0"
                        >
                          + Ajouter
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Le conducteur écrit par la rédaction, au-dessus de ses
                    fichiers. Le monteur venait chercher la voix off ici et
                    devait aller lire le déroulé dans l'espace journalistes. */}
                {(selectedBin === 'tj' || selectedBin === 'mj') && (
                  <RubriquePanel selectedWeek={selectedWeek} bin={selectedBin} />
                )}

                {(() => {
                  const allFiles = Array.isArray(dashboard[selectedBin]) ? dashboard[selectedBin] : [];
                  if (allFiles.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center text-[color:var(--muted)] py-20">
                        <Folder size={48} className="mb-4 opacity-20" />
                        <p>Aucun fichier dans ce chutier pour l'instant.</p>
                      </div>
                    );
                  }

                  // Un reportage = un bloc, et dans chaque bloc les quatre
                  // familles séparées. Avant, tout le pays était versé dans
                  // trois listes à plat : impossible de savoir quelle vidéo
                  // allait avec quel script.
                  const groups = groupByReportage(allFiles, { sujets });

                  return groups.map((group) => {
                    const tone = reportageTone(group.index);
                    const sections = MEDIA_ORDER
                      .map((type) => ({ type, files: group.byType[type] }))
                      .filter(({ type, files }) => (
                        files.length > 0 && (mobileRushFilter === 'all' || mobileRushFilter === type)
                      ));

                    if (sections.length === 0) return null;

                    return (
                      <section key={group.key} className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--paper)] overflow-hidden">
                        <header
                          className="flex flex-wrap items-center gap-2 px-4 py-2.5"
                          style={{ backgroundColor: tone.fill, color: tone.onFill }}
                        >
                          <Folder size={16} className="shrink-0" />
                          <h3 className="font-bold text-sm">{group.label}</h3>
                          {group.etat && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: tone.onFill === '#ffffff'
                                  ? 'rgb(0 0 0 / 0.22)'
                                  : 'rgb(255 255 255 / 0.55)',
                              }}
                            >
                              {ETAT_LABELS[group.etat] || group.etat}
                            </span>
                          )}
                          <span
                            className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{
                              // Voile sombre sur teinte foncée, clair sur teinte
                              // claire : l'inverse délavait le fond et faisait
                              // passer le compteur sous le seuil de lisibilité.
                              backgroundColor: tone.onFill === '#ffffff'
                                ? 'rgb(0 0 0 / 0.22)'
                                : 'rgb(255 255 255 / 0.55)',
                            }}
                          >
                            {/* La durée totale du reportage à côté du nombre
                                de pièces : c'est elle qui dit si le sujet
                                tient dans sa place au conducteur. */}
                            {formaterTotal(group.files) && <>{formaterTotal(group.files)} · </>}
                            {group.files.length} {group.files.length > 1 ? 'fichiers' : 'fichier'}
                          </span>
                        </header>

                        <div className="p-4 space-y-5">
                          {sections.map(({ type, files }) => {
                            const { label, Icon } = MEDIA_SECTIONS[type];
                            return (
                              <div key={type}>
                                <h4 className="text-xs uppercase tracking-widest text-[color:var(--muted)] font-semibold mb-3 flex items-center gap-2">
                                  <Icon size={15} /> {label} ({files.length})
                                </h4>
                                <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 gap-4 md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible">
                                  {files.map((file) => renderFileCard(file))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  });
                })()}
              </div>
            )}
            
            {/* EXPORT PROGRESS (réel : download → encodage → upload) */}
            {isGeneratingVideo && (
              <div className="mt-8 bg-[var(--action)]/5 border border-[var(--action)] rounded-2xl p-6 shadow-md" role="status" aria-live="polite">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-4 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin shrink-0" />
                    <span className="text-lg font-bold text-[color:var(--ink)]">
                      {exportPhase === 'downloading' && 'Récupération des rushes…'}
                      {exportPhase === 'encoding' && 'Encodage en cours…'}
                      {exportPhase === 'uploading' && 'Finalisation…'}
                      {(exportPhase === '' || exportPhase === 'pending') && 'Préparation du Master…'}
                      {exportPhase === 'done' && 'Terminé !'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 bg-[var(--paper)] px-4 py-2 rounded-xl shadow-sm">
                    <span className="text-sm font-medium text-[color:var(--muted)] tabular-nums flex items-center gap-1">
                      <span>⏱</span> {Math.floor(exportElapsed / 60)}:{String(exportElapsed % 60).padStart(2, '0')}
                    </span>
                    <span className="text-xl text-[color:var(--accent)] font-black tabular-nums">{Math.round(exportProgress)}%</span>
                  </div>
                </div>
                <div className="w-full bg-[var(--paper-2)] border border-[var(--border)] rounded-full h-4 overflow-hidden shadow-inner">
                  <div
                    className="h-full w-full rounded-full bg-[color:var(--accent)] motion-gauge relative overflow-hidden"
                    style={{ transform: `scaleX(${Math.max(3, exportProgress) / 100})` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                <p className="text-[11px] text-[color:var(--muted)] mt-2">
                  L'assemblage se poursuit sur le serveur — vous pouvez naviguer, il continuera en arrière-plan.
                </p>
              </div>
            )}

            {/* Erreur d'assemblage : message clair + relance. */}
            {exportError && !isGeneratingVideo && (
              <div className="mt-8 bg-[var(--signal)]/10 border-2 border-[var(--signal)]/40 rounded-2xl p-5 shadow-sm" role="alert">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-[var(--signal)] shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="font-semibold text-[color:var(--ink)]">L'assemblage a échoué</p>
                    <p className="text-sm text-[color:var(--muted)] mt-1">{exportError}</p>
                  </div>
                  <button
                    onClick={() => { setExportError(null); handleGenerateVideo(); }}
                    className="btn btn-primary py-1.5 px-3 text-sm shrink-0"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            )}

            {/* GENERATED VIDEO PREVIEW */}
            {generatedVideoUrl && (
              <div className="mt-8 bg-[var(--paper)] border border-[var(--border)] rounded-2xl p-4 shadow-sm motion-boite">
                <h3 className="text-lg font-bold text-[color:var(--ink)] mb-3 flex items-center gap-2">
                  <CheckCircle className="text-[var(--accent)]" /> Vidéo Assemblée
                </h3>
                <video
                  src={generatedVideoUrl}
                  controls
                  preload="metadata"
                  onError={() => addToast("Lecture impossible ici — utilisez le bouton Télécharger.", 'info', 5000)}
                  className="w-full max-h-[400px] bg-black rounded-xl"
                />
                <div className="mt-4 flex justify-end">
                  {/* Téléchargement direct (same-origin via Caddy → l'attribut
                      download force l'enregistrement). Ouverture nouvel onglet
                      en repli si le navigateur bloque. */}
                  <a
                    href={generatedVideoUrl}
                    download={`Assemblage_JT_${selectedWeek}.mp4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Download size={18} /> Télécharger l'export (MP4)
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Mini Timeline (visible dans les rushs pour confirmation visuelle) */}
          {isDesktopEditorAvailable && selectedBin && selectedBin !== 'delivery' && (
            <div className="shrink-0 bg-[var(--paper-2)]">
              <Timeline
                clips={timelineClips}
                setClips={setTimelineClips}
                onGenerate={handleGenerateVideo}
                isGenerating={isGeneratingVideo}
                onTrimClip={(file) => {
                  setSelectedBin('studio');
                  openTrimInspector(file);
                }}
                onOverlayClip={(clip) => {
                  setSelectedBin('studio');
                  openOverlayInspector(clip);
                }}
                onGlobalLayer={() => {
                  setSelectedBin('studio');
                  openGlobalInspector();
                }}
                brandingActive={branding.ticker.enabled || branding.live.enabled || branding.logo}
                onPreview={() => setSelectedBin('studio')}
                onSubtitleClip={(clip) => {
                  setSelectedBin('studio');
                  openSubtitleInspector(clip);
                }}
                modifierMontage={modifierMontage}
                annulerMontage={annulerMontage}
                retablirMontage={retablirMontage}
                annulationPossible={peutAnnuler(historique)}
                retablissementPossible={peutRetablir(historique)}
                syncState={timelineSyncState}
                presenceCount={editorPresenceCount}
                compact
              />
            </div>
          )}
        </>
      )}
    </main>
  </div>

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title={t.uploader.deleteTitle}
        message={
          <div className="mt-2 text-left">
            <p className="text-[color:var(--muted)] mb-4">{t.uploader.deleteMsg(fileToDelete?.name || '')}</p>
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
        }}
      />

      <ConfirmDialog
        isOpen={!!montageASupprimer}
        title={t.delivery.deleteTitle}
        message={t.delivery.deleteMsg(montageASupprimer?.name || '')}
        confirmText={t.uploader.deleteConfirm}
        cancelText={t.uploader.cancel}
        variant="danger"
        onConfirm={confirmerSuppressionMontage}
        onCancel={() => setMontageASupprimer(null)}
      />

      <ConfirmDialog
        isOpen={downloadDialogOpen}
        title="Télécharger le fichier"
        message={
          <div className="mt-2 text-left">
            <p className="text-[color:var(--muted)] mb-4">
              Êtes-vous sûr de vouloir télécharger <strong>{fileToDownload?.name || 'ce fichier'}</strong> ?
            </p>
          </div>
        }
        confirmText="Télécharger"
        cancelText={t.uploader.cancel}
        variant="primary"
        onConfirm={handleConfirmDownload}
        onCancel={() => {
          setDownloadDialogOpen(false);
          setFileToDownload(null);
        }}
      />

      {/* Feedback & WhatsApp Rejection Modal */}
      <ReporterLinkDialog
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        countryId={selectedBin}
        countryName={countries.find((c) => c.id === selectedBin)?.name}
        adminPassword={authenticatedAdminPassword}
      />

      <FeedbackModal
        isOpen={feedbackDialogOpen}
        onClose={() => {
          setFeedbackDialogOpen(false);
          setFileToFeedback(null);
        }}
        file={fileToFeedback}
        countryName={countries.find(c => c.id === (fileToFeedback?.countryId || selectedBin))?.name || (fileToFeedback?.countryId || selectedBin)}
        countryId={fileToFeedback?.countryId || selectedBin}
        weekId={selectedWeek}
        initialPhone={feedbackPhone || getCountryPhone(fileToFeedback?.countryId || selectedBin)}
        adminPassword={authenticatedAdminPassword}
        onStatusUpdated={(updatedFile) => {
          const targetCountry = fileToFeedback?.countryId || selectedBin;
          setDashboard(prev => {
            const list = prev[targetCountry] || [];
            return {
              ...prev,
              [targetCountry]: list.map(f => f.id === updatedFile.id ? { ...f, ...updatedFile } : f)
            };
          });
        }}
      />

      {/* Script Viewer Modal */}
      <ScriptViewerModal 
        file={viewingScript} 
        onClose={() => setViewingScript(null)}
        selectedWeek={selectedWeek}
        selectedBin={selectedBin}
        adminPassword={authenticatedAdminPassword}
        onContentChange={() => api.getDashboard(selectedWeek, adminPasswordRef.current).then(setDashboard).catch(console.error)}
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

      <ActionSheet
        isOpen={!!actionSheetFile}
        onClose={() => setActionSheetFile(null)}
        file={actionSheetFile}
        isAudio={actionSheetFile?.type === 'audio' || !!actionSheetFile?.name?.match(/\.(mp3|wav|m4a|webm|ogg)$/i)}
        isVideo={actionSheetFile?.type === 'video' || !!actionSheetFile?.name?.match(/\.(mp4|mov|avi|mkv)$/i)}
        onApprove={() => openFeedbackDialog(selectedBin, actionSheetFile?.id, 'approved')}
        onReject={() => openFeedbackDialog(selectedBin, actionSheetFile?.id, 'rejected')}
        onOpenFeedback={() => openFeedbackDialog(selectedBin, actionSheetFile?.id, actionSheetFile?.status || 'rejected')}
        onDownload={() => openDownloadDialog(actionSheetFile)}
        onDelete={() => openDeleteDialog(selectedBin, actionSheetFile?.id)}
        onViewScript={(f) => setViewingScript(f)}
      />
    </div>
    </div>
  );
}
