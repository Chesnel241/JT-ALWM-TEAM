import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import UploaderView from '../src/components/UploaderView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

/**
 * L'écran d'envoi sur ordinateur, monté pour de vrai.
 *
 * L'INCIDENT : aucun test n'importait ce fichier. Un import retiré à tort
 * (l'icône `Video`, lue au niveau du module) le rendait inchargeable :
 * `ReferenceError` au chargement, rattrapée en silence par l'écran d'erreur
 * de l'application. Le build passait — il ne résout pas les noms — et la
 * suite aussi. Seul le passage dans un vrai navigateur l'a montré.
 */

const PAYS = { id: 'ga', name: 'Gabon', code: 'GA' };
const SEMAINES = [
  { id: '2026-W34', status: 'active', startDate: '2026-08-18', cutoffAt: '2099-08-23T08:30:00.000Z' },
];
const ENVOIS = [
  { id: 'f1', name: 'interview.mp4', type: 'video', size: '12 MB', sujetId: 's1', status: 'approved' },
];

function monter(lang) {
  localStorage.setItem('jt-alwm-lang', lang);
  localStorage.setItem('uploader_phone_ga', '+24177000000');
  return render(
    <I18nProvider>
      <ToastProvider>
        <UploaderView country={PAYS} weeks={SEMAINES} selectedWeek="2026-W34" setSelectedWeek={vi.fn()} onBack={vi.fn()} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(api, 'getUploads').mockResolvedValue(ENVOIS);
  vi.spyOn(api, 'getSujets').mockResolvedValue([{ id: 's1', titre: 'Marché de Libreville', etat: 'recu' }]);
  vi.spyOn(api, 'getDelays').mockResolvedValue([]);
  vi.spyOn(api, 'subscribeToNotifications').mockResolvedValue({});
});

describe('UploaderView — ordinateur', () => {
  it('se charge et affiche un envoi vidéo avec son icône', async () => {
    monter('fr');
    expect((await screen.findAllByText('interview.mp4')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Marché de Libreville').length).toBeGreaterThan(0);
  });

  it('parle anglais jusqu’aux sections fixes', async () => {
    monter('en');
    await screen.findAllByText('interview.mp4');
    const desktop = document.body;
    expect(within(desktop).getAllByText('Announcements').length).toBeGreaterThan(0);
    expect(within(desktop).queryByText('Annonces')).toBeNull();
    expect(within(desktop).getAllByText('Approved').length).toBeGreaterThan(0);
  });
});
