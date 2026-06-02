import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { X } from 'lucide-react';
import { JTMaster, totalDurationInFrames } from '../../../../remotion/src/JTMaster.jsx';
import { API_BASE } from '../../api/index.js';

export default function RemotionLivePreview({ clips, global, branding, timelineOverlays, onClose, inline = false, playerRef = null }) {
  // Prépare les données pour le Player (exactement comme pour le backend)
  const inputProps = useMemo(() => {
    // On résout les URLs relatives pour que Remotion puisse lire les vidéos depuis l'API locale.
    const resolvedClips = clips.map(clip => {
      const isExternal = clip.filename.startsWith('http') || clip.filename.startsWith('blob:');
      const url = isExternal ? clip.filename : `${API_BASE}/uploads/${clip.filename}?cors=2`;
      return {
        ...clip,
        url,
        // s'assure qu'on a bien durationSec, comme attendu par JTMaster
        // s'assure qu'on a bien durationSec, comme attendu par JTMaster
        durationSec: clip.durationSec || (clip.outPoint != null ? clip.outPoint - (clip.inPoint || 0) : null) || 5
      };
    });

    return {
      clips: resolvedClips,
      global: global || {},
      branding: branding || {},
      timelineOverlays: timelineOverlays || [],
      music: branding?.music?.enabled && branding.music.filename ? {
        filename: branding.music.filename,
        url: branding.music.filename.startsWith('http') ? branding.music.filename : `${API_BASE}/uploads/${branding.music.filename}`,
        volume: branding.music.volume,
        duck: branding.music.duck
      } : null,
      voiceover: branding?.voiceover?.filename ? {
        filename: branding.voiceover.filename,
        url: branding.voiceover.filename.startsWith('http') ? branding.voiceover.filename : `${API_BASE}/uploads/${branding.voiceover.filename}`,
        volume: branding.voiceover.volume
      } : null
    };
  }, [clips, global, branding, timelineOverlays]);

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
          <h2 className="font-bold text-[color:var(--ink)]">Aperçu Temps Réel (Remotion Player)</h2>
          <button onClick={onClose} className="p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] rounded-lg transition-colors bg-[var(--border)] hover:bg-[var(--border-dark)]">
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
          Ceci est le rendu exact (pixel-perfect) de ce qui sera généré par le moteur Remotion.
        </div>
      </div>
    </div>
  );
}
