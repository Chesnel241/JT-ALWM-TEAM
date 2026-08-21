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
  localStorage.setItem('jt-alwm-lang', 'fr');
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
});
