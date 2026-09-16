import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InspecteurClip, { dureeLisible } from '../src/components/editor/InspecteurClip.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

/**
 * L'inspecteur au repos.
 *
 * Il affichait « Aucun clip sélectionné » pendant qu'un clip l'était dans la
 * timeline, surligné et avec sa barre d'outils.
 */

beforeEach(() => { localStorage.setItem('jt-alwm-lang', 'fr'); });

const poser = (props) => render(
  <I18nProvider>
    <InspecteurClip {...props} />
  </I18nProvider>
);

const clip = {
  instanceId: 'c1',
  name: 'Assemblage_JT_2026-w23.mp4',
  inPoint: 4,
  outPoint: 83.4,
  durationSec: 143,
  overlays: [{ id: 'o1' }],
  subtitles: [],
};

describe('l’inspecteur au repos', () => {
  it('dit qu’aucun clip n’est sélectionné quand c’est vrai', () => {
    poser({ clip: null });
    expect(screen.getByText('Aucun clip sélectionné')).toBeTruthy();
  });

  it('montre le clip sélectionné et sa plage', () => {
    poser({ clip });
    expect(screen.queryByText('Aucun clip sélectionné')).toBeNull();
    expect(screen.getByText('Assemblage_JT_2026-w23.mp4')).toBeTruthy();
    expect(screen.getByText('0:04.0')).toBeTruthy();
    expect(screen.getByText('1:23.4')).toBeTruthy();
    expect(screen.getByText('1:19.4')).toBeTruthy();
  });

  it('ouvre les réglages du clip', () => {
    const onRogner = vi.fn();
    const onHabiller = vi.fn();
    const onSousTitrer = vi.fn();
    poser({ clip, onRogner, onHabiller, onSousTitrer });
    fireEvent.click(screen.getByRole('button', { name: /Rognage précis/ }));
    fireEvent.click(screen.getByRole('button', { name: /Habillage du clip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sous-titres/ }));
    expect(onRogner).toHaveBeenCalledWith(clip);
    expect(onHabiller).toHaveBeenCalledWith(clip);
    expect(onSousTitrer).toHaveBeenCalledWith(clip);
  });
});

describe('dureeLisible', () => {
  it('écrit minutes, secondes et dixièmes', () => {
    expect(dureeLisible(0)).toBe('0:00.0');
    expect(dureeLisible(9.96)).toBe('0:10.0');
    expect(dureeLisible(143.04)).toBe('2:23.0');
    expect(dureeLisible(59.96)).toBe('1:00.0');
    expect(dureeLisible(-3)).toBe('0:00.0');
  });
});
