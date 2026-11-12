import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Timeline from '../src/components/editor/Timeline.jsx';
import PanneauSon from '../src/components/editor/PanneauSon.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { translations } from '../src/i18n/translations.js';
import {
  cretes, ecrireSon, migrerVoixOff, nouveauSon, nouvellePlaceSon, placeSon, retirerSon, roleDevine,
} from '../src/components/editor/pisteSon.js';
import { aLEchelle, traceFormeOnde } from '../src/components/editor/formeOnde.js';
import { normalizeWorkspace, DEFAULT_BRANDING } from '../src/components/editor/timelineWorkspace.js';
import { assemblerRubriques, LIBELLE_ANNONCES } from '../src/components/editor/rubriquesAuto.js';
import { TYPE_SON } from '../src/components/editor/habillagesPlans.js';

vi.mock('../src/utils/thumbnails.js', () => ({ generateThumbnails: vi.fn().mockResolvedValue([]) }));

// LE CONSTAT : le JT n'acceptait qu'une seule voix off, réglée par une heure
// tapée en secondes dans « Habillage du JT ». Impossible d'en poser deux, de
// les voir sous l'image, de les caler ou de les raccourcir.

const dit = translations.fr.studio.timeline;
const voix = (extra = {}) => ({
  id: 'son-1', filename: 'voix.mp3', name: 'Voix Gabon', role: 'voix',
  startTime: 4, inPoint: 1, outPoint: 9, sourceDurationSec: 12, volume: 1, attenuer: true, ...extra,
});

describe('la piste son — les gestes', () => {
  const place = placeSon(voix());

  it('connaît sa place et ce que son fichier permet encore', () => {
    expect(place).toEqual({ debut: 4, duree: 8, inPoint: 1, source: 12 });
  });

  it('se déplace, jamais avant le début du JT', () => {
    expect(nouvellePlaceSon(place, 'move', 2)).toEqual({ startTime: 6, inPoint: 1, outPoint: 9 });
    expect(nouvellePlaceSon(place, 'move', -10).startTime).toBe(0);
  });

  it('se raccourcit par le début, et se rallonge jusqu’au début du fichier, pas au-delà', () => {
    expect(nouvellePlaceSon(place, 'left', 2)).toEqual({ startTime: 6, inPoint: 3, outPoint: 9 });
    expect(nouvellePlaceSon(place, 'left', -5)).toEqual({ startTime: 3, inPoint: 0, outPoint: 9 });
  });

  it('se raccourcit par la fin, et se rallonge jusqu’à la fin du fichier, pas au-delà', () => {
    expect(nouvellePlaceSon(place, 'right', -3)).toEqual({ startTime: 4, inPoint: 1, outPoint: 6 });
    expect(nouvellePlaceSon(place, 'right', 20)).toEqual({ startTime: 4, inPoint: 1, outPoint: 12 });
  });

  it('n’écrit que le son visé', () => {
    const piste = [voix(), voix({ id: 'son-2' })];
    const suite = ecrireSon(piste, 'son-2', { volume: 0.5 });
    expect(suite[1].volume).toBe(0.5);
    expect(suite[0]).toBe(piste[0]);
    expect(ecrireSon(piste, 'inconnu', { volume: 0 })).toBe(piste);
    expect(retirerSon(piste, 'son-1').map((s) => s.id)).toEqual(['son-2']);
  });
});

describe('la piste son — un nouveau son', () => {
  it('devine une voix off, une musique ou un son', () => {
    expect(roleDevine({ name: 'Annonce Gabon.m4a' })).toBe('voix');
    expect(roleDevine({ name: 'Musique de fond.mp3' })).toBe('musique');
    expect(roleDevine({ name: 'Ambiance marché.wav' })).toBe('son');
  });

  it('se pose à l’instant voulu, et refuse un chemin', () => {
    expect(nouveauSon({ filename: 'v.mp3', name: 'Voix' }, { id: 'a1', instant: 12.01, duree: 30 })).toMatchObject({
      id: 'a1', startTime: 12, sourceDurationSec: 30, role: 'voix', attenuer: true, volume: 1,
    });
    expect(nouveauSon({ filename: '../v.mp3' }, { id: 'a2' })).toBeNull();
  });
});

