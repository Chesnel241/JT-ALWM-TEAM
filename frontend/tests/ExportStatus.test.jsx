import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportStatus, { formaterNiveau } from '../src/components/editor/ExportStatus.jsx';
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

// LE CONSTAT : aucune étape ne réglait le niveau du son, et personne ne pouvait
// savoir si un master était diffusable. Le moteur le mesure maintenant après
// correction : le studio le dit.
describe('le niveau du son du master', () => {
  it('écrit un niveau avec le vrai signe moins et la virgule', () => {
    expect(formaterNiveau(-23.04)).toBe('\u221223,0');
    expect(formaterNiveau(0.5)).toBe('0,5');
    expect(formaterNiveau('rien')).toBe('');
  });

  it('dit que le master est à la norme de diffusion', () => {
    render(<I18nProvider><ExportStatus urlVideo="/x.mp4" son={{ apres: -23, crete: -1.4, norme: true }} /></I18nProvider>);
    expect(screen.getByText(/Son : \u221223,0 LUFS · crête \u22121,4 dBTP — à la norme de diffusion/)).toBeInTheDocument();
  });

  it('prévient quand le master sort de la norme', () => {
    render(<I18nProvider><ExportStatus urlVideo="/x.mp4" son={{ apres: -19.5, crete: null, norme: false }} /></I18nProvider>);
    expect(screen.getByText(/hors de la norme de diffusion, à réécouter/)).toBeInTheDocument();
  });

  it('ne dit rien du son quand le moteur ne l’a pas mesuré', () => {
    render(<I18nProvider><ExportStatus urlVideo="/x.mp4" /></I18nProvider>);
    expect(screen.queryByText(/LUFS/)).toBeNull();
  });
});
