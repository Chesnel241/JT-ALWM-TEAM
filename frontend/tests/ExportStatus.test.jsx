import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportStatus from '../src/components/editor/ExportStatus.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

/**
 * La carte d'état du rendu, posée sur le lecteur du studio.
 *
 * Collée en bas du lecteur, elle recouvrait lecture, son et plein écran : on
 * ne pouvait plus relire l'aperçu pendant un rendu de dix-sept minutes, ni
 * après, puisque « Master assemblé » ne se fermait pas.
 */

const poser = (props) => render(
  <I18nProvider>
    <ExportStatus semaine="2026-w38" {...props} />
  </I18nProvider>
);

const carte = (container) => container.querySelector('.absolute');

// jsdom annonce une langue anglaise : on fixe le français, lu par le studio.
beforeEach(() => { localStorage.setItem('jt-alwm-lang', 'fr'); });

describe('la carte d’état du rendu', () => {
  it('se pose en haut du lecteur, loin de ses commandes', () => {
    const { container } = poser({ enCours: true, progression: 12, phase: 'encoding', secondes: 42 });
    expect(carte(container).className).toMatch(/\btop-4\b/);
    expect(carte(container).className).not.toMatch(/\bbottom-4\b/);
  });

  it('se ferme une fois le master prêt', () => {
    const { container } = poser({ urlVideo: '/uploads/exports/export.mp4' });
    expect(screen.getByText('Master assemblé')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(carte(container)).toBeNull();
  });

  it('se ferme aussi après un échec', () => {
    const { container } = poser({ erreur: 'Worker injoignable' });
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(carte(container)).toBeNull();
  });

  it('revient au rendu suivant, même masquée', () => {
    const { container, rerender } = poser({ urlVideo: '/uploads/exports/a.mp4' });
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(carte(container)).toBeNull();
    rerender(
      <I18nProvider>
        <ExportStatus semaine="2026-w38" enCours progression={0} phase="downloading" secondes={0} />
      </I18nProvider>
    );
    expect(carte(container)).not.toBeNull();
  });

  it('ne se masque pas pendant l’assemblage', () => {
    poser({ enCours: true, progression: 40, phase: 'encoding', secondes: 300 });
    expect(screen.queryByRole('button', { name: 'Masquer' })).toBeNull();
  });
});
