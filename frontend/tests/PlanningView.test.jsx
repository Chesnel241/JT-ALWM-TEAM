import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlanningView from '../src/components/PlanningView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

/**
 * L'écran du planning : qui monte quoi, où il en est, et ce qui est déjà
 * monté. Les libellés affichés sont ceux de la rédaction (« Sem. 18 »),
 * qui ne coïncident pas avec la semaine ISO servant de clé.
 */

const MONTEURS = [
  { id: 'm1', nom: 'Godsway' },
  { id: 'm2', nom: 'David' },
  { id: 'm3', nom: 'Chesnel' },
];

const PLANNING = {
  monteurs: MONTEURS,
  semaines: {
    '2026-w37': {
      libelle: 'Sem. 18',
      assemblage: { monteurId: 'm1', etat: 'en_cours', majLe: null },
      habillage: { monteurId: 'm2', etat: 'a_faire', majLe: null },
      sujetsMontes: ['s1'],
    },
    '2026-w44': {
      libelle: 'Sem. 25',
      assemblage: { monteurId: 'm3', etat: 'a_faire', majLe: null },
      habillage: { monteurId: null, etat: 'a_faire', majLe: null },
      sujetsMontes: [],
    },
  },
};

const SUJETS = [
  { id: 's1', titre: 'Marché central', countryId: 'cm', etat: 'valide', nbPieces: 3, monte: true },
  { id: 's2', titre: 'Rentrée scolaire', countryId: 'sn', etat: 'recu', nbPieces: 1, monte: false },
];

function rendreLePlanning(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <PlanningView selectedWeek="2026-w37" isActive {...props} />
      </ToastProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  // Les libellés attendus ci-dessous sont ceux du français. L'écran était
  // écrit en dur dans cette langue ; il passe désormais par le dictionnaire,
  // donc la langue doit être choisie explicitement.
  localStorage.setItem('jt-alwm-lang', 'fr');
  sessionStorage.setItem('jt-admin-pass', 'dev');
  vi.spyOn(api, 'getPlanning').mockResolvedValue(structuredClone(PLANNING));
  vi.spyOn(api, 'getPlanningSujets').mockResolvedValue(structuredClone(SUJETS));
  vi.spyOn(api, 'affecterSemaine').mockResolvedValue({});
  vi.spyOn(api, 'majEtatMontage').mockResolvedValue({});
  vi.spyOn(api, 'marquerSujetMonte').mockResolvedValue({});
});

describe('la programmation', () => {
  it('affiche le numéro de la rédaction, pas celui de la semaine ISO', async () => {
    rendreLePlanning();
    // Leur « Sem. 18 » est notre 2026-w37 : c'est le libellé qui s'affiche.
    expect(await screen.findByText('Sem. 18')).toBeInTheDocument();
    expect(screen.getByText('Sem. 25')).toBeInTheDocument();
    expect(screen.queryByText('2026-w37')).not.toBeInTheDocument();
  });

  it('nomme les deux rôles, plutôt que de les laisser à une icône', async () => {
    rendreLePlanning();
    await screen.findByText('Sem. 18');
    expect(screen.getAllByText('Assemblage').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Habillage').length).toBeGreaterThan(0);
  });

  it('montre une semaine que la liste de travail n’expose pas', async () => {
    // Le planning porte SES semaines : 2026-w44 est à deux mois, donc
    // absente du sélecteur de semaines de l'application.
    rendreLePlanning();
    expect(await screen.findByText('Sem. 25')).toBeInTheDocument();
  });

  it('signale la semaine en cours', async () => {
    rendreLePlanning();
    expect(await screen.findByText('en cours')).toBeInTheDocument();
  });

  it('enregistre un changement d’affectation', async () => {
    rendreLePlanning();
    await screen.findByText('Sem. 18');
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'm3' } });
    await waitFor(() => expect(api.affecterSemaine).toHaveBeenCalledWith(
      '2026-w37', { assemblage: 'm3' }, 'dev',
    ));
  });

  it('enregistre l’avancement du rôle qu’on touche, et de lui seul', async () => {
    rendreLePlanning();
    await screen.findByText('Sem. 18');
    // Le premier « Terminé » est celui de l'assemblage de la semaine 18.
    fireEvent.click(screen.getAllByRole('button', { name: /Terminé/i })[0]);
    await waitFor(() => expect(api.majEtatMontage).toHaveBeenCalledWith(
      '2026-w37', 'assemblage', 'termine', 'dev',
    ));
  });
});

describe('le conducteur de la semaine', () => {
  it('liste les reportages de tous les pays, avec leur avancement', async () => {
    rendreLePlanning();
    expect(await screen.findByText('Marché central')).toBeInTheDocument();
    expect(screen.getByText('Rentrée scolaire')).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2 monté/)).toBeInTheDocument();
  });

  it('coche un reportage monté', async () => {
    rendreLePlanning();
    await screen.findByText('Rentrée scolaire');
    const cases = screen.getAllByRole('checkbox');
    expect(cases[0].checked).toBe(true);   // « Marché central » déjà monté
    fireEvent.click(cases[1]);
    await waitFor(() => expect(api.marquerSujetMonte).toHaveBeenCalledWith(
      '2026-w37', 's2', true, 'dev',
    ));
  });

  it('remet la case comme elle était si l’enregistrement échoue', async () => {
    api.marquerSujetMonte.mockRejectedValueOnce(new Error('réseau'));
    rendreLePlanning();
    await screen.findByText('Rentrée scolaire');
    const cases = screen.getAllByRole('checkbox');
    fireEvent.click(cases[1]);
    // Cochée sur le coup, décochée quand le serveur refuse : le monteur ne
    // doit pas croire qu'un reportage est monté alors que rien n'est parti.
    await waitFor(() => expect(screen.getAllByRole('checkbox')[1].checked).toBe(false));
  });
});

