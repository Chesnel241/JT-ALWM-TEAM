import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import JTPretJournaliste from '../src/components/JTPretJournaliste.jsx';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('le JT prêt, côté correspondants', () => {
  it('dit la taille du JT sur le bouton, et conseille le Wi-Fi', () => {
    // 450 Mo sur une 4G payée au mégaoctet : c'est une décision qu'on prend
    // avant de toucher le bouton, pas après.
    render(
      <I18nProvider>
        <JTPretJournaliste
          weeks={[{ id: '2026-w45', status: 'active' }]}
          selectedWeek="2026-w45"
          setSelectedWeek={vi.fn()}
          livraisons={[{ id: 'j1', name: 'JT_S45.mp4', filename: 'jt-s45.mp4', type: 'video', size: '450.0 MB', uploadedAt: '2026-11-06T10:00:00.000Z' }]}
          chargement={false}
          onRegarder={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Télécharger le JT (450.0 MB)')).toBeInTheDocument();
    expect(screen.getByText('De préférence en Wi-Fi')).toBeInTheDocument();
  });
});
