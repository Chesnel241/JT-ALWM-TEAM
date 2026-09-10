import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeliveryView from '../src/components/DeliveryView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

const MOCK_WEEKS = [
  { id: '2026-W34', status: 'active', startDate: '2026-08-18' }
];

const MOCK_DELIVERIES = [
  { id: 'deliv-1', filename: 'JT_ALWM_2026_W34.mp4', name: 'JT_ALWM_2026_W34.mp4', size: '480 MB', type: 'video', uploadedAt: new Date().toISOString() }
];

function renderDelivery(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <DeliveryView
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
  sessionStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  // Les espions survivent d'un test à l'autre : on repart d'un compteur
  // d'appels vierge pour pouvoir affirmer qu'un appel n'a PAS eu lieu.
  vi.clearAllMocks();
  vi.spyOn(api, 'getDeliveries').mockResolvedValue(MOCK_DELIVERIES);
  vi.spyOn(api, 'getSubscriptions').mockResolvedValue([{ countryId: 'ga', phone: '+24100000000' }]);
});

describe('DeliveryView', () => {
  it('renders delivery view with title and week selector', async () => {
    renderDelivery();
    expect(await screen.findByText(/Fichiers JT Prêts/i)).toBeInTheDocument();
  });

  it('renders video cards and allows preview modal to open', async () => {
    renderDelivery();
    const videoTitles = await screen.findAllByText('JT_ALWM_2026_W34.mp4');
    expect(videoTitles.length).toBeGreaterThan(0);

    const watchBtn = screen.getByText('Regarder');
    expect(watchBtn).toBeInTheDocument();
    fireEvent.click(watchBtn);

    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // Close button
  });

  it('affiche le bloc de notification WhatsApp pour l\'équipe montage', async () => {
    sessionStorage.setItem('jt-admin-pass', 'secret');
    renderDelivery();
    expect(await screen.findAllByText(/GA/)).not.toHaveLength(0);
    expect(api.getSubscriptions).toHaveBeenCalledWith('2026-W34', 'secret');
  });

  it('n\'interroge pas la liste des abonnés sans session admin', async () => {
    renderDelivery();
    await screen.findAllByText('JT_ALWM_2026_W34.mp4');
    // Route réservée à l'admin : sans mot de passe en session, l'appel
    // ne partirait que pour récolter un 403.
    expect(api.getSubscriptions).not.toHaveBeenCalled();
  });

  it('masque le bloc de notification et les numéros côté journalistes', async () => {
    renderDelivery({ audience: 'reporter' });
    await screen.findAllByText('JT_ALWM_2026_W34.mp4');
    expect(screen.queryByText(/\+24100000000/)).not.toBeInTheDocument();
    expect(api.getSubscriptions).not.toHaveBeenCalled();
    // Le téléchargement, lui, reste disponible.
    expect(screen.getAllByText('Télécharger').length).toBeGreaterThan(0);
  });

  it('dit au journaliste d\'attendre quand le JT n\'est pas publié', async () => {
    api.getDeliveries.mockResolvedValue([]);
    renderDelivery({ audience: 'reporter' });
    expect(await screen.findAllByText(/pas encore publié/i)).not.toHaveLength(0);
    expect(screen.queryByText(/peut déposer le rendu final/i)).not.toBeInTheDocument();
  });

  it('garde la consigne de publication côté montage', async () => {
    api.getDeliveries.mockResolvedValue([]);
    renderDelivery();
    expect(await screen.findAllByText(/peut déposer le rendu final/i)).not.toHaveLength(0);
  });
});