describe('sans le mot de passe montage', () => {
  it('offre la porte d’entrée au lieu d’un mur', async () => {
    // Le mur disait « Déverrouillez l'espace montage » sans champ, sans
    // bouton, sans rien : il fallait deviner qu'il fallait passer par un
    // autre onglet, taper le mot de passe, puis revenir.
    sessionStorage.removeItem('jt-admin-pass');
    rendreLePlanning();

    expect(await screen.findByLabelText(/mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(api.getPlanning).not.toHaveBeenCalled();
  });

  it('charge la programmation dès que le mot de passe est accepté', async () => {
    sessionStorage.removeItem('jt-admin-pass');
    vi.spyOn(api, 'checkAdminPassword').mockResolvedValue(true);
    rendreLePlanning();

    fireEvent.change(await screen.findByLabelText(/mot de passe/i), {
      target: { value: 'montage2026' },
    });
    fireEvent.click(screen.getByRole('button'));

    // Sans changer d'onglet ni recharger la page.
    expect(await screen.findByText('Sem. 18')).toBeInTheDocument();
    expect(api.getPlanning).toHaveBeenCalledWith('montage2026');
  });
});

describe('la liste à cocher', () => {
  it('groupe les reportages par pays', async () => {
    // Ils arrivaient dans l'ordre de création, tous pays mêlés : le monteur
    // sautait du Cameroun au Sénégal puis au Togo pour revenir au Cameroun.
    rendreLePlanning();
    // La semaine en cours est dépliée d'entrée : rien à cliquer.
    await screen.findByText('Sem. 18');
    await waitFor(() => expect(screen.getByText('CM')).toBeInTheDocument());
    expect(screen.getByText('SN')).toBeInTheDocument();
  });

  it('n’offre pas de cocher un sujet dont rien n’est arrivé', async () => {
    // Un sujet sans aucun fichier ne peut pas être monté. Il reste affiché,
    // pour qu'on sache ce qui manque, mais la case est hors service.
    api.getPlanningSujets.mockResolvedValue([
      { id: 's1', titre: 'Marché central', countryId: 'cm', nbPieces: 3, duree: 120, monte: false },
      { id: 's9', titre: 'Annoncé, jamais envoyé', countryId: 'cm', nbPieces: 0, duree: null, monte: false },
    ]);
    rendreLePlanning();
    // La semaine en cours est dépliée d'entrée : rien à cliquer.
    await screen.findByText('Sem. 18');

    const vide = await screen.findByText('Annoncé, jamais envoyé');
    const caseVide = vide.closest('label').querySelector('input[type="checkbox"]');
    expect(caseVide).toBeDisabled();
    expect(screen.getByText(/rien reçu pour l’instant/i)).toBeInTheDocument();

    const rempli = screen.getByText('Marché central');
    expect(rempli.closest('label').querySelector('input')).not.toBeDisabled();
  });

  it('ne compte dans la jauge que ce qui peut être monté', async () => {
    // « 0 / 15 » dont neuf sont vides est un chiffre faux : le monteur ne
    // peut pas s'y fier pour savoir où en est le journal.
    api.getPlanningSujets.mockResolvedValue([
      { id: 's1', titre: 'Reçu et monté', countryId: 'cm', nbPieces: 2, duree: 60, monte: true },
      { id: 's2', titre: 'Reçu, à monter', countryId: 'cm', nbPieces: 1, duree: 30, monte: false },
      { id: 's3', titre: 'Rien reçu', countryId: 'cm', nbPieces: 0, duree: null, monte: false },
      { id: 's4', titre: 'Rien reçu non plus', countryId: 'sn', nbPieces: 0, duree: null, monte: false },
    ]);
    rendreLePlanning();
    // La semaine en cours est dépliée d'entrée : rien à cliquer.
    await screen.findByText('Sem. 18');

    expect(await screen.findByText('1 / 2 monté')).toBeInTheDocument();
  });

  it('affiche la durée reçue, par sujet et pour la semaine', async () => {
    api.getPlanningSujets.mockResolvedValue([
      // Deux sujets pour le Cameroun : le total du pays (2 min 20) diffère
      // ainsi de chaque durée de sujet, et l'assertion reste sans ambiguïté.
      { id: 's1', titre: 'Marché central', countryId: 'cm', nbPieces: 2, duree: 102, monte: false },
      { id: 's2', titre: 'Écoles', countryId: 'cm', nbPieces: 1, duree: 38, monte: false },
      { id: 's3', titre: 'Le port', countryId: 'sn', nbPieces: 1, duree: 40, monte: false },
    ]);
    rendreLePlanning();
    // La semaine en cours est dépliée d'entrée : rien à cliquer.
    await screen.findByText('Sem. 18');

    // Par sujet.
    expect(await screen.findByText(/1 min 42/)).toBeInTheDocument();
    // Par pays.
    expect(screen.getByText('2 min 20 au total')).toBeInTheDocument();
    // Et pour le journal entier.
    expect(screen.getByText('3 min 00 de rushes reçus')).toBeInTheDocument();
  });
});
