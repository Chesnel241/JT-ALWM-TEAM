import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Timeline from '../src/components/editor/Timeline.jsx';
import OverlayPanel from '../src/components/editor/OverlayPanel.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { translations } from '../src/i18n/translations.js';
import { computeTimelineLayout } from '../src/components/editor/timelineModel.js';
import {
  TYPE_HABILLAGE, TYPE_MEDIA, glisseDuStudio, habillagesDesPlans, instantDuRang, lireGlisse, nouvellePlace,
  placerHabillage, planSous, rangInsertion, retirerHabillage,
} from '../src/components/editor/habillagesPlans.js';

vi.mock('../src/utils/thumbnails.js', () => ({ generateThumbnails: vi.fn().mockResolvedValue([]) }));

// LE CONSTAT : un nom à l'écran appartient à son plan, et son début se comptait
// en secondes depuis le début du plan. La timeline ne le montrait nulle part :
// pour qu'un bandeau tombe sur la bonne image, il fallait calculer la seconde
// exacte et la taper. On le glisse maintenant à l'œil, sur sa propre piste.

const dit = translations.fr.studio.timeline;
const nom = (extra = {}) => ({ id: 'n1', templateId: 'nom_interview', fields: { nom: 'Aminata Diallo' }, startTime: 2, duration: 4, ...extra });
const plan = (n, extra = {}) => ({
  instanceId: `c${n}`, name: `rush-${n}.mp4`, filename: `rush-${n}.mp4`, url: `blob:${n}`,
  inPoint: 0, outPoint: 10, durationSec: 10, sourceDurationSec: 20, overlays: [], ...extra,
});

describe('les habillages des plans — leur place dans le JT', () => {
  it('se placent au début de leur plan plus leur propre début', () => {
    const layout = computeTimelineLayout([plan(1), plan(2, { overlays: [nom()] })]);
    const [place] = habillagesDesPlans(layout);
    expect(place.debutPlan).toBe(10);
    expect(place.debut + place.debutPlan).toBe(12);
    expect(place.duree).toBe(4);
  });

  it('tiennent compte des transitions, comme au rendu', () => {
    const layout = computeTimelineLayout([plan(1, { transition: { type: 'fade', duration: 1 } }), plan(2, { overlays: [nom()] })]);
    expect(habillagesDesPlans(layout)[0].debutPlan).toBe(9);
  });

  it('un habillage « tout le plan » s’étend jusqu’à la fin du plan', () => {
    const layout = computeTimelineLayout([plan(1, { overlays: [nom({ startTime: 3, duration: null })] })]);
    expect(habillagesDesPlans(layout)[0].duree).toBe(7);
  });

  it('un habillage qui déborde d’un plan rogné est montré coupé, comme au rendu', () => {
    const layout = computeTimelineLayout([plan(1, { outPoint: 5, overlays: [nom({ startTime: 2, duration: 8 })] })]);
    expect(habillagesDesPlans(layout)[0].duree).toBe(3);
  });
});

describe('les habillages des plans — le glissé', () => {
  const place = { debut: 2, duree: 4, dureePlan: 10 };

  it('se déplace sans jamais sortir de son plan', () => {
    expect(nouvellePlace(place, 'move', 1.5)).toEqual({ debut: 3.5, duree: 4 });
    expect(nouvellePlace(place, 'move', -9)).toEqual({ debut: 0, duree: 4 });
    expect(nouvellePlace(place, 'move', 9)).toEqual({ debut: 6, duree: 4 });
  });

  it('règle son entrée sans bouger sa sortie', () => {
    expect(nouvellePlace(place, 'left', 1)).toEqual({ debut: 3, duree: 3 });
    // Jamais plus court que la durée minimale.
    expect(nouvellePlace(place, 'left', 10).duree).toBeCloseTo(0.3, 5);
  });

  it('règle sa sortie, au plus jusqu’à la fin du plan', () => {
    expect(nouvellePlace(place, 'right', 1)).toEqual({ debut: 2, duree: 5 });
    expect(nouvellePlace(place, 'right', 20)).toEqual({ debut: 2, duree: 8 });
  });

  it('se cale à l’image près et s’aimante', () => {
    expect(nouvellePlace(place, 'move', 0.01).debut).toBeCloseTo(2, 5);
    const aimant = (x) => (Math.abs(x - 5) < 0.3 ? 5 : x);
    expect(nouvellePlace(place, 'move', 2.8, aimant).debut).toBe(5);
  });

  it('n’écrit que l’habillage visé, et ne recrée rien sans raison', () => {
    const clips = [plan(1, { overlays: [nom(), nom({ id: 'n2' })] }), plan(2)];
    const suite = placerHabillage(clips, 'c1', 1, { debut: 5, duree: 2 });
    expect(suite[0].overlays[1]).toMatchObject({ id: 'n2', startTime: 5, duration: 2 });
    expect(suite[0].overlays[0]).toBe(clips[0].overlays[0]);
    expect(suite[1]).toBe(clips[1]);
    expect(placerHabillage(clips, 'inconnu', 0, { debut: 1, duree: 1 })).toBe(clips);
    expect(retirerHabillage(clips, 'c1', 0)[0].overlays.map((o) => o.id)).toEqual(['n2']);
  });
});

