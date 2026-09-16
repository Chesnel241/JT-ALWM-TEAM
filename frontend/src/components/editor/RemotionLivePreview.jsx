import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { X } from 'lucide-react';
import { JTMaster, totalDurationInFrames } from '../../../../remotion/src/JTMaster.jsx';
import { API_BASE } from '../../api/index.js';
import { previewUrl } from '../../lib/mediaSource.js';
import { useI18n } from '../../i18n/I18nContext.jsx';

// Le mot de passe admin ne transite plus par l'URL des médias : /uploads est
// servi sans authentification, et un secret en query string finissait dans les
// journaux d'accès (Caddy, nginx) et l'historique du navigateur.
export default function RemotionLivePreview({ clips, branding, timelineOverlays, onClose, inline = false, playerRef = null }) {
  const { t } = useI18n();
  // Prépare les données pour le Player (exactement comme pour le backend)
  const inputProps = useMemo(() => {
    // On résout les URLs relatives pour que Remotion puisse lire les vidéos depuis l'API locale.
    const resolvedClips = clips.map(clip => {
      const url = previewUrl(clip);
      return {
        ...clip,
        url,
        // La plage source est prioritaire : aperçu et export doivent lire
        // exactement les mêmes bornes après un trim ou un split.
        durationSec: clip.outPoint != null
          ? Math.max(0.3, clip.outPoint - (clip.inPoint || 0))
          : Math.max(0.3, Number(clip.durationSec) || 5)
      };
    });

    // L'aperçu doit composer comme l'export, sinon il ne montre pas ce qu'on
    // va diffuser. L'export fusionne `branding.overlays` (section « Animations
    // & Habillages Globaux ») avec la piste des titres avant d'envoyer, et
    // JTMaster ne lit que `timelineOverlays` : sans cette fusion, l'intro du
    // JT, la transition, la barre défilante, le flash info et le breaking news
    // étaient absents du lecteur tout en étant présents dans le master.
    const habillagesGlobaux = [...(branding?.overlays || []), ...(timelineOverlays || [])];

    // Même écart pour les incrustations d'images : elles vivent sous
    // `branding.imageOverlays` alors que JTMaster attend un prop de premier
    // niveau, et n'apparaissaient donc jamais à l'aperçu.
    const incrustations = (branding?.imageOverlays || [])
      .filter((o) => o && o.filename)
      .map((o) => ({
        ...o,
        url: o.filename.startsWith('http') ? o.filename : `${API_BASE}/uploads/${o.filename}?cors=2`,
      }));

    return {
      clips: resolvedClips,
      branding: branding || {},
      timelineOverlays: habillagesGlobaux,
      imageOverlays: incrustations,
      music: branding?.music?.enabled && branding.music.filename ? {
        filename: branding.music.filename,
        url: branding.music.filename.startsWith('http') ? branding.music.filename : `${API_BASE}/uploads/${branding.music.filename}?cors=2`,
        volume: branding.music.volume,
        duck: branding.music.duck
      } : null,
      voiceover: branding?.voiceover?.filename ? {
        filename: branding.voiceover.filename,
        url: branding.voiceover.filename.startsWith('http') ? branding.voiceover.filename : `${API_BASE}/uploads/${branding.voiceover.filename}?cors=2`,
        volume: branding.voiceover.volume
      } : null
    };
  }, [clips, branding, timelineOverlays]);

  const durationInFrames = useMemo(() => {
    return Math.max(30, totalDurationInFrames(inputProps.clips, 30));
  }, [inputProps.clips]);

  if (inline) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden relative">
        <Player
          ref={playerRef}
          component={JTMaster}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={30}
          controls
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-[var(--ink)]/80 backdrop-blur-md">
      <div className="bg-[var(--paper)] rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl border border-[var(--border)] max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="font-bold text-[color:var(--ink)]">{t.studio.panneaux.apercuTitre}</h2>
          <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] rounded-lg transition-colors bg-[var(--border)] hover:bg-[var(--muted)]/30">
            <X size={20} />
          </button>
        </div>
        
        {/* Player Container */}
        <div className="flex-1 bg-black overflow-hidden flex items-center justify-center p-4">
          <Player
            ref={playerRef}
            component={JTMaster}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            compositionWidth={1920}
            compositionHeight={1080}
            fps={30}
            controls
            autoPlay
            style={{ width: '100%', aspectRatio: '16/9', maxHeight: '75vh', borderRadius: '8px' }}
          />
        </div>
        <div className="px-5 py-3 text-[11px] text-[color:var(--muted)] text-center bg-[var(--paper-2)] border-t border-[var(--border)]">
          {t.studio.panneaux.apercuAide}</div>
      </div>
    </div>
  );
}
