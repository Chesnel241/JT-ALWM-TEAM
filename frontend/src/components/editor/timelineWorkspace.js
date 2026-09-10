import { API_BASE } from '../../api/index.js';

// Habillage par défaut d'un montage : un workspace serveur peut n'en décrire
// qu'une partie (ancien enregistrement, champ ajouté depuis), le reste est
// complété ici plutôt que laissé indéfini côté rendu.
export const DEFAULT_BRANDING = {
  ticker: { enabled: false, categorie: 'ALERTE', texte: '', speed: 1 },
  atmosphere: { vignette: 0, grain: 0, sweep: 0 },
  live: { enabled: false, label: 'DIRECT' },
  logo: false,
  logoPosition: 'br',
  music: { enabled: false, filename: '', volume: 0.2, duck: true },
  voiceover: { enabled: false, filename: '', startTime: 0, volume: 1 },
  imageOverlays: [],
};

// Un workspace venu du serveur arrive par trois chemins — hydratation d'une
// semaine, notification socket d'un collègue, workspace renvoyé avec un 409 de
// conflit — et doit être interprété exactement pareil dans les trois cas :
// trois copies de ce mapping finissaient par diverger.
export function normalizeWorkspace(workspace) {
  const safeClips = Array.isArray(workspace?.clips) ? workspace.clips : [];
  const clips = safeClips.map((clip) => {
    const filename = clip.filename || clip.name || '';
    const isExternal = filename.startsWith('http') || filename.startsWith('blob:');
    return {
      ...clip,
      url: isExternal ? filename : `${API_BASE}/uploads/${encodeURIComponent(filename)}?cors=2`,
    };
  });
  const overlays = Array.isArray(workspace?.overlays) ? workspace.overlays : [];
  const branding = workspace?.branding && typeof workspace.branding === 'object'
    ? { ...DEFAULT_BRANDING, ...workspace.branding }
    : DEFAULT_BRANDING;
  return {
    clips,
    overlays,
    branding,
    // Forme renvoyée au serveur : sert aussi d'empreinte pour savoir si
    // l'utilisateur a réellement modifié quelque chose depuis la synchro.
    payload: { clips: safeClips.map(({ url: _url, ...clip }) => clip), overlays, branding },
    revision: workspace?.revision ?? null,
  };
}
