import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RubriquePanel from '../src/components/RubriquePanel.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import ToastContainer from '../src/components/Toast.jsx';

/**
 * Le conducteur, lu depuis le chutier de l'espace montage.
 *
 * Les fichiers d'une rubrique arrivaient bien jusqu'au monteur — la voix off
 * est rangée dans le tiroir `tj`, que le tableau de bord liste. Le déroulé
 * écrit, lui, n'était lisible que dans l'espace journalistes : il fallait
 * taper l'adresse à la main pour lire ce qu'on est censé monter.
 */

const SEMAINE = '2026-w37';

const CONDUCTEUR = {
  rubrique: {
    cle: 'conducteur',
    bin: 'tj',
    nom: 'Conducteur du JT',
    champs: [
      { cle: 'texte', libelle: 'Le conducteur', multiligne: true, max: 20000 },
      { cle: 'texteVoixOff', libelle: 'Texte de la voix off', multiligne: true, max: 20000 },
    ],
  },
  champs: {
    texte: 'Lancement plateau.\nPuis Douala.',
    texteVoixOff: 'Bonsoir à tous.',
  },
  revision: 4,
  majLe: '2026-09-12T08:00:00.000Z',
};

const MOT_DU_JT = {
  rubrique: {
    cle: 'motDuJt',
    bin: 'mj',
    nom: 'Mot du JT',
    champs: [
      { cle: 'orateur', libelle: "Nom de l'orateur", max: 120 },
      { cle: 'pays', libelle: 'Pays', max: 80 },
      { cle: 'theme', libelle: 'Thème', max: 300 },
    ],
  },
  champs: { orateur: 'M. Nguema', pays: 'Gabon', theme: 'Éducation' },
  revision: 1,
  majLe: '2026-09-12T09:00:00.000Z',
};

function poser(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <RubriquePanel selectedWeek={SEMAINE} bin="tj" {...props} />
        <ToastContainer />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.restoreAllMocks();
  vi.spyOn(api, 'getRubrique').mockResolvedValue(CONDUCTEUR);
});

describe('ce que le monteur voit', () => {
  it('affiche le déroulé écrit par la rédaction', async () => {
    poser();
    expect(await screen.findByText('Conducteur du JT')).toBeInTheDocument();
    expect(screen.getByText(/Lancement plateau/)).toBeInTheDocument();
    expect(screen.getByText('Bonsoir à tous.')).toBeInTheDocument();
  });

  it('va chercher la rubrique par son tiroir, sans connaître sa clé', async () => {
    // Le tableau de bord raisonne en tiroirs (`tj`, `mj`) : la route accepte
    // les deux, c'est ce qui évite une table de correspondance de plus.
    poser();
    await screen.findByText('Conducteur du JT');
    expect(api.getRubrique).toHaveBeenCalledWith(SEMAINE, 'tj');
  });

  it('affiche les champs du Mot du JT quand c’est son tiroir', async () => {
    api.getRubrique.mockResolvedValue(MOT_DU_JT);
    poser({ bin: 'mj' });
    expect(await screen.findByText('Mot du JT')).toBeInTheDocument();
    expect(screen.getByText('M. Nguema')).toBeInTheDocument();
    expect(screen.getByText('Éducation')).toBeInTheDocument();
  });

  it('dit quand la rédaction n’a encore rien écrit', async () => {
    // Un cadre vide laisserait croire à un défaut d'affichage.
    api.getRubrique.mockResolvedValue({ ...CONDUCTEUR, champs: { texte: '', texteVoixOff: '' } });
    poser();
    expect(await screen.findAllByText('Pas encore rempli par la rédaction.')).toHaveLength(2);
  });

  it('indique quand le texte a été modifié pour la dernière fois', async () => {
    poser();
    await screen.findByText('Conducteur du JT');
    expect(screen.getByText(/Modifié/)).toBeInTheDocument();
  });

  it('ne s’affiche pas du tout si la rubrique est introuvable', async () => {
    api.getRubrique.mockRejectedValue(new Error('404'));
    const { container } = poser();
    await waitFor(() => expect(api.getRubrique).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('copier le déroulé', () => {
  it('met le texte dans le presse-papier', async () => {
    // C'est le geste réel : on vient chercher le déroulé pour le coller dans
    // son outil de montage.
    const ecrire = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText: ecrire } });

    poser();
    await screen.findByText('Conducteur du JT');
    fireEvent.click(screen.getAllByText('Copier')[0]);

    await waitFor(() => expect(ecrire).toHaveBeenCalledWith('Lancement plateau.\nPuis Douala.'));
    expect(await screen.findByText('Copié')).toBeInTheDocument();
  });

  it('le dit quand le navigateur refuse la copie', async () => {
    // Page non sécurisée ou réglage du navigateur : laisser croire que c'est
    // copié ferait coller le texte de la veille.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('refusé')) },
    });

    poser();
    await screen.findByText('Conducteur du JT');
    fireEvent.click(screen.getAllByText('Copier')[0]);

    expect(await screen.findByText(/Copie impossible/)).toBeInTheDocument();
  });

  it('n’offre pas de copier un champ vide', async () => {
    api.getRubrique.mockResolvedValue({
      ...CONDUCTEUR,
      champs: { texte: 'Seul le déroulé est écrit.', texteVoixOff: '' },
    });
    poser();
    await screen.findByText('Conducteur du JT');
    expect(screen.getAllByText('Copier')).toHaveLength(1);
  });
});

describe('modifier', () => {
  it('renvoie vers l’écran de rédaction plutôt que d’ouvrir une seconde saisie', async () => {
    // Deux chemins d'écriture pour le même texte finiraient par diverger :
    // le montage lit et copie, la rédaction écrit.
    poser();
    const lien = await screen.findByRole('link', { name: /Modifier/ });
    expect(lien).toHaveAttribute('href', '/journalistes/conducteur');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('langue', () => {
  it('parle la langue de l’interface', async () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    poser();
    await screen.findByText('Conducteur du JT');
    expect(screen.getAllByText('Copy').length).toBeGreaterThan(0);
    expect(screen.queryByText('Copier')).not.toBeInTheDocument();
  });
});
