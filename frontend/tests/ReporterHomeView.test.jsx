import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReporterHomeView from '../src/components/ReporterHomeView.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

function renderHub(props = {}) {
  return render(
    <I18nProvider>
      <ReporterHomeView onOpenReports={() => {}} onOpenDelivery={() => {}} {...props} />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('ReporterHomeView', () => {
  it('n\'affiche que les deux choix attendus', () => {
    renderHub();
    expect(screen.getByText('Espace reportage')).toBeInTheDocument();
    expect(screen.getByText('Télécharger le JT')).toBeInTheDocument();
    // Les deux cartes sont les seuls choix de navigation proposés.
    expect(screen.getByText('Envoyer mes fichiers')).toBeInTheDocument();
    expect(screen.getByText('Ouvrir le JT prêt')).toBeInTheDocument();
    expect(screen.queryByText('Espace Montage')).not.toBeInTheDocument();
  });

  it('ouvre l\'espace reportage', () => {
    const onOpenReports = vi.fn();
    renderHub({ onOpenReports });
    fireEvent.click(screen.getByText('Espace reportage'));
    expect(onOpenReports).toHaveBeenCalled();
  });

  it('ouvre le JT prêt', () => {
    const onOpenDelivery = vi.fn();
    renderHub({ onOpenDelivery });
    fireEvent.click(screen.getByText('Télécharger le JT'));
    expect(onOpenDelivery).toHaveBeenCalled();
  });

  it('propose le contact WhatsApp du support', () => {
    renderHub();
    const link = screen.getByRole('link', { name: /WhatsApp/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('wa.me/33778669907'));
  });


  it("propose de s'abonner aux notifications depuis l'accueil", () => {
    renderHub();
    expect(screen.getByText('Être prévenu quand le JT est prêt')).toBeInTheDocument();
  });

  it('bascule en anglais avec la langue', () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    renderHub();
    expect(screen.getByText('Report space')).toBeInTheDocument();
    expect(screen.getByText('Download the show')).toBeInTheDocument();
  });
});
