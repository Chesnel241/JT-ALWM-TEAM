import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../src/api/index.js';
import VoixOffView from '../src/components/VoixOffView.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

const MOCK_COUNTRIES = [
  { id: 'ga', name: 'Gabon', code: 'GA' },
  { id: 'ci', name: 'Côte d\'Ivoire', code: 'CI' },
];

const MOCK_WEEKS = [
  { id: '2026-W34', status: 'active', startDate: '2026-08-18', cutoffAt: '2026-08-23T08:30:00.000Z' }
];

function renderVoixOff(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <VoixOffView
          countries={MOCK_COUNTRIES}
          weeks={MOCK_WEEKS}
          selectedWeek="2026-W34"
          setSelectedWeek={vi.fn()}
          {...props}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('VoixOffView', () => {
  it('renders Studio Voix Off title and selectable countries', () => {
    renderVoixOff();
    expect(screen.getAllByText(/Studio Voix Off/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText('Gabon')[0]).toBeInTheDocument();
  });

  it('selects a country and displays preparation form inputs', () => {
    renderVoixOff();
    const gabonBtn = screen.getAllByText('Gabon')[0].closest('button');
    fireEvent.click(gabonBtn);
    expect(screen.getAllByPlaceholderText(/Élections présidentielles/i)[0]).toBeInTheDocument();
  });

  it('pre-selects country when initialCountryId is passed (montage)', () => {
    renderVoixOff({ initialCountryId: 'ga' });
    expect(screen.getByPlaceholderText(/Élections présidentielles/i)).toBeInTheDocument();
  });

  it('switches to file upload mode (montage)', () => {
    renderVoixOff({ initialCountryId: 'ga' });
    fireEvent.click(screen.getByText('Fichier audio'));
    expect(screen.getByText(/Glissez ou sélectionnez un fichier audio/i)).toBeInTheDocument();
  });

  it('allows switching between reportage subjects (1, 2, 3) (montage)', () => {
    renderVoixOff({ initialCountryId: 'ga' });
    fireEvent.click(screen.getByRole('button', { name: 'Sujet 2' }));
    expect(screen.getByPlaceholderText(/Élections présidentielles/i).value).toBe('Reportage 2');
  });
});

/**
 * Le studio de voix off des journalistes.
 *
 * LE BESOIN : le studio commun était un panneau noir de console, aux
 * libellés techniques écrits en français en dur. Les correspondants ont
 * maintenant un studio clair, en trois étapes, avec un gros bouton rouge,
 * une onde qui suit la voix et un bouton vert pour envoyer.
 */

// Un micro de laboratoire : MediaRecorder et AudioContext réduits à ce que
// le studio appelle.
class FauxEnregistreur {
  constructor() { this.state = 'inactive'; }
  static isTypeSupported(type) { return type === 'audio/webm'; }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3])], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

class FauxContexteAudio {
  constructor() { this.state = 'running'; }
  resume() { return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createAnalyser() {
    return { fftSize: 256, frequencyBinCount: 8, getByteFrequencyData: (tableau) => tableau.fill(90) };
  }
  createMediaStreamSource() { return { connect() {} }; }
}

function installerMicro({ refuse = false } = {}) {
  const piste = { stop: vi.fn() };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: refuse
        ? vi.fn().mockRejectedValue(new Error('NotAllowedError'))
        : vi.fn().mockResolvedValue({ getTracks: () => [piste] }),
    },
  });
  vi.stubGlobal('MediaRecorder', FauxEnregistreur);
  vi.stubGlobal('AudioContext', FauxContexteAudio);
  vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 16));
  vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
  URL.createObjectURL = vi.fn(() => 'blob:voix');
  URL.revokeObjectURL = vi.fn();
}

describe('StudioVoixJournaliste', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('un studio clair, sans console noire ni libellé technique', () => {
    renderVoixOff({ initialCountryId: 'ga', isReporter: true });
    expect(screen.getByRole('heading', { name: 'Enregistrer votre voix off' })).toBeInTheDocument();
    expect(screen.getByText('Gabon')).toBeInTheDocument();
    expect(screen.queryByText(/ENREGISTREUR TV|Direct Micro|Auto-scroll/)).toBeNull();
    expect(document.querySelector('.bg-\\[\\#0b1120\\]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Commencer l’enregistrement' })).toBeEnabled();
  });

  it('choisir « Reportage 2 » le marque et pré-remplit le titre', () => {
    renderVoixOff({ initialCountryId: 'ga', isReporter: true });
    fireEvent.click(screen.getByRole('button', { name: 'Reportage 2' }));
    expect(screen.getByRole('button', { name: 'Reportage 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Titre du reportage')).toHaveValue('Reportage 2');
  });

  it('avec un fichier audio : un grand bouton pour le choisir', () => {
    renderVoixOff({ initialCountryId: 'ga', isReporter: true });
    fireEvent.click(screen.getByRole('button', { name: 'Avec un fichier audio' }));
    expect(screen.getByRole('button', { name: /Choisir un fichier audio/ })).toBeInTheDocument();
  });

  it('sans pays : on choisit d’abord son pays, et le bouton rouge attend', () => {
    renderVoixOff({ isReporter: true });
    expect(screen.getByText('Choisissez votre pays')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commencer l’enregistrement' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Côte d'Ivoire/ }));
    expect(screen.getByRole('button', { name: 'Commencer l’enregistrement' })).toBeEnabled();
  });

  it('micro refusé : le message dit quoi faire, dans la langue de l’écran', async () => {
    installerMicro({ refuse: true });
    renderVoixOff({ initialCountryId: 'ga', isReporter: true });
    fireEvent.click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    // Le message reste sous le bouton rouge, et propose l'autre chemin.
    expect(await screen.findByRole('alert')).toHaveTextContent(/Autorisez-le dans les réglages de votre navigateur/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Avec un fichier audio' }).at(-1));
    expect(screen.getByRole('button', { name: /Choisir un fichier audio/ })).toBeInTheDocument();
  });

  it('enregistrer, terminer, réécouter, envoyer : la voix arrive chez le monteur', async () => {
    installerMicro();
    const envoi = vi.spyOn(api, 'uploadVoiceover').mockResolvedValue({ ok: true });
    renderVoixOff({ initialCountryId: 'ga', isReporter: true });

    fireEvent.click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    expect(await screen.findByText('Enregistrement en cours')).toBeInTheDocument();
    // L'onde suit la voix : le niveau est mesuré même sans le canevas du
    // studio commun.
    await waitFor(() => {
      const barre = document.querySelector('.jr-onde-barre');
      expect(Number(barre.style.getPropertyValue('--h'))).toBeGreaterThan(0.12);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByText('En pause')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Terminer' })[0]);
    expect(await screen.findByText(/Votre voix est prête/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer au monteur' }));
    await waitFor(() => expect(envoi).toHaveBeenCalled());
    const [semaine, pays, formulaire] = envoi.mock.calls[0];
    expect([semaine, pays]).toEqual(['2026-W34', 'ga']);
    expect(formulaire.get('reportageTitle')).toBe('Reportage 1');
    expect(await screen.findByRole('status')).toHaveTextContent('Votre voix off est arrivée chez le monteur.');
  });

  it('parle anglais', () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    renderVoixOff({ initialCountryId: 'ga', isReporter: true });
    expect(screen.getByRole('heading', { name: 'Record your voice-over' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });
});
