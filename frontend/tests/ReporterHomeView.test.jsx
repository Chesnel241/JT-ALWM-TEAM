import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('ReporterHomeView — le parcours de la semaine', () => {
  // LE BESOIN : sans compte utilisateur, rien ne disait au correspondant où
  // il en était. Trois étapes reliées le lui montrent d'un coup d'œil.
  const PAYS = { id: 'cm', name: 'Cameroun', code: 'CM' };
  const SEMAINES = [{ id: '2026-w44', startDate: '2026-10-25T22:00:00.000Z', cutoffAt: '2099-11-01T08:30:00.000Z' }];

  async function monterAvec(fichiers, livraisons = []) {
    const { api } = await import('../src/api/index.js');
    vi.spyOn(api, 'getUploads').mockResolvedValue(fichiers);
    vi.spyOn(api, 'getDeliveries').mockResolvedValue(livraisons);
    return renderHub({ homeCountry: PAYS, homeCountryConfirmed: true, weeks: SEMAINES, selectedWeek: '2026-w44' });
  }

  afterEach(() => vi.restoreAllMocks());

  it('une semaine vide : « Vos fichiers » est à envoyer, et c’est à vous', async () => {
    const { container } = await monterAvec([]);
    expect(await screen.findByText('À envoyer')).toBeInTheDocument();
    expect(screen.getByText('À vous')).toBeInTheDocument();
    expect(container.querySelector('.jr-etape[data-avous]')?.dataset.etat).toBe('aFaire');
  });

  it('des fichiers reçus et validés : l’étape est faite, et le dit', async () => {
    await monterAvec([{ id: 'a', name: 'rush.mp4', type: 'video', status: 'approved' }]);
    expect(await screen.findByText('1 fichier envoyé cette semaine · 1 validé')).toBeInTheDocument();
    expect(screen.queryByText('À vous')).toBeNull();
  });

  it('un fichier refusé : un bouton orange mène à la correction', async () => {
    const onOpenReports = vi.fn();
    const { api } = await import('../src/api/index.js');
    vi.spyOn(api, 'getUploads').mockResolvedValue([{ id: 'a', name: 'rush.mp4', type: 'video', status: 'rejected' }]);
    vi.spyOn(api, 'getDeliveries').mockResolvedValue([]);
    renderHub({ homeCountry: PAYS, homeCountryConfirmed: true, weeks: SEMAINES, selectedWeek: '2026-w44', onOpenReports });
    fireEvent.click(await screen.findByText('Voir ce qui est demandé'));
    expect(onOpenReports).toHaveBeenCalled();
  });

  it('le JT publié : l’étape et la carte annoncent « Prêt à télécharger »', async () => {
    await monterAvec([], [{ id: 'jt', name: 'JT.mp4' }]);
    expect(await screen.findAllByText('Prêt à télécharger')).toHaveLength(2);
  });

  it('chaque étape ouvre l’écran qui la concerne', async () => {
    const onOpenVoixOff = vi.fn();
    const { api } = await import('../src/api/index.js');
    vi.spyOn(api, 'getUploads').mockResolvedValue([]);
    vi.spyOn(api, 'getDeliveries').mockResolvedValue([]);
    renderHub({ homeCountry: PAYS, homeCountryConfirmed: true, weeks: SEMAINES, selectedWeek: '2026-w44', onOpenVoixOff });
    fireEvent.click(await screen.findByText('Votre voix off'));
    expect(onOpenVoixOff).toHaveBeenCalled();
  });
});
