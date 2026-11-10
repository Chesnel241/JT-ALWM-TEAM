import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportStatus from '../src/components/editor/ExportStatus.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { resteRendu, chronometre } from '../src/lib/envoi.js';

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

// LE BESOIN : un master demande des heures. « 37 % » seul ne dit pas s'il faut
// attendre dix minutes ou revenir demain ; et le chronomètre affichait
// « 125:03 » après deux heures.
describe('le temps restant du rendu', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('ne promet rien avant d’avoir vu assez d’avancement', () => {
    const depart = { t: 0, pourcent: 10 };
    expect(resteRendu(depart, 30_000, 20)).toBeNull();   // moins d'une minute
    expect(resteRendu(depart, 300_000, 11)).toBeNull();  // un seul point gagné
    expect(resteRendu(null, 300_000, 50)).toBeNull();
  });

  it('prolonge le rythme observé jusqu’à 100 %', () => {
    // 10 points en 10 minutes : il en reste 80, donc 80 minutes.
    expect(resteRendu({ t: 0, pourcent: 10 }, 600_000, 20)).toBe(80 * 60);
  });

  it('le chronomètre passe aux heures', () => {
    expect(chronometre(247)).toBe('4:07');
    expect(chronometre(2 * 3600 + 4 * 60 + 7)).toBe('2:04:07');
  });

  it('la bannière annonce le temps restant et qu’on peut fermer la page', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    const vue = (p) => <I18nProvider><ExportStatus enCours progression={p} phase="encoding" secondes={0} /></I18nProvider>;
    const { rerender } = render(vue(10));
    expect(screen.queryByText(/encore/)).toBeNull();
    vi.setSystemTime(new Date('2026-11-10T10:10:00Z'));
    rerender(vue(20));
    expect(screen.getByText('encore environ 1 h 20')).toBeInTheDocument();
    expect(screen.getByText(/vous pouvez fermer cette page/)).toBeInTheDocument();
  });
});