describe('l’ancienne voix off unique', () => {
  const branding = { ...DEFAULT_BRANDING, voiceover: { enabled: true, filename: 'vo.mp3', startTime: 7, volume: 0.6 } };

  it('passe sur la piste son, au même endroit et au même volume', () => {
    const { branding: apres, audio } = migrerVoixOff(branding, []);
    expect(audio).toHaveLength(1);
    expect(audio[0]).toMatchObject({ filename: 'vo.mp3', startTime: 7, volume: 0.6, role: 'voix' });
    // L'ancien réglage s'éteint : sinon la voix serait jouée deux fois.
    expect(apres.voiceover.enabled).toBe(false);
  });

  it('ne fait rien si la piste a déjà des sons, ou si la voix off était éteinte', () => {
    expect(migrerVoixOff(branding, [voix()]).audio).toEqual([voix()]);
    const eteinte = { ...branding, voiceover: { ...branding.voiceover, enabled: false } };
    expect(migrerVoixOff(eteinte, []).audio).toEqual([]);
  });

  it('est reprise au chargement d’un montage, et la piste part avec la sauvegarde', () => {
    const lu = normalizeWorkspace({ clips: [], overlays: [], branding, audio: [] });
    expect(lu.audio).toHaveLength(1);
    expect(lu.payload.audio).toEqual(lu.audio);
    expect(lu.branding.voiceover.enabled).toBe(false);
  });
});

describe('la forme d’onde', () => {
  it('garde la crête de chaque colonne', () => {
    const signal = new Float32Array(1600);
    signal[0] = -0.75;
    signal[800] = 0.5;
    expect(cretes(signal, 2)).toEqual([0.75, 0.5]);
    expect(cretes(new Float32Array(0), 3)).toEqual([0, 0, 0]);
  });

  it('reste lisible pour une voix enregistrée doucement', () => {
    expect(aLEchelle([0.05, 0.2, 0.1])).toEqual([0.25, 1, 0.5]);
    expect(aLEchelle([0, 0])).toEqual([0, 0]);
  });

  it('se trace en une forme fermée, haut et bas', () => {
    expect(traceFormeOnde([0, 1])).toBe('M0,1.000 L1,0.000 L1,2.000 L0,1.000 Z');
    expect(traceFormeOnde([])).toBe('');
  });
});

describe('la piste son dans la timeline', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    localStorage.setItem('jt-timeline-zoom', '50');
  });

  const plan = { instanceId: 'c1', name: 'r1.mp4', filename: 'r1.mp4', url: 'blob:r1', inPoint: 0, outPoint: 20, durationSec: 20, sourceDurationSec: 20, overlays: [] };
  const poser = (audio, props = {}) => {
    const modifierMontage = vi.fn();
    render(
      <I18nProvider>
        <Timeline clips={[plan]} setClips={() => {}} timelineOverlays={[]} setTimelineOverlays={() => {}} onGenerate={() => {}} isGenerating={false} modifierMontage={modifierMontage} audio={audio} {...props} />
      </I18nProvider>,
    );
    const dernier = () => modifierMontage.mock.calls.at(-1)[0]({ clips: [plan], overlays: [], audio });
    return { dernier, modifierMontage };
  };

  it('montre chaque son à sa place, avec sa nature', () => {
    poser([voix()]);
    expect(screen.getByRole('region', { name: dit.pisteSon })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Voix off · Voix Gabon/ })).toBeInTheDocument();
  });

  it('se cale à l’image près au clavier', () => {
    const { dernier } = poser([voix()]);
    fireEvent.keyDown(screen.getByRole('button', { name: /Voix Gabon/ }), { key: 'ArrowRight' });
    expect(dernier().audio[0].startTime).toBeCloseTo(4 + 1 / 30, 5);
  });

  it('se retire avec Suppr', () => {
    const { dernier } = poser([voix(), voix({ id: 'son-2', name: 'Voix Cameroun' })]);
    fireEvent.keyDown(screen.getByRole('button', { name: /Voix Gabon/ }), { key: 'Delete' });
    expect(dernier().audio.map((s) => s.id)).toEqual(['son-2']);
  });

  it('s’ouvre au réglage d’Entrée', () => {
    const onOuvrirSon = vi.fn();
    poser([voix()], { onOuvrirSon });
    fireEvent.keyDown(screen.getByRole('button', { name: /Voix Gabon/ }), { key: 'Enter' });
    expect(onOuvrirSon).toHaveBeenCalledWith(expect.objectContaining({ id: 'son-1' }));
  });

  it('confie un son lâché au tableau de bord, avec l’instant visé', () => {
    const onDeposerSon = vi.fn();
    poser([], { onDeposerSon });
    const evenement = new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 300 });
    Object.defineProperty(evenement, 'dataTransfer', { value: { types: [TYPE_SON], getData: (t) => (t === TYPE_SON ? JSON.stringify({ filename: 'voix.mp3' }) : '') } });
    fireEvent(screen.getByRole('region', { name: dit.pisteSon }), evenement);
    expect(onDeposerSon).toHaveBeenCalledWith('voix.mp3', 6);
  });
});

