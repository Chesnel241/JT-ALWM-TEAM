import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import DashboardView from '../src/components/DashboardView.jsx';
import ToastContainer from '../src/components/Toast.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import { api } from '../src/api/index.js';

/**
 * La revue des rushes en un geste.
 *
 * L'INCIDENT : valider un rush coûtait cinq clics et une fenêtre qui
 * s'ouvrait sur « Refusé » ; rien ne disait ce qui restait à revoir ; et
 * « Nouveau fichier ! » s'affichait trois fois par vidéo, sans dire d'où.
 */

const ecouteurs = {};
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (evt, fn) => { ecouteurs[evt] = fn; },
    emit: () => {},
    disconnect: () => {},
  }),
}));

const RUSHS = [
  { id: 'a1111111-1111-4111-8111-111111111111', filename: 'marche.mp4', name: 'marche.mp4', type: 'video', sujetId: 's1', uploadedAt: '2026-11-04T10:00:00Z' },
  { id: 'b2222222-2222-4222-8222-222222222222', filename: 'vendeuse.mp4', name: 'vendeuse.mp4', type: 'video', sujetId: 's1', uploadedAt: '2026-11-05T10:00:00Z' },
  { id: 'c3333333-3333-4333-8333-333333333333', filename: 'plan.jpg', name: 'plan.jpg', type: 'image', sujetId: 's1', status: 'approved', uploadedAt: '2026-11-03T10:00:00Z' },
];

vi.mock('../src/api/index.js', () => ({
  api: {
    getDashboard: vi.fn(),
    getRelances: vi.fn().mockResolvedValue([]),
    getDescriptionsRubriques: vi.fn().mockResolvedValue([]),
    getRubrique: vi.fn().mockResolvedValue({ rubrique: null, champs: {} }),
    getDemandesDelai: vi.fn().mockResolvedValue([]),
    getDeliveries: vi.fn().mockResolvedValue([]),
    getTimelineWorkspace: vi.fn().mockResolvedValue({ clips: [], overlays: [], branding: {} }),
    getEditorialReport: vi.fn().mockResolvedValue(null),
    saveTimelineWorkspace: vi.fn().mockResolvedValue({ ok: true }),
    checkAdminPassword: vi.fn().mockResolvedValue({ ok: true }),
    getSubscriptions: vi.fn().mockResolvedValue([]),
    updateFileStatus: vi.fn().mockResolvedValue({ ok: true }),
    uploadDelivery: vi.fn().mockResolvedValue({ id: 'jt', name: 'JT_S45.mp4' }),
    getWeekActiveJob: vi.fn().mockResolvedValue({ job: null }),
    getSujets: vi.fn().mockResolvedValue([{ id: 's1', countryId: 'cm', titre: 'Marché de Mokolo', etat: 'recu' }]),
  },
  API_BASE: 'http://localhost:3010',
  getClientId: vi.fn().mockReturnValue('test-client-id'),
}));

const SEMAINES = [{ id: '2026-w45', name: 'Semaine 45', status: 'active', startDate: '2026-11-01', cutoffAt: '2026-11-08T08:30:00.000Z' }];
const PAYS = [{ id: 'cm', name: 'Cameroun', code: 'CM' }, { id: 'sn', name: 'Sénégal', code: 'SN' }];

async function ouvrir() {
  render(
    <I18nProvider>
      <ToastProvider>
        <DashboardView weeks={SEMAINES} selectedWeek="2026-w45" setSelectedWeek={() => {}} countries={PAYS} isActive isDesktopEditorAvailable />
        <ToastContainer />
      </ToastProvider>
    </I18nProvider>,
  );
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: /Déverrouiller/i }));
  await screen.findAllByText('vendeuse.mp4');
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  localStorage.setItem('jt-bin-2026-w45', 'cm');
  vi.clearAllMocks();
  api.getDashboard.mockResolvedValue({ cm: RUSHS.map((r) => ({ ...r })) });
});

