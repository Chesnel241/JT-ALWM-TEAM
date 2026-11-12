import { describe, it, expect } from 'vitest';
import {
  assemblerRubriques, LIBELLE_SEMINAIRES, LIBELLE_ANNONCES, TRANSITION_ENTRE_PAYS,
} from '../src/components/editor/rubriquesAuto.js';
import { computeTimelineLayout } from '../src/components/editor/timelineModel.js';

// LE BESOIN : chaque semaine, le monteur refait à la main les séminaires, les
// annonces et le mot du JT : glisser les vidéos, écrire le nom du pays sur
// chaque bloc, caler les transitions. Un clic doit faire tout cela, sans rien
// écraser de ce que le monteur a déjà posé.

const NOMS = { gab: 'Gabon', cmr: 'Cameroun', ci: 'Côte d’Ivoire' };
const nomPays = (id) => NOMS[id] || id;
const video = (filename, countryId, reportage, uploadedAt = '2026-11-10T10:00:00Z', extra = {}) => ({
  filename, name: filename, countryId, reportage, status: 'pending', uploadedAt, durationSec: 10, ...extra,
});
const versClip = (f) => ({ ...f, instanceId: `i-${f.filename}`, overlays: [], durationSec: 10, sourceDurationSec: 10 });
let n = 0;
const creerId = () => `t${++n}`;
const lancer = (args) => assemblerRubriques({ nomPays, versClip, creerId, ...args });

describe('les rubriques automatiques — séminaires', () => {
  it('range les vidéos par pays, dans l’ordre alphabétique du JT', () => {
    const videos = [
      ...Array.from({ length: 10 }, (_, i) => video(`gab${i}.mp4`, 'gab', LIBELLE_SEMINAIRES, `2026-11-10T10:${String(i).padStart(2, '0')}:00Z`)),
      ...Array.from({ length: 7 }, (_, i) => video(`cmr${i}.mp4`, 'cmr', LIBELLE_SEMINAIRES, `2026-11-10T11:${String(i).padStart(2, '0')}:00Z`)),
    ];
    const { clips, bilan } = lancer({ videos, clips: [] });
    // Cameroun avant Gabon : l'ordre alphabétique, comme le rangement des rushes.
    expect(clips.map((c) => c.filename)).toEqual([
      ...Array.from({ length: 7 }, (_, i) => `cmr${i}.mp4`),
      ...Array.from({ length: 10 }, (_, i) => `gab${i}.mp4`),
    ]);
    expect(bilan.seminaires).toEqual({ pays: 2, fichiers: 17 });
  });

  it('pose le nom du pays sur tout le bloc, du premier au dernier plan', () => {
    const videos = [video('gab1.mp4', 'gab', LIBELLE_SEMINAIRES), video('gab2.mp4', 'gab', LIBELLE_SEMINAIRES)];
    const { clips, overlays } = lancer({ videos, clips: [] });
    const layout = computeTimelineLayout(clips);
    const bandeau = overlays.find((o) => o.templateId === 'mention_image');
    // LE CONSTAT : le bandeau doit suivre le bloc, calé sur les débuts réels.
    expect(bandeau.fields.texte).toBe(`Gabon · ${LIBELLE_SEMINAIRES}`);
    expect(bandeau.startTime).toBeCloseTo(layout.items[0].start, 6);
    expect(bandeau.startTime + bandeau.duration).toBeCloseTo(layout.items[1].start + layout.items[1].duration, 6);
  });

  it('pose une transition de chaîne entre deux pays, mais pas après le dernier plan du JT', () => {
    const videos = [video('cmr1.mp4', 'cmr', LIBELLE_SEMINAIRES), video('gab1.mp4', 'gab', LIBELLE_SEMINAIRES)];
    const { clips } = lancer({ videos, clips: [] });
    expect(clips[0].transition).toEqual(TRANSITION_ENTRE_PAYS);
    expect(clips[1].transition).toBeUndefined();
  });

  it('ne reprend ni les images, ni les vidéos refusées, ni les tiroirs du JT', () => {
    const videos = [
      video('gab1.mp4', 'gab', LIBELLE_SEMINAIRES),
      video('gab2.jpg', 'gab', LIBELLE_SEMINAIRES),
      video('gab3.mp4', 'gab', LIBELLE_SEMINAIRES, undefined, { status: 'rejected' }),
      video('tj1.mp4', 'tj', LIBELLE_SEMINAIRES),
    ];
    const { clips } = lancer({ videos, clips: [] });
    expect(clips.map((c) => c.filename)).toEqual(['gab1.mp4']);
  });
});