describe('le réglage d’un son', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); });

  it('règle le volume, la baisse des plans, et retire', () => {
    const onChange = vi.fn();
    const onRetirer = vi.fn();
    render(<I18nProvider><PanneauSon son={voix()} onChange={onChange} onRetirer={onRetirer} onFermer={() => {}} onEcouter={() => {}} /></I18nProvider>);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '0.4' } });
    expect(onChange).toHaveBeenLastCalledWith({ volume: 0.4 }, 'volume');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith({ attenuer: false }, 'attenuer');
    fireEvent.click(screen.getByRole('button', { name: /Retirer de la piste/ }));
    expect(onRetirer).toHaveBeenCalledTimes(1);
  });
});

// LE BESOIN : les voix off envoyées avec les annonces doivent partir avec leur
// bloc, sans que le monteur les cherche et les cale à la main.
describe('les rubriques automatiques posent les voix off des annonces', () => {
  it('au début du bloc du pays, l’une après l’autre', () => {
    const video = (filename, countryId) => ({ filename, name: filename, countryId, reportage: LIBELLE_ANNONCES, status: 'pending', uploadedAt: '2026-11-10T10:00:00Z' });
    const audio = (filename, countryId, uploadedAt) => ({ filename, name: filename, countryId, reportage: LIBELLE_ANNONCES, status: 'pending', uploadedAt });
    let n = 0;
    const r = assemblerRubriques({
      videos: [video('cmr1.mp4', 'cmr'), video('gab1.mp4', 'gab')],
      clips: [],
      nomPays: (id) => ({ cmr: 'Cameroun', gab: 'Gabon' }[id]),
      versClip: (f) => ({ ...f, instanceId: f.filename, overlays: [], durationSec: 10, sourceDurationSec: 10 }),
      creerId: () => `t${++n}`,
      sons: [audio('gab-a.mp3', 'gab', '2026-11-10T09:00:00Z'), audio('gab-b.mp3', 'gab', '2026-11-10T09:30:00Z'), audio('autre.mp3', 'gab', 'x')].map((f, i) => (i === 2 ? { ...f, reportage: 'Marché' } : f)),
      audio: [],
      versSon: (f, instant) => nouveauSon(f, { id: `s-${f.filename.replace(/\W/g, '')}`, instant, duree: 4 }),
    });
    // Cameroun d'abord (10 s, puis une transition de 0,6 s) : le bloc du Gabon commence à 9,4 s.
    expect(r.audio.map((s) => [s.filename, s.startTime])).toEqual([['gab-a.mp3', 9.4], ['gab-b.mp3', 13.4]]);
    expect(r.bilan.annonces.sons).toBe(2);
  });
});
