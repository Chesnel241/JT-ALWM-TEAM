import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RelancePanel from '../src/components/RelancePanel.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

/**
 * La relance du samedi, dans l'application.
 *
 * Elle se faisait hors de la plateforme : parcourir le tableau de bord pays
 * par pays, puis chercher le numéro dans les contacts du téléphone. Les deux
 * informations existaient déjà, sans jamais être mises côte à côte.
 */

const SEMAINE = '2026-w37';

// Un peu plus de six heures avant la clôture : le temps restant doit
// apparaître dans le message, c'est ce qui rend une relance convaincante.
// La minute de marge évite que l'arrondi à l'heure inférieure ne fasse
// basculer le test sur « 5 h » pendant son exécution.
const SEMAINE_OUVERTE = {
  id: SEMAINE,
  cutoffAt: new Date(Date.now() + 6 * 3600 * 1000 + 60 * 1000).toISOString(),
};

function poser(props = {}) {
  return render(
    <I18nProvider>
      <RelancePanel
        selectedWeek={SEMAINE}
        adminPassword="montage2026"
        week={SEMAINE_OUVERTE}
        {...props}
      />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.restoreAllMocks();
  vi.spyOn(api, 'getRelances').mockResolvedValue([]);
  vi.spyOn(api, 'getDemandesDelai').mockResolvedValue([]);
});

describe('quand le panneau s’affiche', () => {
  it('reste invisible quand tout le monde a envoyé', async () => {
    // Un bandeau permanent qui dit « rien à signaler » finit par ne plus
    // être lu, et masque celui qui compte.
    const { container } = poser();
    await waitFor(() => expect(api.getRelances).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('n’interroge pas le serveur sans mot de passe montage', async () => {
    poser({ adminPassword: '' });
    await waitFor(() => expect(api.getRelances).not.toHaveBeenCalled());
  });

  it('apparaît dès qu’un pays manque à l’appel', async () => {
    api.getRelances.mockResolvedValue([
      { countryId: 'sn', nom: 'Sénégal', manque: 'rien_recu', nbFichiers: 0, nbVideos: 0, phone: '+221770000000' },
    ]);
    poser();
    expect(await screen.findByText('Pays à relancer')).toBeInTheDocument();
  });
});

describe('le message de relance', () => {
  beforeEach(() => {
    api.getRelances.mockResolvedValue([
      { countryId: 'sn', nom: 'Sénégal', manque: 'rien_recu', nbFichiers: 0, nbVideos: 0, phone: '+221 77 000 00 00' },
    ]);
  });

  it('ouvre WhatsApp sur le bon numéro, message déjà écrit', async () => {
    poser();
    fireEvent.click(await screen.findByText('Pays à relancer'));

    const lien = await screen.findByRole('link', { name: /Sénégal/ });
    expect(lien.getAttribute('href')).toContain('wa.me/221770000000');
    const message = decodeURIComponent(lien.getAttribute('href').split('text=')[1]);
    expect(message).toContain('Sénégal');
    // Le temps restant, et l'heure de clôture en vigueur.
    expect(message).toContain('6 h');
    expect(message).toContain('dimanche 10h30 (GMT+2)');
  });

  it('ne propose pas de bouton quand aucun numéro n’est enregistré', async () => {
    // Un bouton sans numéro ouvrirait WhatsApp sur rien.
    api.getRelances.mockResolvedValue([
      { countryId: 'tg', nom: 'Togo', manque: 'rien_recu', nbFichiers: 0, nbVideos: 0, phone: '' },
    ]);
    poser();
    fireEvent.click(await screen.findByText('Pays à relancer'));

    expect(await screen.findByText(/Pas de numéro enregistré/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('les demandes de délai', () => {
  it('remontent enfin jusqu’à l’équipe montage', async () => {
    // Elles n'étaient visibles que dans l'onglet Statistiques : le
    // correspondant attendait une réponse qui ne venait pas.
    api.getDemandesDelai.mockResolvedValue([
      { countryId: 'ma', nom: 'Maroc', demandeLe: new Date().toISOString() },
    ]);
    poser();

    expect(await screen.findByText(/1 demande de délai en attente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('Maroc')).toBeInTheDocument();
  });

  it('accorde le pluriel comme il faut', async () => {
    api.getDemandesDelai.mockResolvedValue([
      { countryId: 'ma', nom: 'Maroc', demandeLe: new Date().toISOString() },
      { countryId: 'tg', nom: 'Togo', demandeLe: new Date().toISOString() },
    ]);
    poser();
    expect(await screen.findByText(/2 demandes de délai en attente/)).toBeInTheDocument();
  });
});

describe('langue', () => {
  it('écrit la relance dans la langue de l’interface', async () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    api.getRelances.mockResolvedValue([
      { countryId: 'gh', nom: 'Ghana', manque: 'rien_recu', nbFichiers: 0, nbVideos: 0, phone: '+233200000000' },
    ]);
    poser();

    expect(await screen.findByText('Countries to remind')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    const lien = await screen.findByRole('link', { name: /Ghana/ });
    const message = decodeURIComponent(lien.getAttribute('href').split('text=')[1]);
    expect(message).toMatch(/Hello Ghana/);
  });
});
