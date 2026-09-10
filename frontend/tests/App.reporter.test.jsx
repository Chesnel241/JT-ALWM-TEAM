import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';
import { api } from '../src/api/index.js';

const COUNTRIES = [{ id: 'sn', name: 'Sénégal', code: 'SN' }];
const WEEKS = [{ id: '2026-W34', status: 'active', startDate: '2026-08-18' }];

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  stubMatchMedia();
  vi.clearAllMocks();
  vi.spyOn(api, 'checkAuth').mockResolvedValue(true);
  vi.spyOn(api, 'getCountries').mockResolvedValue(COUNTRIES);
  vi.spyOn(api, 'getWeeks').mockResolvedValue(WEEKS);
  vi.spyOn(api, 'getDeliveries').mockResolvedValue([]);
  vi.spyOn(api, 'getSubscriptions').mockResolvedValue([]);
  vi.spyOn(api, 'getDashboard').mockResolvedValue({});
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App — URL /journalistes', () => {
  it('ouvre l\'accueil journalistes avec reportage, voix off et JT prêt, sans onglet de montage', async () => {
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    expect(await screen.findByText('Que souhaitez-vous faire ?')).toBeInTheDocument();
    expect(screen.getByText('Envoyer mes fichiers')).toBeInTheDocument();
    expect(screen.getByText('Ouvrir le studio voix')).toBeInTheDocument();
    expect(screen.getByText('Ouvrir le JT prêt')).toBeInTheDocument();
    expect(screen.queryByText('Espace Montage')).not.toBeInTheDocument();
    expect(screen.queryByText('Stats & Délais')).not.toBeInTheDocument();
  });

  it('mène au studio voix off depuis l\'accueil', async () => {
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    fireEvent.click(await screen.findByText('Ouvrir le studio voix'));

    await waitFor(() => expect(window.location.pathname).toBe('/journalistes/voix-off'));
    expect(await screen.findByText('Studio Voix Off')).toBeInTheDocument();
  });

  it('mène à la liste des pays depuis « Espace reportage »', async () => {
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    fireEvent.click(await screen.findByText('Envoyer mes fichiers'));

    await waitFor(() => expect(window.location.pathname).toBe('/journalistes/reportage'));
    // HomeView rend une variante mobile et une variante desktop.
    expect(await screen.findAllByText('Sénégal')).not.toHaveLength(0);
  });

  it('mène au JT prêt depuis « Télécharger le JT »', async () => {
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    fireEvent.click(await screen.findByText('Ouvrir le JT prêt'));

    await waitFor(() => expect(window.location.pathname).toBe('/journalistes/telecharger-le-jt'));
    expect(await screen.findByText(/Fichiers JT Prêts/i)).toBeInTheDocument();
  });

  it('ouvre directement le JT prêt sur un lien profond', async () => {
    window.history.replaceState(null, '', '/journalistes/telecharger-le-jt');
    render(<App />);

    expect(await screen.findByText(/Fichiers JT Prêts/i)).toBeInTheDocument();
  });

  it('renvoie une URL de montage forgée vers l\'accueil journalistes', async () => {
    window.history.replaceState(null, '', '/journalistes/montage');
    render(<App />);

    expect(await screen.findByText('Que souhaitez-vous faire ?')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/journalistes');
  });

  it('normalise un alias de lien recopié à la main', async () => {
    window.history.replaceState(null, '', '/journaliste');
    render(<App />);

    expect(await screen.findByText('Que souhaitez-vous faire ?')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/journalistes');
  });

  it('revient à l\'accueil avec le bouton Précédent du navigateur', async () => {
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    fireEvent.click(await screen.findByText('Ouvrir le JT prêt'));
    await waitFor(() => expect(window.location.pathname).toBe('/journalistes/telecharger-le-jt'));

    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/journalistes'));
    expect(await screen.findByText('Que souhaitez-vous faire ?')).toBeInTheDocument();
  });
});

describe('App — le lien personnel d\'un correspondant', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getUploads').mockResolvedValue([]);
    vi.spyOn(api, 'getDelays').mockResolvedValue(null);
  });

  it('ouvre directement l\'écran d\'envoi du pays', async () => {
    // Régression : les deux effets d'un même rendu voyaient `selectedCountry`
    // encore à null, si bien que le lien personnel repartait aussitôt vers la
    // liste des pays.
    window.history.replaceState(null, '', '/journalistes/sn');
    render(<App />);

    expect(await screen.findAllByText('Sénégal')).not.toHaveLength(0);
    expect(window.location.pathname).toBe('/journalistes/sn');
  });

  it('accepte aussi la forme ?pays=', async () => {
    window.history.replaceState(null, '', '/journalistes/reportage/envoi?pays=sn');
    render(<App />);

    expect(await screen.findAllByText('Sénégal')).not.toHaveLength(0);
    // L'URL est normalisée : le pays vit dans le chemin, pas en double.
    await waitFor(() => expect(window.location.pathname).toBe('/journalistes/sn'));
    expect(window.location.search).toBe('');
  });

  it('retombe sur la liste quand le pays du lien n\'existe pas', async () => {
    window.history.replaceState(null, '', '/journalistes/zz');
    render(<App />);

    // Un pays supprimé ou un lien mal recopié ne doit pas donner un écran vide.
    await waitFor(() => expect(window.location.pathname).toBe('/journalistes/reportage'));
  });

  it('propose ensuite ce pays en raccourci sur l\'accueil', async () => {
    window.history.replaceState(null, '', '/journalistes/sn');
    const { unmount } = render(<App />);
    await screen.findAllByText('Sénégal');
    unmount();

    // Nouvelle visite sur l'accueil : l'appareil se souvient du pays.
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);
    expect(await screen.findAllByText(/Continuer pour Sénégal/)).not.toHaveLength(0);
    expect(screen.getAllByText(/Ce n’est pas mon pays/)).not.toHaveLength(0);
  });
});