describe('les rubriques automatiques — annonces, mot du JT, reprise', () => {
  it('place les annonces après les séminaires, avec leur propre bandeau', () => {
    const videos = [
      video('gab1.mp4', 'gab', LIBELLE_SEMINAIRES),
      video('cmr1.mp4', 'cmr', LIBELLE_ANNONCES),
    ];
    const { clips, overlays, bilan } = lancer({ videos, clips: [] });
    expect(clips.map((c) => c.filename)).toEqual(['gab1.mp4', 'cmr1.mp4']);
    expect(overlays.map((o) => o.fields.texte)).toEqual([
      `Gabon · ${LIBELLE_SEMINAIRES}`,
      `Cameroun · ${LIBELLE_ANNONCES}`,
    ]);
    expect(bilan.annonces).toEqual({ pays: 1, fichiers: 1 });
  });

  it('place le mot du JT en dernier, avec le nom et le thème saisis', () => {
    const videos = [
      video('mj1.mp4', 'mj', ''),
      video('gab1.mp4', 'gab', LIBELLE_SEMINAIRES),
    ];
    const { clips, overlays, bilan } = lancer({
      videos, clips: [], motDuJt: { orateur: 'Aminata Diallo', theme: 'Le budget 2027' },
    });
    expect(clips.map((c) => c.filename)).toEqual(['gab1.mp4', 'mj1.mp4']);
    const nom = overlays.find((o) => o.templateId === 'nom_interview');
    expect(nom.fields).toEqual({ nom: 'Aminata Diallo', fonction: 'Le budget 2027' });
    expect(bilan.motDuJt).toEqual({ fichiers: 1, orateur: true });
  });

  it('ne pose aucun nom quand le journaliste n’a rien saisi pour le mot du JT', () => {
    const { overlays } = lancer({ videos: [video('mj1.mp4', 'mj', '')], clips: [], motDuJt: { orateur: ' ', theme: '' } });
    expect(overlays.some((o) => o.templateId === 'nom_interview')).toBe(false);
  });

  // LE CONSTAT : relancer le bouton ne doit ni doubler les plans ni toucher au
  // déroulé déjà travaillé par le monteur.
  it('ne reprend jamais une vidéo déjà au déroulé et ne touche à rien si tout y est', () => {
    const videos = [video('gab1.mp4', 'gab', LIBELLE_SEMINAIRES)];
    const premier = lancer({ videos, clips: [] });
    const second = lancer({ videos, clips: premier.clips, overlays: premier.overlays });
    expect(second.clips).toBe(premier.clips);
    expect(second.overlays).toBe(premier.overlays);
    expect(second.bilan.deja).toBe(1);
    expect(second.bilan.seminaires.fichiers).toBe(0);
  });

  it('ajoute seulement les nouvelles vidéos d’un pays déjà présent', () => {
    const d1 = [video('gab1.mp4', 'gab', LIBELLE_SEMINAIRES)];
    const d2 = [...d1, video('gab2.mp4', 'gab', LIBELLE_SEMINAIRES, '2026-11-10T12:00:00Z')];
    const premier = lancer({ videos: d1, clips: [] });
    const suite = lancer({ videos: d2, clips: premier.clips, overlays: premier.overlays });
    expect(suite.clips.map((c) => c.filename)).toEqual(['gab1.mp4', 'gab2.mp4']);
    expect(suite.bilan.deja).toBe(1);
  });

  it('garde le travail manuel du monteur devant les rubriques ajoutées', () => {
    const plan = { filename: 'reportage.mp4', instanceId: 'manuel', overlays: [], durationSec: 30 };
    const { clips } = lancer({ videos: [video('gab1.mp4', 'gab', LIBELLE_SEMINAIRES)], clips: [plan] });
    expect(clips[0]).toBe(plan);
    expect(clips[1].filename).toBe('gab1.mp4');
  });
});
