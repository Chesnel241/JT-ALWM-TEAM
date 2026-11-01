import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ReporterHomeView from '../src/components/ReporterHomeView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

/**
 * L'accueil journalistes : tout d'un coup d'œil.
 *
 * LE BESOIN : on arrive et on voit tous les accès rapides — la voix off, le
 * JT, la rédaction du journal (conducteur, Mot du JT) — puis les drapeaux,
 * pour entrer librement dans l'espace de son pays. Plus de « dernier
 * accès » : l'accès se fait sans compte, et le pays ouvert en dernier sur un
 * appareil ne disait rien de la personne qui arrivait.
 */

const PAYS = [
  { id: 'cm', name: 'Cameroun', code: 'CM' },
  { id: 'ga', name: 'Gabon', code: 'GA' },
  { id: 'sn', name: 'Sénégal', code: 'SN' },
];
const SEMAINES = [
  { id: '2026-w44', status: 'active', num: 44, startDate: '2026-10-25T22:00:00.000Z', endDate: '2026-11-01T21:59:00.000Z', cutoffAt: '2099-11-01T08:30:00.000Z' },
];

function monter(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ReporterHomeView
          countries={PAYS}
          weeks={SEMAINES}
          selectedWeek="2026-w44"
          onSelectCountry={() => {}}
          {...props}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

function rubriques({ conducteur = {}, motDuJt = {}, tj = [], mj = [] } = {}) {
  vi.spyOn(api, 'getRubriques').mockResolvedValue({ conducteur, motDuJt });
  vi.spyOn(api, 'getUploads').mockImplementation((_w, bin) => Promise.resolve(bin === 'tj' ? tj : bin === 'mj' ? mj : []));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.spyOn(api, 'getDeliveries').mockResolvedValue([]);
  rubriques();
});

afterEach(() => vi.restoreAllMocks());

describe('ReporterHomeView — tout d’un coup d’œil', () => {
  it('montre les accès rapides, la rédaction et les drapeaux, sans espace montage', async () => {
    monter();
    expect(screen.getByRole('heading', { name: /Que souhaitez-vous faire/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accès rapides' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enregistrer une voix-off/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Télécharger le JT/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'La rédaction du journal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Envoyer votre reportage' })).toBeInTheDocument();
    for (const pays of PAYS) {
      expect(screen.getByRole('button', { name: new RegExp(pays.name) })).toBeInTheDocument();
    }
    expect(screen.queryByText('Espace Montage')).toBeNull();
    await screen.findByText(/pièce/);
  });

  it('ne propose plus aucun « dernier accès », même si l’appareil en gardait un', () => {
    localStorage.setItem('last_selected_country_id', 'cm');
    localStorage.setItem('reporter_home_country_id', 'cm');
    monter();
    expect(screen.queryByText(/Dernier accès|Votre pays|Continuer pour|Ce n’est pas mon pays/)).toBeNull();
  });

  it('toucher un drapeau ouvre l’espace de ce pays', () => {
    const onSelectCountry = vi.fn();
    monter({ onSelectCountry });
    fireEvent.click(screen.getByRole('button', { name: /Gabon/ }));
    expect(onSelectCountry).toHaveBeenCalledWith(PAYS[1]);
  });

  it('les accès rapides ouvrent la voix off, le JT, le conducteur et le Mot du JT', () => {
    const appels = { onOpenVoixOff: vi.fn(), onOpenDelivery: vi.fn(), onOpenConducteur: vi.fn(), onOpenMotDuJt: vi.fn() };
    monter(appels);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer une voix-off/ }));
    fireEvent.click(screen.getByRole('button', { name: /Télécharger le JT/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le conducteur' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le Mot du JT' }));
    for (const appel of Object.values(appels)) expect(appel).toHaveBeenCalledTimes(1);
  });

  it('le JT publié : la tuile dit « Prêt à télécharger » et « Nouveau » tant qu’il n’a pas été vu ici', async () => {
    api.getDeliveries.mockResolvedValue([{ id: 'jt44', name: 'JT.mp4' }]);
    const { unmount } = monter();
    const tuile = screen.getByRole('button', { name: /Télécharger le JT/ });
    expect(await within(tuile).findByText('Prêt à télécharger')).toBeInTheDocument();
    expect(within(tuile).getByText('Nouveau')).toBeInTheDocument();
    unmount();

    localStorage.setItem('jt-alwm-jt-vus', JSON.stringify(['jt44']));
    monter();
    const deja = screen.getByRole('button', { name: /Télécharger le JT/ });
    await within(deja).findByText('Prêt à télécharger');
    expect(within(deja).queryByText('Nouveau')).toBeNull();
  });

  it('propose le contact WhatsApp du support et les gros caractères', () => {
    monter();
    expect(screen.getByRole('link', { name: /Écrire sur WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(screen.getByText('Lire en gros caractères')).toBeInTheDocument();
  });

  it('notifications impossibles sur cet appareil : pas de bouton mort « indisponibles »', () => {
    // L'accueil affichait « Notifications indisponibles » dans un bouton qui
    // ne faisait rien. Là où elles sont impossibles, la ligne disparaît.
    monter();
    expect(screen.queryByText(/Notifications indisponibles/)).toBeNull();
    expect(screen.queryByText('Être prévenu quand le JT est prêt')).toBeNull();
  });

  it('parle anglais jusqu’à la rédaction', async () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    monter();
    expect(screen.getByRole('heading', { name: 'Quick access' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Send your report' })).toBeInTheDocument();
    expect(await screen.findByText('0 of 7 items ready')).toBeInTheDocument();
    expect(screen.queryByText(/Accès rapides|Envoyer votre reportage/)).toBeNull();
  });
});

describe('ReporterHomeView — la rédaction du journal', () => {
  // LE BESOIN : le rédacteur en chef ouvrait chaque rubrique pour savoir ce
  // qui manquait. Le conducteur de l'accueil le dit, pièce par pièce.
  it('une semaine vierge : les deux rubriques sont « À rédiger »', async () => {
    monter();
    expect(await screen.findByText('0 pièce prête sur 7')).toBeInTheDocument();
    expect(screen.getAllByText('À rédiger')).toHaveLength(2);
  });

  it('un conducteur rempli avec sa voix off, un Mot du JT commencé', async () => {
    rubriques({
      conducteur: { texte: 'Ouverture', texteVoixOff: 'Bonsoir', majLe: new Date().toISOString() },
      motDuJt: { orateur: 'Awa Diallo' },
      tj: [{ id: 'v', name: 'voix.m4a' }],
    });
    const { container } = monter();
    expect(await screen.findByText('4 pièces prêtes sur 7')).toBeInTheDocument();
    expect(screen.getByText('Prêt')).toBeInTheDocument();
    expect(screen.getByText('À compléter')).toBeInTheDocument();
    expect(screen.getByText('Avec Awa Diallo')).toBeInTheDocument();
    expect(container.querySelectorAll('.jr-piece[data-fait]')).toHaveLength(4);
  });

  it('rubriques illisibles (hors ligne) : pas d’état inventé, les portes restent ouvertes', async () => {
    api.getRubriques.mockRejectedValue(new Error('hors ligne'));
    const onOpenConducteur = vi.fn();
    const { container } = monter({ onOpenConducteur });
    await vi.waitFor(() => expect(container.querySelector('.jr-redaction')?.dataset.etat).toBe('inconnu'));
    expect(screen.queryByText(/pièce/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le conducteur' }));
    expect(onOpenConducteur).toHaveBeenCalled();
  });
});