/**
 * Un dépôt avec sa position. jsdom n'a pas de DragEvent : l'événement générique
 * de testing-library perdrait `clientX`. Un MouseEvent nommé « drop » le garde.
 */
const lacher = (cible, clientX, dataTransfer) => {
  const evenement = new MouseEvent('drop', { bubbles: true, cancelable: true, clientX });
  Object.defineProperty(evenement, 'dataTransfer', { value: dataTransfer });
  fireEvent(cible, evenement);
};

/** Un transfert de glisser-déposer simulé, tel que le navigateur le donne. */
const transfert = (donnees = {}) => ({
  types: Object.keys(donnees),
  getData: (type) => donnees[type] || '',
  setData: vi.fn(),
  dropEffect: 'none',
  effectAllowed: 'all',
});

// Un dépôt est une donnée venue d'ailleurs : une autre page, ou le bureau, peut
// lâcher n'importe quoi dans la nôtre.
describe('le dépôt — ce qui est accepté', () => {
  it('accepte un rush du studio par son nom de fichier', () => {
    expect(lireGlisse(transfert({ [TYPE_MEDIA]: JSON.stringify({ filename: 'r1.mp4' }) }))).toEqual({ type: 'media', filename: 'r1.mp4' });
  });

  it('refuse un chemin, un fichier caché, un JSON cassé', () => {
    for (const filename of ['../../etc/passwd', 'a/b.mp4', 'a\\b.mp4', '.env', '']) {
      expect(lireGlisse(transfert({ [TYPE_MEDIA]: JSON.stringify({ filename }) }))).toBeNull();
    }
    expect(lireGlisse(transfert({ [TYPE_MEDIA]: '{pas du json' }))).toBeNull();
  });

  it('n’accepte qu’un modèle du catalogue', () => {
    const connus = ['nom_interview'];
    expect(lireGlisse(transfert({ [TYPE_HABILLAGE]: JSON.stringify({ templateId: 'nom_interview' }) }), connus)).toEqual({ type: 'habillage', templateId: 'nom_interview' });
    expect(lireGlisse(transfert({ [TYPE_HABILLAGE]: JSON.stringify({ templateId: '<img onerror>' }) }), connus)).toBeNull();
  });

  it('ignore un fichier lâché depuis le bureau ou un texte d’une autre page', () => {
    expect(glisseDuStudio(transfert({ Files: 'x' }))).toBe(false);
    expect(glisseDuStudio(transfert({ 'text/plain': 'bonjour' }))).toBe(false);
    expect(lireGlisse(transfert({ 'text/plain': JSON.stringify({ filename: 'r1.mp4' }) }))).toBeNull();
  });

  it('insère un plan avant le premier plan dont le milieu est après le point lâché', () => {
    const layout = computeTimelineLayout([plan(1), plan(2)]);
    expect(rangInsertion(layout, 3)).toBe(0);
    expect(rangInsertion(layout, 7)).toBe(1);
    expect(rangInsertion(layout, 19)).toBe(2);
    expect(instantDuRang(layout, 1)).toBe(10);
    expect(planSous(layout, 12).id).toBe('c2');
    expect(planSous(layout, 25)).toBeNull();
  });
});

