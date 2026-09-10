import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileUploaderView from '../src/components/MobileUploaderView.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

const MOCK_COUNTRY = { id: 'ga', name: 'Gabon', code: 'GA' };
const MOCK_WEEKS = [
  { id: '2026-W34', status: 'active', startDate: '2026-08-18' },
  { id: '2026-W33', status: 'archived', startDate: '2026-08-11' },
];
const MOCK_UPLOADS = [
  { id: 'file-1', name: 'interview_gabon.mp4', type: 'video', size: '12.4 MB', reportage: 'Reportage 1', status: 'approved' },
  { id: 'file-2', name: 'script_gabon.txt', type: 'script', size: '1.2 KB', reportage: 'Reportage 1', status: 'pending', content: 'Texte du script' }
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
    reportageCount: 2,
    setReportageCount: vi.fn(),
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


// L'onglet d'une section, en écartant le bouton « Ajouter un reportage » qui
// porte lui aussi un chiffre dans son libellé.
function sectionTab(label) {
  return screen
    .getAllByRole('button', { name: new RegExp(label, 'i') })
    .find((btn) => !/Ajouter/i.test(btn.textContent));
}

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
    const tab1 = sectionTab('Reportage 1');
    const tab2 = sectionTab('Reportage 2');
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
    expect(screen.getByText(/Script : Reportage 1/i)).toBeInTheDocument();
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
      uploading: [{ id: 'u1', name: 'a.mp4', progress: 40, phase: 'uploading', reportage: 'Reportage 1' }],
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
    renderMobileUploader({ reportageCount: 3 });
    const tabs = ['Reportage 1', 'Reportage 2', 'Reportage 3'].map(sectionTab);
    // La pastille de chaque onglet porte une couleur de fond distincte.
    const fills = tabs.map((tab) => tab.querySelector('span')?.getAttribute('style') || tab.getAttribute('style') || '');
    expect(new Set(fills).size).toBe(3);
  });

  it('annonce le nombre de reportages en cours', () => {
    renderMobileUploader({ reportageCount: 2 });
    const addBtn = screen.getByText('Ajouter un reportage').closest('button');
    expect(addBtn).toHaveTextContent('2');
  });

  it('laisse le journaliste ajouter un reportage', () => {
    const setReportageCount = vi.fn();
    renderMobileUploader({ setReportageCount });
    fireEvent.click(screen.getByText('Ajouter un reportage'));
    expect(setReportageCount).toHaveBeenCalled();
  });
});
