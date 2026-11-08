import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardView from '../src/components/DashboardView.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import { api } from '../src/api/index.js';
import ToastContainer from '../src/components/Toast.jsx';

vi.mock('../src/api/index.js', () => ({
  api: {
    getDashboard: vi.fn().mockResolvedValue({ ga: [{ id: '1', filename: 'clip.mp4', name: 'clip.mp4', type: 'video' }] }),
    // Le panneau de relance vit désormais en haut du tableau de bord : sans
    // ces deux doublures, il fait tomber tout l'écran au montage.
    getRelances: vi.fn().mockResolvedValue([]),
    // Le tableau de bord nomme désormais ses tiroirs avec les noms que le
    // serveur donne aux rubriques, et lit leur contenu dans le chutier.
    getDescriptionsRubriques: vi.fn().mockResolvedValue([]),
    getRubrique: vi.fn().mockResolvedValue({ rubrique: null, champs: {} }),
    getDemandesDelai: vi.fn().mockResolvedValue([]),
    getDeliveries: vi.fn().mockResolvedValue([]),
    getTimeline: vi.fn().mockResolvedValue({ clips: [], overlays: [], branding: {} }),
    getTimelineWorkspace: vi.fn().mockResolvedValue({ clips: [], overlays: [], branding: {} }),
    getEditorialReport: vi.fn().mockResolvedValue(null),
    saveTimelineWorkspace: vi.fn().mockResolvedValue({ ok: true }),
    checkAdminPassword: vi.fn().mockResolvedValue({ ok: true }),
    getSubscriptions: vi.fn().mockResolvedValue([{ countryId: 'ga', phone: '+24107000000' }]),
    updateFileStatus: vi.fn().mockResolvedValue({ ok: true }),
    setContact: vi.fn().mockImplementation((countryId, phone) => Promise.resolve({ countryId, phone })),
    getWeekActiveJob: vi.fn().mockResolvedValue({ job: null }),
    getSujets: vi.fn().mockResolvedValue([
      { id: 's1', countryId: 'ga', titre: 'Marché de Libreville', etat: 'recu', nbPieces: 1 },
    ]),
  },
  API_BASE: 'http://localhost:3010',
  getClientId: vi.fn().mockReturnValue('test-client-id'),
}));

const mockWeeks = [
  { id: '2026-w34', name: 'Semaine 34', status: 'active', startDate: '2026-08-17', endDate: '2026-08-23', cutoffAt: '2026-08-23T08:30:00.000Z' },
];

const mockCountries = [
  { id: 'ga', name: 'Gabon', code: 'GA', flag: '🇬🇦' },
  { id: 'ci', name: 'Côte d\'Ivoire', code: 'CI', flag: '🇨🇮' },
  { id: 'tj', name: 'Titres & Rappels', code: 'TJ' },
];

function renderDashboard(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <DashboardView
          weeks={mockWeeks}
          selectedWeek="2026-w34"
          setSelectedWeek={() => {}}
          countries={mockCountries}
          isActive={true}
          isDesktopEditorAvailable={true}
          {...props}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

describe('DashboardView Component Initialization', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    localStorage.setItem('jt-bin-2026-w34', 'ga');
  });

  it('renders without throwing ReferenceError or hoisting exceptions', () => {
    expect(() => renderDashboard()).not.toThrow();
  });

  it('mounts and displays unlocked admin or login form properly', async () => {
    renderDashboard();
    // Verify it renders either the unlock screen or dashboard without throwing ReferenceError
    const unlockBtn = screen.getByRole('button', { name: /Déverrouiller/i });
    expect(unlockBtn).toBeInTheDocument();
    
    // Simulate unlocking
    const input = screen.getByPlaceholderText('••••••••');
    fireEvent.change(input, { target: { value: 'secret' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Chutiers \(Rushs\)/i).length).toBeGreaterThan(0);
    });
  });
});

async function deverrouiller() {
  renderDashboard();
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: /Déverrouiller/i }));
  await waitFor(() => expect(screen.getAllByText(/Chutiers \(Rushs\)/i).length).toBeGreaterThan(0));
}

