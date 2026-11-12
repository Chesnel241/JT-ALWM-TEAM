import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Timeline from '../src/components/editor/Timeline.jsx';
import { Deroule, DockTimeline, borneDock, DOCK_MIN, DOCK_MAX, DOCK_DEFAUT } from '../src/components/editor/Conducteur.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { translations } from '../src/i18n/translations.js';

vi.mock('../src/utils/thumbnails.js', () => ({
  // Les miniatures lisent une vidéo : hors sujet ici, et indisponible en jsdom.
  generateThumbnails: vi.fn().mockResolvedValue([]),
}));

// LE CONSTAT : la timeline n'existait que dans la vue détaillée. En vue simple,
// on ne voyait ni où tombaient les plans ni où commençaient les titres, et un
// titre se réglait en tapant des secondes. Elle est maintenant sous le lecteur.

const dit = translations.fr.studio.timeline;
const d = translations.fr.studio.deroule;
const plan = (n) => ({
  instanceId: `c${n}`, name: `rush-${n}.mp4`, filename: `rush-${n}.mp4`, url: `blob:rush-${n}`,
  durationSec: 5, sourceDurationSec: 20, overlays: [],
});

const poserTimeline = (props = {}) => render(
  <I18nProvider>
    <Timeline
      clips={[plan(1), plan(2)]}
      setClips={() => {}}
      timelineOverlays={[]}
      setTimelineOverlays={() => {}}
      onGenerate={() => {}}
      isGenerating={false}
      modifierMontage={() => {}}
      {...props}
    />
  </I18nProvider>,
);

beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); });

describe('la timeline posée sous le lecteur', () => {
  it('ne répète pas ce que la barre du studio porte déjà', () => {
    poserTimeline({ variante: 'integree', libelleSemaine: 'Semaine 46' });
    expect(screen.queryByRole('button', { name: dit.genererMaster })).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(dit.annuler, 'i') })).toBeNull();
    expect(screen.queryByText('Semaine 46')).toBeNull();
    // Mais elle garde ses deux pistes : les plans et les titres.
    expect(screen.getByRole('listbox', { name: dit.pisteVideo })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: dit.pisteTitres })).toBeInTheDocument();
  });

  it('garde tout dans la vue détaillée', () => {
    poserTimeline({ libelleSemaine: 'Semaine 46' });
    expect(screen.getByRole('button', { name: dit.genererMaster })).toBeInTheDocument();
    expect(screen.getByText('Semaine 46')).toBeInTheDocument();
  });

  it('partage le plan choisi avec le déroulé', () => {
    const onSelection = vi.fn();
    poserTimeline({ variante: 'integree', selection: 'c2', onSelection });
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(options[0]);
    expect(onSelection).toHaveBeenCalledWith('c1');
  });
});

// L'INCIDENT évité : deux écouteurs sur Espace (déroulé et timeline) se
// compensaient — lecture puis pause dans le même geste — et Suppr aurait
// retiré deux plans. Quand la timeline est ouverte, elle seule prend le clavier.
describe('le clavier du déroulé quand la timeline est ouverte', () => {
  const poserDeroule = (clavier) => {
    const lecteur = { play: vi.fn(), pause: vi.fn(), isPlaying: () => false, seekTo: vi.fn() };
    const modifierMontage = vi.fn();
    render(
      <I18nProvider>
        <Deroule
          clips={[plan(1), plan(2)]}
          countries={[]}
          playerRef={{ current: lecteur }}
          choisiId="c1"
          onChoisir={() => {}}
          modifierMontage={modifierMontage}
          nouvelId={() => 'x'}
          clavier={clavier}
        />
      </I18nProvider>,
    );
    return { lecteur, modifierMontage };
  };

  it('laisse Espace et Suppr à la timeline', () => {
    const { lecteur, modifierMontage } = poserDeroule(false);
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(lecteur.play).not.toHaveBeenCalled();
    expect(modifierMontage).not.toHaveBeenCalled();
  });

  it('garde ses raccourcis quand la timeline est fermée', () => {
    const { lecteur, modifierMontage } = poserDeroule(true);
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(lecteur.play).toHaveBeenCalledTimes(1);
    expect(modifierMontage).toHaveBeenCalledTimes(1);
  });
});

describe('le panneau de la timeline', () => {
  it('borne sa hauteur pour garder l’image visible', () => {
    expect(borneDock(50, 900)).toBe(DOCK_MIN);
    expect(borneDock(5000, 2000)).toBe(DOCK_MAX);
    // Jamais plus que la place laissée par l'image et les barres (portable de 768 px).
    expect(borneDock(600, 768)).toBe(768 - 480);
    expect(borneDock(400, 1080)).toBe(400);
    expect(borneDock('n’importe quoi', 900)).toBe(DOCK_DEFAUT);
  });

  it('se replie et se rouvre, et le dit', () => {
    const onBasculer = vi.fn();
    const { rerender } = render(
      <I18nProvider><DockTimeline ouvert hauteur={300} onBasculer={onBasculer} onHauteur={() => {}}><p>contenu</p></DockTimeline></I18nProvider>,
    );
    const bouton = screen.getByRole('button', { name: d.dockMasquer });
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('contenu')).toBeInTheDocument();
    fireEvent.click(bouton);
    expect(onBasculer).toHaveBeenCalledTimes(1);
    rerender(
      <I18nProvider><DockTimeline ouvert={false} hauteur={300} onBasculer={onBasculer} onHauteur={() => {}}><p>contenu</p></DockTimeline></I18nProvider>,
    );
    expect(screen.getByRole('button', { name: d.dockAfficher })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('contenu')).toBeNull();
  });

  it('se règle en hauteur au clavier', () => {
    const onHauteur = vi.fn();
    // jsdom : fenêtre de 768 px, donc 288 px au plus.
    render(<I18nProvider><DockTimeline ouvert hauteur={250} onBasculer={() => {}} onHauteur={onHauteur}><p>x</p></DockTimeline></I18nProvider>);
    const poignee = screen.getByRole('separator', { name: d.dockPoignee });
    fireEvent.keyDown(poignee, { key: 'ArrowUp' });
    fireEvent.keyDown(poignee, { key: 'ArrowDown' });
    expect(onHauteur.mock.calls.map((c) => c[0])).toEqual([274, 226]);
  });
});
