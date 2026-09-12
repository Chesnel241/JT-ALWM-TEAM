import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RubriqueView from '../src/components/RubriqueView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

/**
 * Le conducteur et le Mot du JT ne sont pas des pays.
 *
 * Un seul écran sert les deux : c'est le serveur qui décrit les champs,
 * l'écran les rend. Ajouter un champ ne demandera rien ici.
 */

const CONDUCTEUR = {
  cle: 'conducteur',
  bin: 'tj',
  nom: 'Conducteur du JT',
  description: 'Le déroulé du journal, la voix off et son texte.',
  natureFichier: 'audio',
  libelleFichier: 'La voix off (audio)',
  champs: [
    { cle: 'texte', libelle: 'Le conducteur', multiligne: true, max: 20000 },
    { cle: 'texteVoixOff', libelle: 'Texte de la voix off', multiligne: true, max: 20000 },
  ],
};

const MOT_DU_JT = {
  cle: 'motDuJt',
  bin: 'mj',
  nom: 'Mot du JT',
  description: "L'intervention filmée, et qui parle de quoi.",
  natureFichier: 'video',
  libelleFichier: "La vidéo de l'intervenant",
  champs: [
    { cle: 'orateur', libelle: "Nom de l'orateur", max: 120 },
    { cle: 'pays', libelle: 'Pays', max: 80 },
    { cle: 'theme', libelle: 'Thème', max: 300 },
  ],
};

function rendre(cle, props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <RubriqueView cle={cle} selectedWeek="2026-w37" isActive {...props} />
      </ToastProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, 'getUploads').mockResolvedValue([]);
  vi.spyOn(api, 'getSujets').mockResolvedValue([
    { id: 's1', titre: 'Marché central', countryId: 'cm' },
    { id: 's2', titre: 'Rentrée scolaire', countryId: 'sn' },
  ]);
  vi.spyOn(api, 'setRubrique').mockResolvedValue({});
});

describe('le conducteur du JT', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getRubrique').mockResolvedValue({
      rubrique: CONDUCTEUR,
      champs: { texte: '1. Lancement plateau', texteVoixOff: 'Bonsoir à tous.' },
    });
  });

  it('rend les champs décrits par le serveur, avec leur contenu', async () => {
    rendre('conducteur');
    expect(await screen.findByText('Conducteur du JT')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1. Lancement plateau')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bonsoir à tous.')).toBeInTheDocument();
  });

  it('annonce le fichier que cette rubrique attend', async () => {
    rendre('conducteur');
    expect(await screen.findByText('La voix off (audio)')).toBeInTheDocument();
  });

  it('recense les reportages de tous les pays — c’est sa raison d’être', async () => {
    rendre('conducteur');
    expect(await screen.findByText('Marché central')).toBeInTheDocument();
    expect(screen.getByText('Rentrée scolaire')).toBeInTheDocument();
    expect(screen.getByText('cm')).toBeInTheDocument();
    expect(screen.getByText('sn')).toBeInTheDocument();
  });

  it('enregistre ce qui a été saisi', async () => {
    rendre('conducteur');
    const zone = await screen.findByDisplayValue('1. Lancement plateau');
    fireEvent.change(zone, { target: { value: '1. Lancement plateau\n2. Pikine' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => expect(api.setRubrique).toHaveBeenCalledWith(
      '2026-w37', 'conducteur',
      expect.objectContaining({ texte: '1. Lancement plateau\n2. Pikine' }),
    ));
    expect(await screen.findByText('Enregistré')).toBeInTheDocument();
  });
});

describe('le Mot du JT', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getRubrique').mockResolvedValue({
      rubrique: MOT_DU_JT,
      champs: { orateur: 'Dr. Mbarga' },
    });
  });

  it('rend ses trois champs à lui, et pas ceux du conducteur', async () => {
    rendre('motDuJt');
    expect(await screen.findByText('Mot du JT')).toBeInTheDocument();
    expect(screen.getByText("Nom de l'orateur")).toBeInTheDocument();
    expect(screen.getByText('Pays')).toBeInTheDocument();
    expect(screen.getByText('Thème')).toBeInTheDocument();
    expect(screen.queryByText('Le conducteur')).not.toBeInTheDocument();
  });

  it('attend une vidéo, pas un audio', async () => {
    rendre('motDuJt');
    expect(await screen.findByText("La vidéo de l'intervenant")).toBeInTheDocument();
  });

  it('ne recense aucun reportage : ce n’est pas son rôle', async () => {
    rendre('motDuJt');
    await screen.findByText('Mot du JT');
    expect(screen.queryByText('Les reportages de la semaine')).not.toBeInTheDocument();
    expect(api.getSujets).not.toHaveBeenCalled();
  });
});

describe('quand le serveur refuse', () => {
  it('explique au lieu d’afficher une page blanche', async () => {
    vi.spyOn(api, 'getRubrique').mockRejectedValue(
      new Error('Cette rubrique demande votre lien personnel.'),
    );
    rendre('conducteur');
    expect(await screen.findByText(/lien personnel/i)).toBeInTheDocument();
  });
});
