import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App.jsx';
import { api } from '../src/api/index.js';
import { saveAdminPassword } from '../src/lib/adminSession.js';
import { translations } from '../src/i18n/translations.js';

/**
 * La bulle d'invitation de l'assistant flotte au-dessus du contenu. Sur les
 * écrans du montage qu'on travaille ligne à ligne — le planning et les
 * statistiques — elle se posait à 390 px sur les deux premières lignes de la
 * liste des reportages : affichées, mais ni lisibles ni cochables. Elle
 * disparaît donc de ces vues sans emporter l'accès à l'aide : le bouton de
 * chat, lui, reste là.
 */

const fr = translations.fr;
const INVITATION = fr.aiAssistant.greeting;

const COUNTRIES = [{ id: 'sn', name: 'Sénégal', code: 'SN' }];
const WEEKS = [{ id: '2026-w34', status: 'active', startDate: '2026-08-18', cutoffAt: '2026-08-23T08:30:00.000Z' }];
const PLANNING = {
  monteurs: [{ id: 'm1', nom: 'Godsway' }],
  semaines: {
    '2026-w34': {
      libelle: 'Sem. 18',
      assemblage: { monteurId: 'm1', etat: 'en_cours', majLe: null },
      habillage: { monteurId: null, etat: 'a_faire', majLe: null },
      sujetsMontes: [],
    },
  },
};
// Les deux reportages du haut de liste : ceux que la bulle recouvrait.
const SUJETS = [
  { id: 's1', titre: 'Marché central', countryId: 'sn', etat: 'valide', nbPieces: 3, monte: false },
  { id: 's2', titre: 'Rentrée scolaire', countryId: 'sn', etat: 'recu', nbPieces: 1, monte: false },
];

// Les écrans du montage sont chargés à la demande : le premier rendu d'un
// fichier de test attend l'arrivée du module, bien au-delà du délai par
// défaut de findBy*.
const CHARGEMENT = { timeout: 5000 };

// Le bouton de chat n'a ni libellé ni texte : on le retrouve par le conteneur
// flottant de l'assistant, seul endroit de la page à porter ce plan.
function boutonDeChat() {
  return document.querySelector('[class*="z-[9999]"] button');
}

function stubMatchMedia() {
  // `false` partout : on décrit le petit écran, celui où la bulle gênait.
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
  sessionStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  stubMatchMedia();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.spyOn(api, 'getCountries').mockResolvedValue(COUNTRIES);
  vi.spyOn(api, 'getWeeks').mockResolvedValue(WEEKS);
  vi.spyOn(api, 'getDashboard').mockResolvedValue({});
  vi.spyOn(api, 'getDeliveries').mockResolvedValue([]);
  vi.spyOn(api, 'getSubscriptions').mockResolvedValue([]);
  vi.spyOn(api, 'getPlanning').mockResolvedValue(PLANNING);
  vi.spyOn(api, 'getPlanningSujets').mockResolvedValue(SUJETS);
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe("App — la bulle d'invitation dans l'espace montage", () => {
  it('laisse la liste du planning libre, tout en gardant le chat à portée', async () => {
    saveAdminPassword('mdp-montage'); // un monteur qui a déjà déverrouillé
    window.history.replaceState(null, '', '/monteurs/planning');
    render(<App />);

    expect(await screen.findByText('Marché central', undefined, CHARGEMENT)).toBeInTheDocument();
    expect(screen.getByText('Rentrée scolaire')).toBeInTheDocument();
    expect(screen.queryByText(INVITATION)).not.toBeInTheDocument();

    // L'aide reste accessible en un geste : c'est l'invitation qui gênait.
    fireEvent.click(boutonDeChat());
    expect(screen.getByText(fr.aiAssistant.botName)).toBeInTheDocument();
  }, 15000);

  it('ne se pose pas non plus sur les statistiques', async () => {
    window.history.replaceState(null, '', '/monteurs/stats');
    render(<App />);

    expect(await screen.findByText(/Espace Statistiques/, undefined, CHARGEMENT)).toBeInTheDocument();
    expect(screen.queryByText(INVITATION)).not.toBeInTheDocument();
    expect(boutonDeChat()).toBeInTheDocument();
  }, 15000);

  it('reste proposée sur le tableau de bord du montage', async () => {
    window.history.replaceState(null, '', '/monteurs');
    render(<App />);

    expect(await screen.findByText('Espace Montage Sécurisé', undefined, CHARGEMENT)).toBeInTheDocument();
    expect(screen.getByText(INVITATION)).toBeInTheDocument();
  }, 15000);
});

describe("App — l'espace journalistes reste sans pastille flottante", () => {
  it("n'y monte ni assistant ni bouton WhatsApp", async () => {
    window.history.replaceState(null, '', '/journalistes');
    render(<App />);

    await screen.findByText('Que souhaitez-vous faire ?');
    expect(screen.queryByText(INVITATION)).not.toBeInTheDocument();
    expect(boutonDeChat()).toBeNull();
    expect(screen.queryByLabelText(fr.help.aria)).not.toBeInTheDocument();
  });
});
