import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';
import { api } from '../src/api/index.js';

/**
 * La plateforme n'a plus de mot de passe global : l'écran de connexion a été
 * retiré, et avec lui la vérification qui retardait le premier rendu. Ce
 * fichier décrit ce qu'une personne voit en arrivant — son espace de travail,
 * tout de suite. Seul l'espace montage reste protégé, par son propre mot de
 * passe (voir DashboardView et backend/tests/auth.test.js).
 */

const COUNTRIES = [{ id: 'sn', name: 'Sénégal', code: 'SN' }];
const WEEKS = [{ id: '2026-W34', status: 'active', startDate: '2026-08-18', cutoffAt: '2026-08-23T08:30:00.000Z' }];

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
  vi.restoreAllMocks();
  vi.spyOn(api, 'getCountries').mockResolvedValue(COUNTRIES);
  vi.spyOn(api, 'getWeeks').mockResolvedValue(WEEKS);
  vi.spyOn(api, 'getDeliveries').mockResolvedValue([]);
  vi.spyOn(api, 'getSubscriptions').mockResolvedValue([]);
  vi.spyOn(api, 'getDashboard').mockResolvedValue({});
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe("App — ouverture de la plateforme", () => {
  it("ouvre l'espace de travail sans écran de mot de passe", async () => {
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    expect(await screen.findByText('Que souhaitez-vous faire ?')).toBeInTheDocument();
    // L'ancien écran de déverrouillage global n'existe plus : ni champ, ni
    // bouton, ni renvoi vers le support pour obtenir un mot de passe.
    expect(screen.queryByPlaceholderText(/mot de passe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Déverrouiller/i)).not.toBeInTheDocument();
  });

  it("ne vérifie plus d'authentification au démarrage", async () => {
    // La vérification n'est plus seulement inutilisée : les trois méthodes de
    // connexion ont été retirées avec l'écran qui les appelait. Le premier
    // écran ne dépend donc plus d'un aller-retour réseau, ce qui compte sur
    // une 4G lente.
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    await screen.findByText('Que souhaitez-vous faire ?');
    expect(api.checkAuth).toBeUndefined();
    expect(api.login).toBeUndefined();
    expect(api.logout).toBeUndefined();
    // Celle qui protège réellement l'espace montage, elle, reste.
    expect(typeof api.checkAdminPassword).toBe('function');
  });

  it('demande pays et semaines dès le montage', () => {
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    // Volontairement sans `await` : le chargement part au montage. S'il
    // attendait encore un aller-retour de vérification, ces appels seraient
    // absents à cet instant — et l'écran arriverait une latence plus tard,
    // ce qui compte sur une 4G de bureau-pays.
    expect(api.getCountries).toHaveBeenCalled();
    expect(api.getWeeks).toHaveBeenCalled();
  });
});
