import { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Folder, FileText, Video, Download, Trash2, CheckCircle, XCircle, AlertCircle, UploadCloud, Mic, MoreVertical, Scissors, GripHorizontal } from 'lucide-react';
import { api, API_BASE } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatRelative, formatAbsolute, formatWeekLabel, formatWeekDates } from '../lib/dates.js';
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
import SubtitlePanel from './editor/SubtitlePanel.jsx';
import ActionSheet from './ActionSheet.jsx';

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
const DEFAULT_BRANDING = {
  ticker: { enabled: false, categorie: 'ALERTE', texte: '', speed: 1 },
  atmosphere: { vignette: 0, grain: 0, sweep: 0 },
  live: { enabled: false, label: 'DIRECT' },
  logo: false,
  logoPosition: 'br',
  music: { enabled: false, filename: '', volume: 0.2, duck: true },
  voiceover: { enabled: false, filename: '', startTime: 0, volume: 1 },
  imageOverlays: [],
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
              className="px-4 py-2 rounded-lg font-medium text-sm bg-[var(--accent)] text-[var(--paper)] hover:bg-[var(--accent-deep)] transition-colors shadow-sm disabled:opacity-50"
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
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-[var(--ink)]/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="script-viewer-title">
      <div ref={dialogRef} className="bg-[var(--paper)] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-[var(--border)] animate-in fade-in zoom-in-95 duration-200">
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
  const [manualBins, setManualBins] = useState([]);

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
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  
  // Editor State
  const [timelineClips, setTimelineClips] = useState([]);
  const [timelineOverlays, setTimelineOverlays] = useState([]);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
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
  const [selectedBin, setSelectedBin] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
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
  // Verrou synchrone anti double-clic sur Générer le Master. setState
  // (setIsGeneratingVideo) est asynchrone : un 2e clic dans le même tick
  // React lance un 2e job avant que le 1er ait mis à jour l'état.
  const generateLockRef = useRef(false);

  // Un seul inspecteur doit être visible à la fois. Auparavant quatre états
  // concurrents pouvaient rester actifs : cliquer sur « Trim » semblait alors
  // ne rien faire si l'habillage avait une priorité de rendu supérieure.
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

    setTimelineClips((previous) => [...previous, newClip]);
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
        setTimelineClips((previous) => previous.map((clip) => {
          if (clip.instanceId !== instanceId) return clip;
          const hasBeenTrimmed = clip.outPoint != null || Number(clip.durationSec) > 0;
          return {
            ...clip,
            sourceDurationSec: duration,
            ...(!hasBeenTrimmed ? { durationSec: duration } : {}),
          };
        }));
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
      api.saveTimelineWorkspace(pending.weekId, pending.payload).catch(console.error);
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
        const response = await api.getTimelineWorkspace(selectedWeek);
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

      const safeClips = Array.isArray(workspace?.clips) ? workspace.clips : [];
      const mappedClips = safeClips.map((clip) => {
        const filename = clip.filename || clip.name || '';
        const isExternal = filename.startsWith('http') || filename.startsWith('blob:');
        return {
          ...clip,
          url: isExternal ? filename : `${API_BASE}/uploads/${encodeURIComponent(filename)}?cors=2`,
        };
      });
      const nextOverlays = Array.isArray(workspace?.overlays) ? workspace.overlays : [];
      const nextBranding = workspace?.branding && typeof workspace.branding === 'object'
        ? { ...DEFAULT_BRANDING, ...workspace.branding }
        : DEFAULT_BRANDING;
      const payload = {
        clips: safeClips.map(({ url: _url, ...clip }) => clip),
        overlays: nextOverlays,
        branding: nextBranding,
      };

      setTimelineClips(mappedClips);
      setTimelineOverlays(nextOverlays);
      setBranding(nextBranding);
      lastSyncedTimelineRef.current = onlineAvailable ? JSON.stringify(payload) : '';
      timelineHydratedWeekRef.current = selectedWeek;
      setTimelineSyncState(onlineAvailable ? 'saved' : 'error');

      if (migratedFromBrowser) {
        try {
          setTimelineSyncState('saving');
          await api.saveTimelineWorkspace(selectedWeek, payload);
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

    api.getDashboard(selectedWeek)
      .then(setDashboard)
      .catch((err) => {
        console.error(err);
        addToast(err.message || t.uploader.errorPrefix, 'error');
      })
      .finally(() => setLoading(false));

    api.getDeliveries(selectedWeek)
      .then(setDeliveries)
      .catch(console.error);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

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
        await api.saveTimelineWorkspace(selectedWeek, pendingSave.payload);
        if (pendingTimelineSaveRef.current?.serialized === pendingSave.serialized) {
          lastSyncedTimelineRef.current = pendingSave.serialized;
          pendingTimelineSaveRef.current = null;
          setTimelineSyncState('saved');
        }
      } catch (error) {
        console.error(error);
        setTimelineSyncState('error');
        addToast('Le montage n’a pas pu être sauvegardé en ligne', 'error');
      }
    }, 600);
  }, [timelineClips, timelineOverlays, branding, selectedWeek]);

  useEffect(() => () => {
    window.clearTimeout(timelineSaveTimerRef.current);
    const pending = pendingTimelineSaveRef.current;
    if (pending) api.saveTimelineWorkspace(pending.weekId, pending.payload).catch(console.error);
  }, []);

  // Reprend le suivi d'un montage en cours après un refresh/onglet : le rendu
  // continue côté serveur, on récupère sa progression et son résultat.
  useEffect(() => {
    const jobId = localStorage.getItem(JOB_STORE_KEY);
    if (jobId) trackJob(jobId, { resume: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh dashboard quietly when becoming active
  useEffect(() => {
    if (!selectedWeek || !isActive) return;
    api.getDashboard(selectedWeek)
      .then(setDashboard)
      .catch(console.error);
    api.getDeliveries(selectedWeek)
      .then(setDeliveries)
      .catch(console.error);
  }, [isActive, selectedWeek]);

  // Connect socket.io for real-time updates when authenticated as admin
  useEffect(() => {
    if (!isAuthenticatedAdmin || !selectedWeek) return;

    // Connect to the same origin/host as the API.
    // - transports: ['websocket'] : skip Engine.IO long-polling (sature les
    //   liens 4G instables et double le trafic en parallèle de la WS).
    // - auth.token : le backend valide le X-App-Password sur le handshake
    //   (cf. backend/src/app.js initSocket).
    // - reconnect exponentiel borné : évite les bursts CPU si le réseau saute.
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
    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error', err.message);
    });

    socket.on('upload_update', (data) => {
      if (data.weekId === selectedWeek) {
        addToast('Nouveau fichier !', 'info');
        api.getDashboard(selectedWeek).then(setDashboard).catch(console.error);
        api.getDeliveries(selectedWeek).then(setDeliveries).catch(console.error);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticatedAdmin, selectedWeek, addToast]);

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
    const token = localStorage.getItem('app-password') || '';
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
      const response = await fetch(`${API_BASE}/api/editor/concat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Password': token },
        credentials: 'include',
        body: JSON.stringify({
          jobId,
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
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Affiche le champ précis quand le backend renvoie une erreur de
        // validation (sinon "Invalid value" seul est inexploitable).
        const first = data.errors?.[0];
        const detail = first ? `${first.path} : ${first.msg}` : null;
        throw new Error(data.message || detail || 'Erreur lors du montage vidéo');
      }
      // Succès : le suivi (SSE + polling) met à jour l'UI jusqu'au résultat.
    } catch (err) {
      console.error(err);
      tracker.fail(err.message);
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

    setTimelineOverlays(newOverlays);

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
  
  const handleDeleteDelivery = async (fileId, fileName) => {
    if(!window.confirm(`Supprimer ${fileName} ?`)) return;
    
    let previousDeliveries = [];
    setDeliveries((prev) => {
      previousDeliveries = prev;
      return prev.filter((f) => f.id !== fileId);
    });

    try {
      await api.deleteDelivery(selectedWeek, fileId);
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
      // Pour la rubrique mj on n'expose PLUS le mot de passe admin en query
      // string (logs proxy/Render/Sentry, historique navigateur). On
      // demande un dl_token signé (HMAC, 1 h, lié au filename).
      const needsToken = selectedBin === 'mj' && authenticatedAdminPassword && !isArchive;
      let dlTokenQuery = '';
      if (needsToken) {
        const tokRes = await fetch(`${API_BASE}/api/uploads/download-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Password': localStorage.getItem('app-password') || '',
            'X-Admin-Password': authenticatedAdminPassword,
          },
          body: JSON.stringify({ filename: fileToDownload.filename }),
        });
        if (!tokRes.ok) throw new Error('Téléchargement refusé : authentification expirée.');
        const { token } = await tokRes.json();
        dlTokenQuery = `&dl_token=${encodeURIComponent(token)}`;
      }

      if (isArchive) {
        // Les archives ne sont pas dans la rubrique `mj` — DL public direct.
        window.location.assign(`${API_BASE}/api/uploads/${fileToDownload.filename}`);
      } else {
        window.location.assign(`${API_BASE}/uploads/${fileToDownload.filename}?dl=1${dlTokenQuery}`);
      }
    } catch (err) {
      console.error('Erreur de téléchargement', err);
      addToast('Erreur de téléchargement (vérifiez vos droits)', 'error');
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
      setFileToFeedback({ countryId, fileId, fileName: file.name });
      setFeedbackStatus(status);
      setFeedbackText(file.feedback || '');
      setFeedbackDialogOpen(true);
      
      if (authenticatedAdminPassword) {
        api.getSubscriptions(selectedWeek, authenticatedAdminPassword)
          .then(subs => {
            const sub = subs.find(s => s.countryId === countryId);
            setFeedbackPhone(sub ? sub.phone : null);
          })
          .catch(() => setFeedbackPhone(null));
      } else {
        setFeedbackPhone(null);
      }
    }
  };

  const handleConfirmFeedback = async () => {
    if (!fileToFeedback) return;
    setIsSubmittingFeedback(true);

    const targetFileId = fileToFeedback.fileId;
    const targetCountryId = fileToFeedback.countryId;
    const targetStatus = feedbackStatus;
    const targetText = feedbackText;

    let previousBinState = [];

    setDashboard(prev => {
      previousBinState = prev[targetCountryId] || [];
      const updatedFiles = previousBinState.map(f => {
        if (f.id === targetFileId) {
          return { ...f, status: targetStatus, adminFeedback: targetText };
        }
        return f;
      });
      return { ...prev, [targetCountryId]: updatedFiles };
    });
    setFeedbackDialogOpen(false);
    setFileToFeedback(null);
    setFeedbackStatus('');
    setFeedbackText('');

    try {
      await api.updateFileStatus(selectedWeek, targetFileId, targetStatus, targetText, authenticatedAdminPassword);
      addToast('Statut mis à jour avec succès', 'success');
    } catch (err) {
      console.error(err);
      setDashboard(prev => ({
        ...prev,
        [targetCountryId]: previousBinState
      }));
      addToast(`Erreur : ${err.message}`, 'error');
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

  // Upload d'un asset d'habillage (musique/voix-off/image) vers le chutier
  // "tj" (Titres & Rappels). adminPassword → contourne la deadline d'upload.
  // Rafraîchit le dashboard puis retourne le fichier ajouté { filename, name }.
  const uploadAsset = async (fileObj) => {
    await api.uploadFile(selectedWeek, 'tj', fileObj, { adminPassword: authenticatedAdminPassword });
    const fresh = await api.getDashboard(selectedWeek);
    setDashboard(fresh);
    const list = Array.isArray(fresh?.tj) ? fresh.tj : [];
    const match = [...list].reverse().find((f) => f.name === fileObj.name) || list[list.length - 1];
    return match ? { filename: match.filename, name: match.name } : null;
  };

  // Fichiers audio / image de la semaine (tous chutiers) pour l'habillage global.
  const { weekAudioFiles, weekImageFiles } = useMemo(() => {
    const audio = [];
    const image = [];
    Object.values(dashboard || {}).forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((f) => {
        if (!f || !f.filename) return;
        const entry = { filename: f.filename, name: f.name || f.filename };
        if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.filename) || f.type === 'image') image.push(entry);
        else if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(f.filename) || f.type === 'audio') audio.push(entry);
      });
    });
    return { weekAudioFiles: audio, weekImageFiles: image };
  }, [dashboard]);

  const countriesWithUploads = useMemo(() => {
    const uploaded = Object.keys(dashboard).filter(
      (id) => dashboard[id]?.length > 0 || id === 'tj'
    );
    return Array.from(new Set([...uploaded, ...manualBins]));
  }, [dashboard, manualBins]);

  // Bins spéciaux toujours valides (rubriques fixes, pas des pays avec
  // uploads). Sans ça, sélectionner "JT Prêt"/"MOT DU JT" était
  // immédiatement réinitialisé par l'effet ci-dessous → la fenêtre
  // d'upload s'ouvrait puis se refermait en quelques ms.
  const SPECIAL_BINS = ['delivery', 'mj', 'tj', 'studio'];

  const binIsValid = (bin) =>
    bin && (SPECIAL_BINS.includes(bin) || countriesWithUploads.includes(bin));

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
      {file.size}
      {file.uploadedAt && (
        <> · {t.dashboard.uploadedAt} {formatRelative(file.uploadedAt, lang)}</>
      )}
    </span>
  );

  const renderFileCard = (file) => {
    const isVideo = file?.type === 'video' || !!file?.name?.match(/\.(mp4|mov|avi|mkv)$/i);
    const isAudio = file?.type === 'audio' || !!file?.name?.match(/\.(mp3|wav|m4a|webm|ogg)$/i);
    
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
            {/* Badge UNIQUEMENT pour les décisions explicites de la team
                montage. Tout autre statut (pending/completed/legacy) =
                neutre, pas de "Rejeté" par défaut. */}
            {(file.status === 'approved' || file.status === 'rejected') && (
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
              className="mt-2 w-full text-sm font-bold py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-[transform,opacity] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 shadow-md flex items-center justify-center gap-2"
            >
              <Video size={16} aria-hidden="true" />
              Ajouter à la timeline
            </button>
          )}
        </div>
      </div>
    );
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const ok = await api.checkAdminPassword(authenticatedAdminPassword);
      if (ok) {
        setIsAuthenticatedAdmin(true);
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

  const isStudioActive = isDesktopEditorAvailable && selectedBin === 'studio';

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
              <Video size={18} /> Studio de Montage
            </button>
          )}
          <button 
            onClick={() => setSelectedBin('delivery')} 
            className={`flex items-center gap-2 border-b-2 px-5 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${selectedBin === 'delivery' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--ink)]'}`}
          >
            <UploadCloud size={18} /> Livraison JT
          </button>
        </div>}

        <div className={isDesktopEditorAvailable
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row'
          : 'block'
        }>
          
        {/* Sidebar Bins (Mobile Collapsible) - Seulement visible pour les chutiers */}
        {!isStudioActive && selectedBin !== 'delivery' && (
        <aside id="tour-editing-sidebar" className={`w-full md:w-64 md:border-r border-[var(--border)] flex flex-col md:overflow-y-auto shrink-0 bg-[var(--paper-2)] z-20 ${isMobileSidebarOpen ? 'block' : 'hidden md:flex'}`}>
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
                  const fileCount = dashboard[countryId]?.length ?? 0;
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
              
              {/* Zone Supérieure : Player (Centre) + Inspecteur (Droite) */}
              <div className="flex min-h-[220px] flex-1 flex-row overflow-hidden border-b border-[var(--editor-border)] bg-[var(--editor-bg)]">
                
                {/* PLAYER CENTER */}
                <div className="relative flex min-w-0 flex-1 items-center justify-center bg-[oklch(0.11_0.018_245)] p-2 shadow-[inset_0_0_32px_oklch(0.05_0.02_245/0.6)]">
                  <RemotionLivePreview 
                    playerRef={playerRef} 
                    inline={true} 
                    clips={timelineClips} 
                    timelineOverlays={timelineOverlays}
                    branding={branding} 
                    onClose={() => {}} 
                    adminPassword={authenticatedAdminPassword}
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
                        if (updatedClip.isTimelineOverlays) {
                          setTimelineOverlays(updatedClip.overlays || []);
                        } else {
                          setTimelineClips((prev) => prev.map((c) => (c.instanceId === updatedClip.instanceId ? updatedClip : c)));
                        }
                        addToast('Animations mises à jour', 'success', 2000);
                      }}
                      onChangePreview={(updatedClip) => {
                        if (updatedClip.isTimelineOverlays) {
                          setTimelineOverlays(updatedClip.overlays || []);
                        } else {
                          setTimelineClips((prev) => prev.map((c) => (c.instanceId === updatedClip.instanceId ? updatedClip : c)));
                        }
                      }}
                    />
                  ) : showGlobalPanel ? (
                    <GlobalLayerPanel
                      inline={true}
                      value={branding}
                      onChange={setBranding}
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
                        setTimelineClips((prev) => prev.map((c) => (c.instanceId === updatedClip.instanceId ? updatedClip : c)));
                        addToast('Sous-titres appliqués', 'success', 2000);
                      }}
                    />
                  ) : trimTarget ? (
                    <TrimModal
                      inline={true}
                      file={trimTarget}
                      onClose={() => setTrimTarget(null)}
                      onConfirm={(trimmedClip) => {
                        setTimelineClips((prev) => {
                          const index = prev.findIndex((c) => c.instanceId === trimmedClip.instanceId);
                          if (index >= 0) {
                            return prev.map((c) => (c.instanceId === trimmedClip.instanceId ? trimmedClip : c));
                          }
                          const generateId = () => (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
                          const isExternal = trimmedClip.filename?.startsWith('http') || trimmedClip.filename?.startsWith('blob:');
                          const authQuery = authenticatedAdminPassword ? `&adminPassword=${encodeURIComponent(authenticatedAdminPassword)}` : '';
                          const url = isExternal ? trimmedClip.filename : `${API_BASE}/uploads/${trimmedClip.filename || trimmedClip.name}?cors=2${authQuery}`;
                          const newClip = { ...trimmedClip, url, instanceId: trimmedClip.instanceId || generateId() };
                          return [...prev, newClip];
                        });
                        addToast('Clip ajouté à la timeline', 'success', 2000);
                        setTrimTarget(null);
                      }}
                    />
                  ) : (
                    <div className="flex min-h-full flex-1 flex-col text-[color:var(--muted)]">
                      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] px-4">
                        <Scissors size={16} className="text-[var(--accent)]" />
                        <p className="text-sm font-semibold text-[color:var(--ink)]">Inspecteur</p>
                      </div>
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                        <Scissors size={26} className="opacity-35" />
                        <div>
                          <p className="mb-1 text-sm font-semibold text-[color:var(--ink)]">Aucun clip sélectionné</p>
                          <p className="mx-auto max-w-[34ch] text-xs leading-5">Sélectionnez un clip dans la timeline ou ouvrez Habillage JT.</p>
                        </div>
                      </div>
                    </div>
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
                  Timeline · {Math.round(studioTimelineHeight)} px · {
                    timelineSyncState === 'saving'
                      ? 'Sauvegarde…'
                      : timelineSyncState === 'error'
                        ? 'Hors ligne'
                        : timelineSyncState === 'loading'
                          ? 'Chargement…'
                          : 'Enregistrée en ligne'
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
                        {selectedBin === 'delivery' ? 'Livraison JT' : countries.find(c => c.id === selectedBin)?.name || selectedBin}
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
                    <button
                      onClick={() => openDownloadDialog({ filename: `${selectedWeek}/${selectedBin}/archive`, name: `uploads_${selectedWeek}_${selectedBin}.zip` })}
                      className="btn btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5"
                    >
                      <Download size={14} /> {t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code)}
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
                        <Download size={16} /> <span>{t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code)}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openDownloadDialog({ filename: `${selectedWeek}/${selectedBin}/archive`, name: `uploads_${selectedWeek}_${selectedBin}.zip` })}
                        className="w-full btn btn-primary py-2 px-3 text-sm flex items-center justify-center gap-2 text-center"
                      >
                        <Download size={16} /> <span>{t.dashboard.downloadAll(countries.find(c => c.id === selectedBin)?.code)}</span>
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
                      ? 'border-[color:var(--accent)] bg-[var(--accent)]/10'
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
                {deliveries.length > 0 && (
                  <div className="panel p-6">
                    <h3 className="font-semibold text-[color:var(--ink)] mb-4">Fichiers uploadés</h3>
                    <ul className="space-y-3">
                      {deliveries.map((file) => (
                        <li key={file.id} className="group bg-[var(--paper-2)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all">
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
                              className="p-1.5 md:p-2 rounded-lg text-gray-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
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
              <div className="mt-4 flex flex-col gap-8">
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

                  const videoFiles = allFiles.filter(f => f?.type === 'video' || !!f?.name?.match(/\.(mp4|mov|avi|mkv)$/i));
                  const audioFiles = allFiles.filter(f => f?.type === 'audio' || !!f?.name?.match(/\.(mp3|wav|m4a|webm|ogg)$/i));
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
            
            {/* EXPORT PROGRESS (réel : download → encodage → upload) */}
            {isGeneratingVideo && (
              <div className="mt-8 bg-[var(--accent)]/5 border border-[var(--accent)] rounded-2xl p-6 shadow-md" role="status" aria-live="polite">
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
                    className="h-full rounded-full bg-[color:var(--accent)] transition-all duration-300 relative overflow-hidden"
                    style={{ width: `${Math.max(3, exportProgress)}%` }}
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
              <div className="mt-8 bg-[var(--paper)] border border-[var(--border)] rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-4">
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
          </div>
        }
        confirmText={feedbackStatus === 'approved' ? 'Approuver' : 'Rejeter & Notifier'}
        cancelText="Annuler"
        variant={feedbackStatus === 'approved' ? 'primary' : 'danger'}
        isLoading={isSubmittingFeedback}
        extraActions={
          feedbackStatus === 'rejected' && feedbackPhone && (
            <a
              href={`https://wa.me/${feedbackPhone.replace(/\+/g, '')}?text=${encodeURIComponent(`⚠️ Problème avec votre fichier "${fileToFeedback?.fileName}".\nMotif : ${feedbackText || 'Veuillez vérifier votre fichier et le renvoyer.'}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white transition-colors font-medium text-sm flex items-center gap-2 mr-auto"
              title="Notifier sur WhatsApp"
            >
              WhatsApp
            </a>
          )
        }
        onConfirm={handleConfirmFeedback}
        onCancel={() => {
          setFeedbackDialogOpen(false);
          setFileToFeedback(null);
          setFeedbackText('');
        }}
      />

      {/* Script Viewer Modal */}
      <ScriptViewerModal 
        file={viewingScript} 
        onClose={() => setViewingScript(null)}
        selectedWeek={selectedWeek}
        selectedBin={selectedBin}
        adminPassword={authenticatedAdminPassword}
        onContentChange={() => api.getDashboard(selectedWeek).then(setDashboard).catch(console.error)}
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
        onDownload={() => openDownloadDialog(actionSheetFile)}
        onDelete={() => openDeleteDialog(selectedBin, actionSheetFile?.id)}
        onViewScript={(f) => setViewingScript(f)}
      />
    </div>
    </div>
  );
}
