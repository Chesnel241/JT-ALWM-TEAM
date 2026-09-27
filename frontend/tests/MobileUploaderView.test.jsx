import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import MobileUploaderView from '../src/components/MobileUploaderView.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

const MOCK_COUNTRY = { id: 'ga', name: 'Gabon', code: 'GA' };
const MOCK_WEEKS = [
  // `cutoffAt` : l'instant de clôture décidé par le serveur (dimanche
  // 10h30 GMT+2). Le compte à rebours l'affiche au lieu de le recalculer.
  { id: '2026-W34', status: 'active', startDate: '2026-08-18', cutoffAt: '2026-08-23T08:30:00.000Z' },
  { id: '2026-W33', status: 'archived', startDate: '2026-08-11', cutoffAt: '2026-08-16T08:30:00.000Z' },
];
const MOCK_SUJETS = [
  { id: 's1', titre: 'Marché de Libreville', etat: 'recu', nbPieces: 2 },
  { id: 's2', titre: 'Rentrée scolaire', etat: 'attendu', nbPieces: 0 },
];

const MOCK_UPLOADS = [
  { id: 'file-1', name: 'interview_gabon.mp4', type: 'video', size: '12.4 MB', sujetId: 's1', status: 'approved' },
  { id: 'file-2', name: 'script_gabon.txt', type: 'script', size: '1.2 KB', sujetId: 's1', status: 'pending', content: 'Texte du script' }
];

function renderMobileUploader(props = {}) {
  const defaultProps = {
    country: MOCK_COUNTRY,
    weeks: MOCK_WEEKS,
    selectedWeek: '2026-W34',
    setSelectedWeek: vi.fn(),
    uploads: MOCK_UPLOADS,
    setUploads: vi.fn(),
    uploading: [],
    setUploading: vi.fn(),
    isLoadingUploads: false,
    sujets: MOCK_SUJETS,
    onFixerReportages: vi.fn().mockResolvedValue({ sujets: MOCK_SUJETS }),
    isLocked: false,
    extensionStatus: null,
    handleRequestDelay: vi.fn(),
    handleFiles: vi.fn(),
    handleScriptSubmit: vi.fn(),
    submittingScripts: {},
    openDeleteDialog: vi.fn(),
    hasPhoneNumber: true,
    setHasPhoneNumber: vi.fn(),
    phone: '+33612345678',
    setPhone: vi.fn(),
    handleSubscribe: vi.fn(),
    isSubscribing: false,
    onBack: vi.fn(),
    scriptText: {},
    setScriptText: vi.fn(),
    ...props
  };

  return render(
    <I18nProvider>
      <ToastProvider>
        <MobileUploaderView {...defaultProps} />
      </ToastProvider>
    </I18nProvider>
  );
}


// L'onglet d'une section, en écartant les boutons du choix du nombre de
// reportages, qui portent eux aussi un chiffre.
function sectionTab(label) {
  return screen
    .getAllByRole('button', { name: new RegExp(label, 'i') })
    .find((btn) => !btn.hasAttribute('aria-pressed'));
}

const choix = (n) => screen.getByRole('button', { name: new RegExp(`^${n} reportages?$`, 'i') });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  localStorage.setItem('hasSeen5W1H', 'true');
});