describe('le numéro WhatsApp d’un pays qui n’en a pas', () => {
  // L'INCIDENT : « Aucun WhatsApp (+ Ajouter) » ouvrait la fenêtre de refus
  // d'un fichier avec un faux fichier `id: 'general'`. Le serveur répondait
  // 400, et le numéro n'était jamais enregistré.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    localStorage.setItem('jt-bin-2026-w34', 'ci');
    vi.clearAllMocks();
  });

  it('« + Ajouter » enregistre le numéro dans le carnet, sans toucher aux fichiers', async () => {
    api.getDashboard.mockResolvedValue({
      ga: [{ id: '1', filename: 'clip.mp4', name: 'clip.mp4', type: 'video' }],
      ci: [{ id: '2', filename: 'abidjan.mp4', name: 'abidjan.mp4', type: 'video' }],
    });
    await deverrouiller();
    fireEvent.click(screen.getAllByRole('button', { name: /Aucun WhatsApp/ })[0]);

    const boite = await screen.findByRole('dialog', { name: /Numéro WhatsApp — Côte d'Ivoire/ });
    expect(boite).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Numéro WhatsApp'), { target: { value: '+225 07 07 07 07 07' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(api.setContact).toHaveBeenCalledWith('ci', '+2250707070707', 'secret'));
    expect(api.updateFileStatus).not.toHaveBeenCalled();
    // La pastille « Écrire » remplace « + Ajouter » sans recharger la page.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Numéro WhatsApp/ })).not.toBeInTheDocument());
    expect(screen.getAllByText(/2250707070707/).length).toBeGreaterThan(0);
    api.getDashboard.mockResolvedValue({ ga: [{ id: '1', filename: 'clip.mp4', name: 'clip.mp4', type: 'video' }] });
  });
});

describe('la confirmation de suppression', () => {
  // L'INCIDENT : « Êtes-vous sûr de vouloir supprimer «  » ? » — l'écran
  // lisait `.name` alors que l'état garde `fileName`.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    localStorage.setItem('jt-bin-2026-w34', 'ga');
  });

  it('nomme le fichier qu’on va supprimer', async () => {
    await deverrouiller();
    fireEvent.click((await screen.findAllByTitle('Options'))[0]);
    fireEvent.click(screen.getByText('Supprimer le fichier'));
    expect(await screen.findByText(/supprimer « clip\.mp4 »/)).toBeInTheDocument();
  });
});

describe('le changement de semaine', () => {
  // L'INCIDENT : en passant d'une semaine à l'autre, la grille gardait les
  // fichiers de la précédente, boutons actifs, le temps que la nouvelle
  // arrive. On pouvait valider ou supprimer sans savoir de quelle semaine.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    localStorage.setItem('jt-bin-2026-w34', 'ga');
  });

  it('n’affiche plus les fichiers de la semaine précédente pendant le chargement', async () => {
    const semaines = [...mockWeeks, { ...mockWeeks[0], id: '2026-w35', name: 'Semaine 35' }];
    const props = { weeks: semaines, setSelectedWeek: () => {}, countries: mockCountries, isActive: true, isDesktopEditorAvailable: true };
    const vue = (semaine) => (
      <I18nProvider>
        <ToastProvider>
          <DashboardView {...props} selectedWeek={semaine} />
        </ToastProvider>
      </I18nProvider>
    );
    const { rerender } = render(vue('2026-w34'));
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Déverrouiller/i }));
    expect((await screen.findAllByText('clip.mp4')).length).toBeGreaterThan(0);

    // La semaine 35 ne répond pas encore.
    api.getDashboard.mockImplementation(() => new Promise(() => {}));
    rerender(vue('2026-w35'));
    await waitFor(() => expect(screen.queryAllByText('clip.mp4')).toHaveLength(0));
    api.getDashboard.mockResolvedValue({ ga: [{ id: '1', filename: 'clip.mp4', name: 'clip.mp4', type: 'video' }] });
  });
});

