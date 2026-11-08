import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportStatus from '../src/components/editor/ExportStatus.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); });

describe('la bannière d’export', () => {
  // L'INCIDENT : posée en bas du lecteur, elle couvrait ses commandes
  // pendant tout le rendu, sans moyen de l'écarter.
  it('se replie en une pastille, et se rouvre', () => {
    render(<I18nProvider><ExportStatus enCours progression={42} phase="encoding" secondes={10} /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Réduire' }));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /42 %/ }));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
