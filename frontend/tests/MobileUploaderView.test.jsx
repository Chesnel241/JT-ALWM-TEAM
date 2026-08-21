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
    const tab1 = screen.getByRole('button', { name: /Reportage 1/i });
    const tab2 = screen.getByRole('button', { name: /Reportage 2/i });
    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();

    // Default active tab is Reportage 1, files should be visible
    expect(screen.getByText('interview_gabon.mp4')).toBeInTheDocument();

    // Switch to Reportage 2
    fireEvent.click(tab2);
    expect(screen.getByText('Aucun fichier pour ce reportage.')).toBeInTheDocument();
  });

  it('renders 2 quick action buttons (Video / Media and Script)', () => {
    renderMobileUploader();
    expect(screen.getByText(/Ajouter Vidéo \/ Média/i)).toBeInTheDocument();
    expect(screen.getByText(/Rédiger un Script/i)).toBeInTheDocument();
  });

  it('opens script bottom sheet modal on click', () => {
    renderMobileUploader();
    const scriptBtn = screen.getByText(/Rédiger un Script/i).closest('button');
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
