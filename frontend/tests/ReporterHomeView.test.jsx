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
  it('affiche les choix proposés aux journalistes (reportage, voix-off, JT prêt)', () => {
    renderHub();
    expect(screen.getByText('Espace reportage')).toBeInTheDocument();
    expect(screen.getByText('Enregistrer une voix-off')).toBeInTheDocument();
    expect(screen.getByText('Télécharger le JT')).toBeInTheDocument();
    expect(screen.getByText('Envoyer mes fichiers')).toBeInTheDocument();
    expect(screen.getByText('Ouvrir le studio voix')).toBeInTheDocument();
    expect(screen.getByText('Ouvrir le JT prêt')).toBeInTheDocument();
    expect(screen.queryByText('Espace Montage')).not.toBeInTheDocument();
  });

  it('sépare ce qu’on envoie de ce que rédige la rédaction', () => {
    // L'accueil alignait cinq cartes de même poids, marquées 1 à 5. La
    // numérotation annonçait une suite à faire, alors qu'un correspondant du
    // Gabon ne fait que la première, parfois la dernière, et jamais le
    // conducteur ni le Mot du JT — qui sont le travail de la rédaction.
    renderHub({ onOpenConducteur: () => {}, onOpenMotDuJt: () => {} });
    expect(screen.getByText('Ce que vous envoyez')).toBeInTheDocument();
    expect(screen.getByText('La rédaction du journal')).toBeInTheDocument();
  });

  it('n’affiche plus de numérotation qui promet une séquence', () => {
    const { container } = renderHub({ onOpenConducteur: () => {}, onOpenMotDuJt: () => {} });
    // Les pastilles portaient 1, 2, 3, 4, 5. Aucune carte ne doit plus avoir
    // pour seul contenu un chiffre isolé.
    const pastilles = [...container.querySelectorAll('span')]
      .map((s) => s.textContent.trim())
      .filter((texte) => /^[1-9]$/.test(texte));
    expect(pastilles).toEqual([]);
  });

  it('ouvre le conducteur et le Mot du JT depuis l’accueil', () => {
    // Ils ont quitté la barre d'onglets, où aucun libellé n'était lisible sur
    // téléphone : l'accueil est désormais leur seule porte visible.
    const onOpenConducteur = vi.fn();
    const onOpenMotDuJt = vi.fn();
    renderHub({ onOpenConducteur, onOpenMotDuJt });

    fireEvent.click(screen.getByText('Le conducteur du JT'));
    expect(onOpenConducteur).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Le Mot du JT'));
    expect(onOpenMotDuJt).toHaveBeenCalled();
  });

  it('ne laisse aucune carte en français quand l’interface est en anglais', () => {
    // Les deux rubriques étaient écrites en dur : « Le conducteur du JT » et
    // « Le Mot du JT » s'affichaient tels quels au milieu de l'anglais.
    localStorage.setItem('jt-alwm-lang', 'en');
    renderHub({ onOpenConducteur: () => {}, onOpenMotDuJt: () => {} });
    expect(screen.queryByText('Le conducteur du JT')).not.toBeInTheDocument();
    expect(screen.queryByText('Ouvrir le conducteur')).not.toBeInTheDocument();
    expect(screen.queryByText('Ouvrir le Mot du JT')).not.toBeInTheDocument();
  });

  it('ouvre l\'espace reportage', () => {
    const onOpenReports = vi.fn();
    renderHub({ onOpenReports });
    fireEvent.click(screen.getByText('Espace reportage'));
    expect(onOpenReports).toHaveBeenCalled();
  });

  it('ouvre le studio voix-off', () => {
    const onOpenVoixOff = vi.fn();
    renderHub({ onOpenVoixOff });
    fireEvent.click(screen.getByText('Enregistrer une voix-off'));
    expect(onOpenVoixOff).toHaveBeenCalled();
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
    expect(screen.getByText('Record a voice-over')).toBeInTheDocument();
    expect(screen.getByText('Download the show')).toBeInTheDocument();
  });
});