describe('la piste des habillages dans la timeline', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    // 50 px par seconde : un point lâché à x = 600 tombe à 12 s.
    localStorage.setItem('jt-timeline-zoom', '50');
  });

  const poser = (clips, props = {}) => {
    const modifierMontage = vi.fn();
    render(
      <I18nProvider>
        <Timeline clips={clips} setClips={() => {}} timelineOverlays={[]} setTimelineOverlays={() => {}} onGenerate={() => {}} isGenerating={false} modifierMontage={modifierMontage} {...props} />
      </I18nProvider>,
    );
    // Ce que la timeline a écrit dans le montage, au dernier appel.
    const dernier = () => modifierMontage.mock.calls.at(-1)[0]({ clips, overlays: [] });
    return { modifierMontage, dernier };
  };

  it('montre le nom posé sur un plan, avec son texte', () => {
    poser([plan(1, { overlays: [nom()] })]);
    expect(screen.getByRole('region', { name: dit.pistePlans })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aminata Diallo/ })).toBeInTheDocument();
  });

  it('se règle à l’image près au clavier', () => {
    const { dernier } = poser([plan(1, { overlays: [nom()] })]);
    fireEvent.keyDown(screen.getByRole('button', { name: /Aminata Diallo/ }), { key: 'ArrowRight' });
    expect(dernier().clips[0].overlays[0].startTime).toBeCloseTo(2 + 1 / 30, 5);
  });

  it('se retire avec Suppr, sans toucher au plan', () => {
    const { dernier } = poser([plan(1, { overlays: [nom()] }), plan(2)]);
    fireEvent.keyDown(screen.getByRole('button', { name: /Aminata Diallo/ }), { key: 'Delete' });
    const suite = dernier().clips;
    expect(suite).toHaveLength(2);
    expect(suite[0].overlays).toEqual([]);
  });

  it('pose un modèle lâché sur un plan, à l’instant visé dans ce plan', () => {
    const onOverlayClip = vi.fn();
    const { dernier } = poser([plan(1), plan(2)], { onOverlayClip });
    const piste = screen.getByRole('region', { name: dit.pistePlans });
    lacher(piste, 600, transfert({ [TYPE_HABILLAGE]: JSON.stringify({ templateId: 'nom_interview' }) }));
    const ajoute = dernier().clips[1].overlays[0];
    expect(ajoute).toMatchObject({ templateId: 'nom_interview', startTime: 2, duration: 5, fields: {} });
    // L'inspecteur s'ouvre aussitôt pour écrire le nom.
    expect(onOverlayClip).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'c2' }));
  });

  it('confie un rush lâché au tableau de bord, avec le rang visé', () => {
    const onDeposerMedia = vi.fn();
    poser([plan(1), plan(2)], { onDeposerMedia });
    const piste = screen.getByRole('listbox', { name: dit.pisteVideo });
    lacher(piste, 400, transfert({ [TYPE_MEDIA]: JSON.stringify({ filename: 'r9.mp4' }) }));
    expect(onDeposerMedia).toHaveBeenCalledWith('r9.mp4', 1);
  });

  it('accepte le premier rush sur une timeline vide', () => {
    const onDeposerMedia = vi.fn();
    poser([], { onDeposerMedia });
    const zone = document.querySelector('[data-piste="video"]');
    lacher(zone, 10, transfert({ [TYPE_MEDIA]: JSON.stringify({ filename: 'r1.mp4' }) }));
    expect(onDeposerMedia).toHaveBeenCalledWith('r1.mp4', 0);
  });

  it('ne fait rien d’un fichier lâché depuis le bureau', () => {
    const onDeposerMedia = vi.fn();
    const { modifierMontage } = poser([plan(1)], { onDeposerMedia });
    lacher(screen.getByRole('listbox', { name: dit.pisteVideo }), 100, transfert({ Files: 'x' }));
    expect(onDeposerMedia).not.toHaveBeenCalled();
    expect(modifierMontage).not.toHaveBeenCalled();
  });
});

// L'INCIDENT évité : le panneau d'habillage gardait la copie prise à son
// ouverture. Un habillage déplacé sur la timeline pendant qu'il était ouvert
// revenait à son ancienne place au clic suivant.
describe('le panneau d’habillage suit la timeline', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); });

  it('adopte un déplacement fait sur la timeline, sans étape d’annulation en trop', () => {
    const onChangePreview = vi.fn();
    const onSave = vi.fn();
    const clip = plan(1, { overlays: [nom()] });
    const { rerender } = render(<I18nProvider><OverlayPanel inline clip={clip} onClose={() => {}} onSave={onSave} onChangePreview={onChangePreview} /></I18nProvider>);
    const appelsAvant = onChangePreview.mock.calls.length;
    const deplace = { ...clip, overlays: [nom({ startTime: 6 })] };
    rerender(<I18nProvider><OverlayPanel inline clip={deplace} onClose={() => {}} onSave={onSave} onChangePreview={onChangePreview} /></I18nProvider>);
    expect(onChangePreview.mock.calls.length).toBe(appelsAvant);
    fireEvent.click(screen.getByRole('button', { name: /Valider \(1 texte\)/ }));
    expect(onSave.mock.calls[0][0].overlays[0].startTime).toBe(6);
  });
});
