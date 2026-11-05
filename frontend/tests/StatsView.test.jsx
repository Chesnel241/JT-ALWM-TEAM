import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsView from '../src/components/StatsView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

/**
 * L'INCIDENT : l'écran des délais redemandait le mot de passe que le monteur
 * venait de taper dans l'espace montage, et nommait les pays « SN », « CM ».
 */
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.restoreAllMocks();
  vi.spyOn(api, 'checkAdminPassword').mockResolvedValue(true);
  vi.spyOn(api, 'getStats').mockResolvedValue({
    delaysByWeek: { '2026-w45': { global: null, requests: { sn: { status: 'pending' } } } },
    lateUploadsByCountry: { sn: 1 },
    extensionsByCountry: { sn: 2 },
  });
});

const monter = () => render(
  <I18nProvider>
    <StatsView
      weeks={[{ id: '2026-w45', status: 'active', cutoffAt: '2026-11-08T08:30:00.000Z' }]}
      selectedWeek="2026-w45"
      countries={[{ id: 'sn', name: 'Sénégal' }]}
    />
  </I18nProvider>,
);

describe('StatsView', () => {
  it('reprend le mot de passe de la session montage, sans le redemander', async () => {
    sessionStorage.setItem('jt-admin-pass', 'secret');
    monter();
    expect((await screen.findAllByText('Sénégal')).length).toBeGreaterThan(0);
    expect(api.checkAdminPassword).toHaveBeenCalledWith('secret');
    expect(screen.queryByRole('button', { name: 'Déverrouiller' })).toBeNull();
  });

  it('nomme les pays au lieu de leur code', async () => {
    sessionStorage.setItem('jt-admin-pass', 'secret');
    monter();
    await screen.findAllByText('Sénégal');
    expect(screen.queryByText('sn')).toBeNull();
    expect(screen.queryByText('SN')).toBeNull();
  });
});
