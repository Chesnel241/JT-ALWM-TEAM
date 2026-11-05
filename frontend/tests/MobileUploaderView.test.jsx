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

function defaultPropsPourRerendu() {
  return {
    country: MOCK_COUNTRY, weeks: MOCK_WEEKS, selectedWeek: '2026-W34', setSelectedWeek: vi.fn(),
    uploads: MOCK_UPLOADS, setUploads: vi.fn(), uploading: [], setUploading: vi.fn(), isLoadingUploads: false,
    sujets: MOCK_SUJETS, onFixerReportages: vi.fn(), isLocked: false, extensionStatus: null,
    handleRequestDelay: vi.fn(), handleFiles: vi.fn(), handleScriptSubmit: vi.fn(), submittingScripts: {},
    openDeleteDialog: vi.fn(), hasPhoneNumber: true, setHasPhoneNumber: vi.fn(), phone: '+33612345678',
    setPhone: vi.fn(), handleSubscribe: vi.fn(), isSubscribing: false, onBack: vi.fn(), scriptText: {}, setScriptText: vi.fn(),
  };
}

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

// Une fois les reportages nommés, le choix est replié en une ligne : on le
// déplie d'abord, comme le ferait le correspondant.
const choix = (n) => {
  const replie = screen.queryByRole('button', { name: /Changer le nombre/, expanded: false });
  if (replie) fireEvent.click(replie);
  return screen.getByRole('button', { name: new RegExp(`^${n} reportages?$`, 'i') });
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  localStorage.setItem('hasSeen5W1H', 'true');
});

describe('MobileUploaderView', () => {
  it('renders country header and week selector', () => {
    renderMobileUploader();
    expect(screen.getByText('Gabon')).toBeInTheDocument();
    expect(screen.getByText('Retour')).toBeInTheDocument();
  });

  it('la semaine se lit en texte ; « changer » ouvre le choix', () => {
    // Le sélecteur ouvert en permanence prenait une ligne entière pour un
    // réglage qu'on ne touche presque jamais.
    const setSelectedWeek = vi.fn();
    renderMobileUploader({ setSelectedWeek });
    expect(screen.queryByRole('combobox', { name: /semaine/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'changer' }));
    fireEvent.change(screen.getByRole('combobox', { name: /semaine/i }), { target: { value: '2026-W33' } });
    expect(setSelectedWeek).toHaveBeenCalledWith('2026-W33');
    expect(screen.queryByRole('combobox', { name: /semaine/i })).toBeNull();
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
    expect(screen.getByText('Envoyer un fichier')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Retour').closest('button'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('MobileUploaderView — repères ajoutés', () => {
  it('affiche l\'échéance de la semaine, absente jusque-là sur téléphone', () => {
    renderMobileUploader();
    expect(screen.getByRole('timer')).toHaveAccessibleName(/Temps restant pour envoyer|clôturés/i);
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

  it('se replie en une ligne une fois les reportages nommés', () => {
    // Ouvert, le choix repoussait le bouton d'envoi sous la ligne de
    // flottaison pour une décision déjà prise.
    renderMobileUploader();
    expect(screen.getByRole('heading', { name: '2 reportages' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^3 reportages$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Changer le nombre/ }));
    expect(screen.getByRole('button', { name: /^3 reportages$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replier' }));
    expect(screen.queryByRole('button', { name: /^3 reportages$/ })).toBeNull();
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

describe('ce que la page d’envoi dit, reportage par reportage', () => {
  it('au retour, surligne l’onglet du reportage affiché', () => {
    // L'INCIDENT : l'onglet actif valait encore « reportage-0 » alors que les
    // sections portaient les identifiants du serveur — aucun n'était surligné.
    renderMobileUploader();
    const onglet = sectionTab('Marché de Libreville');
    expect(onglet).toHaveAttribute('aria-current', 'true');
  });

  it('ne dit pas « vous pouvez fermer la page » pendant un envoi dans un autre reportage', () => {
    // L'INCIDENT : l'encadré ne regardait que le reportage affiché. Fermer la
    // page aurait interrompu l'envoi en cours ailleurs.
    renderMobileUploader({
      uploading: [{ id: 'u1', name: 'rentree.mp4', sujetId: 's2', reportage: 'Rentrée scolaire', progress: 40, status: 'uploading' }],
    });
    expect(screen.queryByText(/Vous pouvez fermer la page/)).not.toBeInTheDocument();
    expect(screen.getByText(/gardez la page ouverte/)).toBeInTheDocument();
  });
});

describe('prévenir la rédaction', () => {
  // LE BESOIN : après l'envoi, les correspondants écrivaient à la main à la
  // rédaction pour dire « c'est parti », souvent sans dire quel reportage.
  it('propose un message WhatsApp déjà écrit : pays, semaine, nombre, titre', () => {
    renderMobileUploader();
    const lien = screen.getByRole('link', { name: /Prévenir la rédaction/ });
    const texte = decodeURIComponent(new URL(lien.href).searchParams.get('text'));
    expect(texte).toBe('Gabon, Semaine 34 : 2 fichiers envoyés pour « Marché de Libreville ».');
  });

  it('se tait pendant un envoi en cours dans ce reportage', () => {
    renderMobileUploader({
      uploading: [{ id: 'u1', name: 'b.mp4', sujetId: 's1', reportage: 'Marché de Libreville', progress: 40, status: 'uploading' }],
    });
    expect(screen.queryByRole('link', { name: /Prévenir la rédaction/ })).toBeNull();
  });
});

describe('après un envoi', () => {
  it('dit qu’un autre reportage est encore vide, et y mène', () => {
    // Sans cela, le correspondant croyait avoir tout envoyé.
    renderMobileUploader();
    expect(screen.getByText('« Rentrée scolaire » n’a encore aucun fichier.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Y aller' }));
    expect(sectionTab('Rentrée scolaire')).toHaveAttribute('aria-current', 'true');
  });

  it('amène la progression à l’écran quand un envoi démarre', () => {
    const defiler = vi.fn();
    Element.prototype.scrollIntoView = defiler;
    const { rerender } = renderMobileUploader();
    expect(defiler).not.toHaveBeenCalled();
    const props = { ...defaultPropsPourRerendu(), uploading: [{ id: 'u1', name: 'b.mp4', sujetId: 's1', reportage: 'Marché de Libreville', progress: 1, status: 'uploading' }] };
    rerender(
      <I18nProvider><ToastProvider><MobileUploaderView {...props} /></ToastProvider></I18nProvider>,
    );
    expect(defiler).toHaveBeenCalled();
  });

  it('range annonces et séminaires sous « Autres envois (facultatif) »', () => {
    renderMobileUploader();
    const etiquette = screen.getByText('Autres envois (facultatif)');
    const annonces = sectionTab('Annonces');
    expect(etiquette.compareDocumentPosition(annonces) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sectionTab('Rentrée scolaire').compareDocumentPosition(etiquette) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