describe('le conflit de sauvegarde du studio', () => {
  // Le studio est réservé aux écrans larges.
  beforeEach(() => { window.innerWidth = 1600; });
  // L'INCIDENT : quand un collègue avait sauvegardé entre-temps (409), notre
  // version était jetée avec tout l'historique. Elle devient l'étape
  // précédente, et le message offre de la reprendre.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    localStorage.setItem('jt-bin-2026-w34', 'studio');
  });

  it('garde notre version, que « Reprendre ma version » rétablit', async () => {
    const plan = (n) => ({ instanceId: `c${n}`, name: `rush-${n}.mp4`, filename: `rush-${n}.mp4`, durationSec: 5, overlays: [] });
    api.getTimelineWorkspace.mockResolvedValue({ workspace: { clips: [plan(1), plan(2)], overlays: [], branding: {}, revision: 1 } });
    const conflit = Object.assign(new Error('conflit'), {
      status: 409,
      code: 'TIMELINE_CONFLICT',
      body: { workspace: { clips: [plan(9)], overlays: [], branding: {}, revision: 2 } },
    });
    api.saveTimelineWorkspace.mockRejectedValueOnce(conflit).mockResolvedValue({ workspace: { revision: 3 } });

    // Les messages s'affichent dans le conteneur de l'application.
    render(
      <I18nProvider>
        <ToastProvider>
          <DashboardView weeks={mockWeeks} selectedWeek="2026-w34" setSelectedWeek={() => {}} countries={mockCountries} isActive isDesktopEditorAvailable />
          <ToastContainer />
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Déverrouiller/i }));
    const supprimer = await screen.findByRole('button', { name: /^Supprimer/i }, { timeout: 3000 });
    fireEvent.click(supprimer);

    const reprendre = await screen.findByRole('button', { name: 'Reprendre ma version' }, { timeout: 3000 });
    fireEvent.click(reprendre);

    // Notre version (un seul plan, le n° 2) repart au serveur, sur la révision du collègue.
    await waitFor(() => {
      const dernier = api.saveTimelineWorkspace.mock.calls.at(-1);
      expect(dernier[1].clips.map((c) => c.instanceId)).toEqual(['c2']);
      expect(dernier[1].baseRevision).toBe(2);
    }, { timeout: 3000 });

    api.getTimelineWorkspace.mockResolvedValue({ clips: [], overlays: [], branding: {} });
    api.saveTimelineWorkspace.mockResolvedValue({ ok: true });
  });
});

describe('le studio dans une fenêtre qui rétrécit', () => {
  // L'INCIDENT : une fenêtre posée sur la moitié de l'écran faisait
  // démonter le studio d'un coup — retour aux chutiers, réglages perdus.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jt-alwm-lang', 'fr');
    localStorage.setItem('jt-bin-2026-w34', 'studio');
  });

  it('garde le studio monté et demande d’agrandir la fenêtre', async () => {
    const plan = (n) => ({ instanceId: `c${n}`, name: `rush-${n}.mp4`, filename: `rush-${n}.mp4`, durationSec: 5, overlays: [] });
    api.getTimelineWorkspace.mockResolvedValue({ workspace: { clips: [plan(1)], overlays: [], branding: {}, revision: 1 } });
    const vue = (large) => (
      <I18nProvider>
        <ToastProvider>
          <DashboardView weeks={mockWeeks} selectedWeek="2026-w34" setSelectedWeek={() => {}} countries={mockCountries} isActive isDesktopEditorAvailable={large} />
        </ToastProvider>
      </I18nProvider>
    );
    const { rerender } = render(vue(true));
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Déverrouiller/i }));
    await screen.findByRole('button', { name: /^Supprimer/i }, { timeout: 3000 });

    rerender(vue(false));
    expect(await screen.findByText('Agrandissez la fenêtre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Supprimer/i })).toBeInTheDocument();

    rerender(vue(true));
    await waitFor(() => expect(screen.queryByText('Agrandissez la fenêtre')).toBeNull());
    api.getTimelineWorkspace.mockResolvedValue({ clips: [], overlays: [], branding: {} });
  });
});
