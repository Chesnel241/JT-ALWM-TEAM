import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardView from '../src/components/DashboardView.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

vi.mock('../src/api/index.js', () => ({
  api: {
    getDashboard: vi.fn().mockResolvedValue({ ga: [{ id: '1', filename: 'clip.mp4', name: 'clip.mp4', type: 'video' }] }),
    // Le panneau de relance vit désormais en haut du tableau de bord : sans
    // ces deux doublures, il fait tomber tout l'écran au montage.
    getRelances: vi.fn().mockResolvedValue([]),
    getDemandesDelai: vi.fn().mockResolvedValue([]),
    getDeliveries: vi.fn().mockResolvedValue([]),
    getTimeline: vi.fn().mockResolvedValue({ clips: [], overlays: [], branding: {} }),
    getTimelineWorkspace: vi.fn().mockResolvedValue({ clips: [], overlays: [], branding: {} }),
    getEditorialReport: vi.fn().mockResolvedValue(null),
    saveTimelineWorkspace: vi.fn().mockResolvedValue({ ok: true }),
    checkAdminPassword: vi.fn().mockResolvedValue({ ok: true }),
    getSubscriptions: vi.fn().mockResolvedValue([{ countryId: 'ga', phone: '+24107000000' }]),
    updateFileStatus: vi.fn().mockResolvedValue({ ok: true }),
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