describe('la revue des rushes', () => {
  it('marque « À revoir » ce qui est neuf, et le compte dans la colonne', async () => {
    await ouvrir();
    expect(screen.getAllByText('À revoir').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('2 à revoir').length).toBeGreaterThan(0);
  });

  it('« Valider » en un clic, sans fenêtre ; « Annuler » rétablit', async () => {
    await ouvrir();
    const carte = screen.getAllByText('marche.mp4')[0].closest('.group');
    fireEvent.click(within(carte).getByRole('button', { name: /^Valider$/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(api.updateFileStatus).toHaveBeenCalledWith('2026-w45', RUSHS[0].id, 'approved', '', 'secret'));

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(api.updateFileStatus).toHaveBeenLastCalledWith('2026-w45', RUSHS[0].id, 'pending', '', 'secret'));
  });

  it('« Refuser » ouvre la fenêtre sur le refus ; un rush neuf ne s’y ouvre jamais refusé par défaut', async () => {
    await ouvrir();
    const carte = screen.getAllByText('marche.mp4')[0].closest('.group');
    fireEvent.click(within(carte).getByRole('button', { name: /^Refuser$/ }));
    expect(await screen.findByText('Refuser / Commenter le rush')).toBeInTheDocument();
    expect(api.updateFileStatus).not.toHaveBeenCalled();
  });

  it('le menu « Valider le rush » valide en un geste, sans fenêtre', async () => {
    await ouvrir();
    const carte = screen.getAllByText('marche.mp4')[0].closest('.group');
    fireEvent.click(within(carte).getByTitle('Options'));
    fireEvent.click(await screen.findByText('Valider le rush'));
    await waitFor(() => expect(api.updateFileStatus).toHaveBeenCalledWith('2026-w45', RUSHS[0].id, 'approved', '', 'secret'));
    expect(screen.queryByText('Refuser / Commenter le rush')).toBeNull();
  });

  it('« Tout valider » passe d’un geste les rushs à revoir d’un reportage', async () => {
    await ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Tout valider (2)' }));
    await waitFor(() => expect(api.updateFileStatus).toHaveBeenCalledTimes(2));
    expect(api.updateFileStatus.mock.calls.map((c) => c[2])).toEqual(['approved', 'approved']);
    expect(await screen.findByText('2 fichiers validés')).toBeInTheDocument();
  });

  it('montre le plus récent d’abord', async () => {
    await ouvrir();
    const noms = screen.getAllByText(/^(marche|vendeuse)\.mp4$/).map((n) => n.textContent);
    expect(noms.indexOf('vendeuse.mp4')).toBeLessThan(noms.indexOf('marche.mp4'));
  });

  it('la visionneuse passe au suivant et valide dans son pied', async () => {
    await ouvrir();
    const carte = screen.getAllByText('vendeuse.mp4')[0].closest('.group');
    fireEvent.click(carte.firstElementChild);
    expect(await screen.findByText('1 sur 3')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(await screen.findByText('2 sur 3')).toBeInTheDocument();
    fireEvent.click(within(screen.getByText('2 sur 3').closest('div').parentElement).getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(api.updateFileStatus).toHaveBeenCalledWith('2026-w45', RUSHS[0].id, 'approved', '', 'secret'));
  });
});

describe('« Nouveau fichier »', () => {
  it('n’est annoncé que pour un vrai dépôt, avec le pays, regroupé', async () => {
    await ouvrir();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => {
      ecouteurs.upload_update({ weekId: '2026-w45', countryId: 'cm' }); // durée mesurée
      ecouteurs.upload_update({ weekId: '2026-w45', countryId: 'cm', motif: 'depot' });
      ecouteurs.upload_update({ weekId: '2026-w45', countryId: 'cm', motif: 'depot' });
    });
    act(() => { vi.advanceTimersByTime(3000); });
    vi.useRealTimers();
    expect(await screen.findByText('2 nouveaux fichiers — Cameroun')).toBeInTheDocument();
    expect(screen.queryByText('Nouveau fichier !')).toBeNull();
  });
});

describe('la fenêtre de retour', () => {
  it('ouverte sur un rush neuf, elle propose de valider — jamais « Refusé » par défaut', async () => {
    const { default: FeedbackModal } = await import('../src/components/FeedbackModal.jsx');
    render(
      <I18nProvider>
        <ToastProvider>
          <FeedbackModal isOpen onClose={() => {}} file={{ id: 'x', name: 'marche.mp4', status: 'pending' }} countryName="Cameroun" countryId="cm" weekId="2026-w45" />
        </ToastProvider>
      </I18nProvider>,
    );
    expect(screen.getByText('Valider le rush')).toBeInTheDocument();
    expect(screen.queryByText('Refuser / Commenter le rush')).toBeNull();
  });
});

describe('relances et publication', () => {
  it('« Ajouter à la timeline » laisse le monteur dans le chutier', async () => {
    // Chaque ajout le projetait dans le studio, d'où il fallait revenir.
    await ouvrir();
    const carte = screen.getAllByText('vendeuse.mp4')[0].closest('.group');
    fireEvent.click(within(carte).getByRole('button', { name: /Ajouter à la timeline/ }));
    expect(await screen.findByText('« vendeuse.mp4 » ajouté à la timeline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir le studio' })).toBeInTheDocument();
    expect(screen.getAllByText('marche.mp4').length).toBeGreaterThan(0);
  });

  it('demande avant de publier le JT à tous les correspondants', async () => {
    localStorage.setItem('jt-bin-2026-w45', 'delivery');
    render(
      <I18nProvider>
        <ToastProvider>
          <DashboardView weeks={SEMAINES} selectedWeek="2026-w45" setSelectedWeek={() => {}} countries={PAYS} isActive isDesktopEditorAvailable />
        </ToastProvider>
      </I18nProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Déverrouiller/i }));
    fireEvent.click((await screen.findAllByText(/Livraison JT/i))[0]);
    const entree = await waitFor(() => {
      const el = document.querySelector('input[type="file"][accept*="video"]') || document.querySelector('input[type="file"]');
      if (!el) throw new Error('pas encore');
      return el;
    });
    fireEvent.change(entree, { target: { files: [new File(['x'], 'JT_S45.mp4', { type: 'video/mp4' })] } });
    expect(await screen.findByText('Publier le JT ?')).toBeInTheDocument();
    expect(api.uploadDelivery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Publier et prévenir' }));
    await waitFor(() => expect(api.uploadDelivery).toHaveBeenCalled());
  });
});

describe('sur ordinateur aussi', () => {
  it('filtre par type et propose le lien du correspondant', async () => {
    // Les deux n'existaient que sur téléphone.
    await ouvrir();
    const filtres = screen.getAllByRole('group', { name: 'Filtrer par type' })[0];
    fireEvent.click(within(filtres).getByRole('button', { name: 'Images' }));
    expect(screen.queryAllByText('marche.mp4')).toHaveLength(0);
    expect(screen.getAllByText('plan.jpg').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Lien du correspondant/ }).length).toBeGreaterThan(0);
  });
});
