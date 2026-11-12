import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Timeline from '../src/components/editor/Timeline.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { translations } from '../src/i18n/translations.js';
import { computeTimelineLayout } from '../src/components/editor/timelineModel.js';
import { coupeVoisine, pointsDeCoupe, rognerALaTete } from '../src/components/editor/raccourcis.js';

vi.mock('../src/utils/thumbnails.js', () => ({ generateThumbnails: vi.fn().mockResolvedValue([]) }));

// LE CONSTAT : pour raccourcir un plan, il fallait viser un bord au pixel ou
// taper des secondes dans le rognage précis. Les monteurs posent la tête de
// lecture sur l'image voulue et disent « ici commence le plan » (I) ou « ici il
// s'arrête » (O), et sautent d'une coupe à l'autre (↑ ↓).

const dit = translations.fr.studio.timeline;
const plan = (n, extra = {}) => ({
  instanceId: `c${n}`, name: `rush-${n}.mp4`, filename: `rush-${n}.mp4`, url: `blob:${n}`,
  inPoint: 2, outPoint: 12, durationSec: 10, sourceDurationSec: 30, overlays: [], ...extra,
});

describe('les raccourcis — le calcul', () => {
  const layout = computeTimelineLayout([plan(1), plan(2)]);

  it('I coupe ce qui précède la tête de lecture, dans la source', () => {
    expect(rognerALaTete(plan(1), layout.items[0], 3, 'debut')).toMatchObject({ inPoint: 5, outPoint: 12, durationSec: 7 });
  });

  it('O coupe ce qui suit', () => {
    expect(rognerALaTete(plan(2), layout.items[1], 14, 'fin')).toMatchObject({ inPoint: 2, outPoint: 6, durationSec: 4 });
  });

  it('refuse hors du plan, ou s’il deviendrait trop court', () => {
    expect(rognerALaTete(plan(1), layout.items[0], 12, 'fin')).toBeNull();
    expect(rognerALaTete(plan(1), layout.items[0], 0.1, 'fin')).toBeNull();
  });

  it('saute d’une coupe à l’autre', () => {
    expect(pointsDeCoupe(layout)).toEqual([0, 10, 20]);
    expect(coupeVoisine(layout, 3, 1)).toBe(10);
    expect(coupeVoisine(layout, 10, 1)).toBe(20);
    expect(coupeVoisine(layout, 10, -1)).toBe(0);
    expect(coupeVoisine(layout, 20, 1)).toBe(20);
  });
});

describe('les raccourcis — dans la timeline', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); });

  const poser = (extra = {}) => {
    const modifierMontage = vi.fn();
    const lecteur = { play: vi.fn(), pause: vi.fn(), isPlaying: () => false, seekTo: vi.fn(), getCurrentFrame: () => 0, addEventListener: () => {}, removeEventListener: () => {} };
    const clips = [plan(1), plan(2)];
    render(
      <I18nProvider>
        <Timeline clips={clips} setClips={() => {}} timelineOverlays={[]} setTimelineOverlays={() => {}} onGenerate={() => {}} isGenerating={false} modifierMontage={modifierMontage} playerRef={{ current: lecteur }} {...extra} />
      </I18nProvider>,
    );
    const dernier = () => modifierMontage.mock.calls.at(-1)[0]({ clips, overlays: [] });
    const touche = (key, options = {}) => fireEvent.keyDown(window, { key, ...options });
    return { modifierMontage, lecteur, dernier, touche };
  };

  it('O arrête le plan à la tête de lecture', () => {
    const { dernier, touche } = poser();
    for (let i = 0; i < 3; i += 1) touche('ArrowRight', { shiftKey: true });
    touche('o');
    expect(dernier().clips[0]).toMatchObject({ inPoint: 2, outPoint: 5 });
    expect(screen.getByText(dit.msgFinIci)).toBeInTheDocument();
  });

  it('I fait commencer le plan à la tête de lecture', () => {
    const { dernier, touche } = poser();
    for (let i = 0; i < 4; i += 1) touche('ArrowRight', { shiftKey: true });
    touche('i');
    expect(dernier().clips[0]).toMatchObject({ inPoint: 6, outPoint: 12 });
  });

  it('dit pourquoi I ne fait rien au tout début du plan', () => {
    const { modifierMontage, touche } = poser();
    touche('i');
    expect(modifierMontage).not.toHaveBeenCalled();
    expect(screen.getByText(dit.msgRognerImpossible)).toBeInTheDocument();
  });

  it('J recule, K met en pause, L lit', () => {
    const { lecteur, touche } = poser();
    touche('l');
    expect(lecteur.play).toHaveBeenCalledTimes(1);
    touche('k');
    expect(lecteur.pause).toHaveBeenCalled();
    touche('ArrowDown');
    touche('j');
    // La coupe suivante (10 s), puis une seconde en arrière : 9 s, soit l'image 270.
    expect(lecteur.seekTo).toHaveBeenLastCalledWith(270);
  });

  it('⌘/Ctrl D duplique le plan choisi, juste après lui', () => {
    const { dernier, touche } = poser({ selection: 'c1', onSelection: () => {} });
    touche('d', { ctrlKey: true });
    const suite = dernier().clips;
    expect(suite).toHaveLength(3);
    expect(suite[1].filename).toBe('rush-1.mp4');
    expect(suite[1].instanceId).not.toBe('c1');
  });

  it('les raccourcis se taisent pendant une saisie', () => {
    const { modifierMontage } = poser();
    const champ = document.createElement('input');
    document.body.appendChild(champ);
    fireEvent.keyDown(champ, { key: 'o' });
    fireEvent.keyDown(champ, { key: 'd', ctrlKey: true });
    expect(modifierMontage).not.toHaveBeenCalled();
    champ.remove();
  });
});