describe('MobileUploaderView', () => {
  it('renders country header and week selector', () => {
    renderMobileUploader();
    expect(screen.getByText('Gabon')).toBeInTheDocument();
    expect(screen.getByText('Pays')).toBeInTheDocument();
  });

  it('renders reportage tabs and allows switching active tab', () => {
    renderMobileUploader();
    const tab1 = sectionTab('Marché de Libreville');
    const tab2 = sectionTab('Rentrée scolaire');
    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();

    // Default active tab is Reportage 1, files should be visible
    expect(screen.getByText('interview_gabon.mp4')).toBeInTheDocument();

    // Switch to Reportage 2 : section vide, illustration + consigne.
    fireEvent.click(tab2);
    expect(screen.getByText(/Aucun fichier pour l.instant/)).toBeInTheDocument();
    expect(screen.getByText(/pour envoyer votre premier fichier/)).toBeInTheDocument();
  });

  it('renders 2 quick action buttons (Video / Media and Script)', () => {
    renderMobileUploader();
    expect(screen.getByText('Envoyer une vidéo')).toBeInTheDocument();
    expect(screen.getByText('Écrire le script')).toBeInTheDocument();
  });

  it('opens script bottom sheet modal on click', () => {
    renderMobileUploader();
    const scriptBtn = screen.getByText('Écrire le script').closest('button');
    fireEvent.click(scriptBtn);
    expect(screen.getByText(/Script : Marché de Libreville/i)).toBeInTheDocument();
    expect(screen.getByText(/Enregistrer le script/i)).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    renderMobileUploader({ onBack });
    fireEvent.click(screen.getByText('Pays').closest('button'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('MobileUploaderView — repères ajoutés', () => {
  it('affiche l\'échéance de la semaine, absente jusque-là sur téléphone', () => {
    renderMobileUploader();
    expect(screen.getByText(/Temps restant pour envoyer|VOUS êtes en retard/i)).toBeInTheDocument();
  });

  it('explique ce qu\'on dépose dans la section active', () => {
    renderMobileUploader();
    expect(screen.getByText(/Votre sujet de la semaine/i)).toBeInTheDocument();
  });

  it('accuse réception quand la section contient des fichiers', () => {
    renderMobileUploader();
    expect(screen.getByText('2 fichiers bien reçus')).toBeInTheDocument();
  });

  it('n\'accuse pas réception pendant un envoi en cours', () => {
    renderMobileUploader({
      uploading: [{ id: 'u1', name: 'a.mp4', progress: 40, phase: 'uploading', sujetId: 's1' }],
    });
    expect(screen.queryByText('2 fichiers bien reçus')).not.toBeInTheDocument();
    expect(screen.getByText(/Gardez cette page ouverte/i)).toBeInTheDocument();
  });

  it('propose toutes les sections sans défilement caché', () => {
    renderMobileUploader();
    // Libellés courts dans les onglets, nom complet dans l'en-tête de section.
    expect(screen.getByRole('button', { name: /Séminaires/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annonces/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Séminaires/i }));
    expect(screen.getByText('Séminaires de la semaine')).toBeInTheDocument();
  });


  it('rassure sur les formats acceptés', () => {
    renderMobileUploader();
    expect(screen.getByText(/Tous les formats vidéo, photo et audio sont acceptés/i)).toBeInTheDocument();
  });

  it('donne une teinte propre à chaque reportage', () => {
    renderMobileUploader({
      sujets: [...MOCK_SUJETS, { id: 's3', titre: 'Le pont', etat: 'attendu', nbPieces: 0 }],
    });
    const tabs = ['Marché de Libreville', 'Rentrée scolaire', 'Le pont'].map(sectionTab);
    // La pastille de chaque onglet porte une couleur de fond distincte.
    const fills = tabs.map((tab) => tab.querySelector('span')?.getAttribute('style') || tab.getAttribute('style') || '');
    expect(new Set(fills).size).toBe(3);
  });

  it('retombe sur les sections numérotées quand le serveur n\'a pas de sujets', () => {
    // Première visite ou API injoignable : l'écran reste utilisable.
    renderMobileUploader({
      sujets: [],
      uploads: [{ id: 'x', name: 'a.mp4', type: 'video', reportage: 'Reportage 2', status: 'pending' }],
    });
    expect(sectionTab('Reportage 1')).toBeTruthy();
    expect(sectionTab('Reportage 2')).toBeTruthy();
  });
});

describe('choisir le nombre de reportages', () => {
  // L'INCIDENT : « Ajouter un reportage » n'était pas compris. Placé sous les
  // onglets, il laissait deviner qu'il fallait s'en servir pour chaque sujet
  // supplémentaire ; plusieurs correspondants déposaient tout dans le premier.
  // Le nombre se choisit maintenant d'abord, et se voit.

  it('pose la question en premier, tant que rien n’est décidé', () => {
    renderMobileUploader({ sujets: [], uploads: [] });
    expect(screen.getByRole('heading', { name: /Combien de reportages envoyez-vous cette semaine/i })).toBeInTheDocument();
    expect(screen.getByText(/Commencez ici/i)).toBeInTheDocument();
    for (const n of [1, 2, 3, 4, 5]) {
      expect(choix(n)).toHaveAttribute('aria-pressed', 'false');
    }
    // Et le dépôt se présente comme l'étape suivante.
    expect(screen.getByText(/Étape 2/i)).toBeInTheDocument();
  });

  it('garde la consigne tant que les reportages ne sont pas nommés, même après un dépôt', () => {
    // Le correspondant qui a déposé dans « Reportage 1 » sans rien choisir est
    // précisément celui qui doit voir la question.
    renderMobileUploader({
      sujets: [],
      uploads: [{ id: 'x', name: 'rush.mp4', type: 'video', reportage: 'Reportage 1', status: 'pending' }],
    });
    expect(screen.getByText(/Commencez ici/i)).toBeInTheDocument();
    expect(choix(1)).toHaveAttribute('aria-pressed', 'true');
  });

  it('donne à « Reportage 1 » la consigne d’un reportage, pas celle des séminaires', () => {
    // La section de repli n'a pas de sujet : le test se faisait sur `sujetId`,
    // et elle héritait de la consigne du cas par défaut — les séminaires.
    renderMobileUploader({ sujets: [], uploads: [] });
    const carte = screen.getByRole('heading', { level: 3, name: /Reportage 1/ }).parentElement;
    expect(carte).not.toHaveTextContent(/séminaires/i);
  });

  it('n’a plus de bouton « Ajouter un reportage »', () => {
    renderMobileUploader();
    expect(screen.queryByText('Ajouter un reportage')).toBeNull();
  });

  it('montre le nombre retenu une fois les reportages nommés', () => {
    renderMobileUploader();
    expect(choix(2)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Commencez ici/i)).toBeNull();
    expect(screen.queryByText(/Étape 2/i)).toBeNull();
    expect(screen.getByText(/changer ce nombre à tout moment/i)).toBeInTheDocument();
  });

  it('demande un titre par reportage, en gardant ceux qui existent', () => {
    renderMobileUploader();
    fireEvent.click(choix(3));
    const boite = screen.getByRole('dialog', { name: /Vos 3 reportages/i });
    const champs = within(boite).getAllByRole('textbox');
    expect(champs.map((c) => c.value)).toEqual(['Marché de Libreville', 'Rentrée scolaire', '']);
  });

  it('ne valide pas un reportage sans titre', () => {
    renderMobileUploader();
    fireEvent.click(choix(3));
    const boite = screen.getByRole('dialog');
    expect(within(boite).getByRole('button', { name: /Valider mes 3 reportages/i })).toBeDisabled();
  });

  it('envoie tous les titres en une seule fois, existants d’abord', async () => {
    const onFixerReportages = vi.fn().mockResolvedValue({ sujets: MOCK_SUJETS });
    renderMobileUploader({ onFixerReportages });
    fireEvent.click(choix(3));
    const boite = screen.getByRole('dialog');
    fireEvent.change(within(boite).getAllByRole('textbox')[2], { target: { value: '  Le pont de Kango  ' } });
    fireEvent.click(within(boite).getByRole('button', { name: /Valider mes 3 reportages/i }));

    await waitFor(() => expect(onFixerReportages).toHaveBeenCalledTimes(1));
    expect(onFixerReportages).toHaveBeenCalledWith([
      { id: 's1', titre: 'Marché de Libreville' },
      { id: 's2', titre: 'Rentrée scolaire' },
      { titre: 'Le pont de Kango' },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('dit ce qui sera retiré quand on en choisit moins', () => {
    renderMobileUploader();
    fireEvent.click(choix(1));
    expect(within(screen.getByRole('dialog')).getByText(/Rentrée scolaire/)).toBeInTheDocument();
  });

  it('ne propose pas de descendre sous un reportage qui contient des fichiers', () => {
    // Le serveur le refuserait ; on ne le propose pas.
    renderMobileUploader({
      sujets: [...MOCK_SUJETS, { id: 's3', titre: 'Le pont', etat: 'recu', nbPieces: 1 }],
      uploads: [...MOCK_UPLOADS, { id: 'f3', name: 'pont.mp4', type: 'video', sujetId: 's3', status: 'pending' }],
    });
    expect(choix(1)).toBeDisabled();
    expect(choix(2)).toBeDisabled();
    expect(choix(3)).not.toBeDisabled();
    expect(screen.getByText(/Pour passer sous 3, videz d.abord le reportage 3/i)).toBeInTheDocument();
  });

  it('garde la feuille ouverte et dit pourquoi quand le serveur refuse', async () => {
    // Un toast fugace ne suffit pas sur un téléphone : on laisse le message
    // à côté des champs, et on ne perd pas ce qui a été tapé.
    const onFixerReportages = vi.fn().mockRejectedValue(new Error('« Le pont » contient déjà des fichiers.'));
    renderMobileUploader({ onFixerReportages });
    fireEvent.click(choix(2));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Valider mes 2 reportages/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/contient déjà des fichiers/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('se ferme à Échap, comme les autres boîtes du studio', () => {
    renderMobileUploader();
    fireEvent.click(choix(2));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('se verrouille avec la semaine', () => {
    renderMobileUploader({ isLocked: true });
    for (const n of [1, 2, 3, 4, 5]) expect(choix(n)).toBeDisabled();
  });

  it('compte les fichiers d’un reportage renommé', () => {
    // Le compteur d'onglet comparait l'étiquette des fichiers au titre : il
    // tombait à 0 dès qu'un reportage était renommé, fichiers bien présents.
    renderMobileUploader({
      sujets: [{ id: 's1', titre: 'Titre corrigé', etat: 'recu', nbPieces: 2 }],
      uploads: MOCK_UPLOADS.map((f) => ({ ...f, reportage: 'Ancien titre' })),
    });
    expect(sectionTab('Titre corrigé')).toHaveTextContent('2');
  });
});
