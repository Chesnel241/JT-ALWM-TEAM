import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import UploaderView from '../src/components/UploaderView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

/**
 * L'écran d'envoi sur ordinateur, monté pour de vrai.
 *
 * L'INCIDENT : aucun test n'importait ce fichier. Un import retiré à tort
 * (l'icône `Video`, lue au niveau du module) le rendait inchargeable :
 * `ReferenceError` au chargement, rattrapée en silence par l'écran d'erreur
 * de l'application. Le build passait — il ne résout pas les noms — et la
 * suite aussi. Seul le passage dans un vrai navigateur l'a montré.
 */

const PAYS = { id: 'ga', name: 'Gabon', code: 'GA' };
const SEMAINES = [
  { id: '2026-W34', status: 'active', startDate: '2026-08-18', cutoffAt: '2099-08-23T08:30:00.000Z' },
];
const ENVOIS = [
  { id: 'f1', name: 'interview.mp4', type: 'video', size: '12 MB', sujetId: 's1', status: 'approved' },
];

function monter(lang) {
  localStorage.setItem('jt-alwm-lang', lang);
  localStorage.setItem('uploader_phone_ga', '+24177000000');
  return render(
    <I18nProvider>
      <ToastProvider>
        <UploaderView country={PAYS} weeks={SEMAINES} selectedWeek="2026-W34" setSelectedWeek={vi.fn()} onBack={vi.fn()} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(api, 'getUploads').mockResolvedValue(ENVOIS);
  vi.spyOn(api, 'getSujets').mockResolvedValue([{ id: 's1', titre: 'Marché de Libreville', etat: 'recu' }]);
  vi.spyOn(api, 'getDelays').mockResolvedValue([]);
  vi.spyOn(api, 'subscribeToNotifications').mockResolvedValue({});
});

describe('UploaderView — ordinateur', () => {
  it('ouvre l’espace du pays sur son suivi de la semaine, sur téléphone comme sur ordinateur', async () => {
    // Le suivi vivait sur l'accueil, qui devinait le pays. Il est ici, où
    // l'adresse le dit — une fois pour le téléphone, une fois pour l'ordinateur.
    vi.spyOn(api, 'getDeliveries').mockResolvedValue([]);
    monter('fr');
    await screen.findAllByText('interview.mp4');
    expect(screen.getAllByRole('region', { name: 'Votre semaine en un coup d’œil' })).toHaveLength(2);
    expect(screen.getAllByText('1 fichier envoyé cette semaine · 1 validé')).toHaveLength(2);
  });

  it('se charge et affiche un envoi vidéo avec son icône', async () => {
    monter('fr');
    expect((await screen.findAllByText('interview.mp4')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Marché de Libreville').length).toBeGreaterThan(0);
  });

  it('parle anglais jusqu’aux sections fixes', async () => {
    monter('en');
    await screen.findAllByText('interview.mp4');
    const desktop = document.body;
    expect(within(desktop).getAllByText('Announcements').length).toBeGreaterThan(0);
    expect(within(desktop).queryByText('Annonces')).toBeNull();
    expect(within(desktop).getAllByText('Approved').length).toBeGreaterThan(0);
  });
});

describe('UploaderView — fin d’un envoi', () => {
  it('le fichier arrivé apparaît dans la liste, sans recharger la page', async () => {
    // L'INCIDENT : un envoi TUS se termine sans renvoyer la fiche du
    // fichier. L'écran attendait cette fiche : le reçu disait « Terminé ! »,
    // mais la liste restait à « Aucun fichier » jusqu'au rechargement.
    const arrive = { id: 'f2', name: 'son-du-marche.mp3', type: 'audio', size: '3 MB', sujetId: 's1', status: 'pending' };
    api.getUploads.mockResolvedValueOnce(ENVOIS).mockResolvedValue([...ENVOIS, arrive]);
    vi.spyOn(api, 'uploadFile').mockResolvedValue({ success: true, message: 'Upload terminé avec succès via TUS' });

    monter('fr');
    await screen.findAllByText('interview.mp4');
    expect(screen.queryAllByText('son-du-marche.mp3')).toHaveLength(0);

    const entree = document.querySelector('input[type="file"]');
    fireEvent.change(entree, { target: { files: [new File(['x'], 'son-du-marche.mp3', { type: 'audio/mpeg' })] } });

    await waitFor(() => expect(api.uploadFile).toHaveBeenCalled());
    // Le reçu de l'envoi porte aussi le nom : on attend la liste, qui le
    // montre une seconde fois, avec sa taille.
    expect(await screen.findAllByText(/3 MB/)).not.toHaveLength(0);
    expect(api.getUploads).toHaveBeenLastCalledWith('2026-W34', 'ga');
  });
});

describe('le numéro WhatsApp', () => {
  it('ne fait pas clignoter l’écran d’envoi quand aucun numéro n’est enregistré', () => {
    // L'INCIDENT : l'état partait à « vrai » avant la lecture du numéro :
    // l'écran d'envoi apparaissait une fraction de seconde, puis cédait la
    // place au formulaire. Dès le premier rendu, c'est le formulaire.
    // Le rendu serveur ne joue aucun effet : c'est exactement la première
    // image que voit le correspondant.
    localStorage.setItem('jt-alwm-lang', 'fr');
    const premiereImage = renderToString(
      <I18nProvider>
        <ToastProvider>
          <UploaderView country={PAYS} weeks={SEMAINES} selectedWeek="2026-W34" setSelectedWeek={vi.fn()} onBack={vi.fn()} />
        </ToastProvider>
      </I18nProvider>
    );
    expect(premiereImage).toContain('Votre numéro WhatsApp, avant le premier envoi');
    expect(premiereImage).not.toContain('Envoyer un fichier');
  });

  it('« Modifier » puis « Annuler » garde l’ancien numéro', async () => {
    // L'INCIDENT : « Modifier » effaçait le numéro avant même qu'un nouveau
    // soit donné ; il n'y avait pas d'« Annuler », et quitter la page le
    // perdait.
    monter('fr');
    await screen.findAllByText('interview.mp4');
    fireEvent.click(screen.getByTitle('Modifier le numéro WhatsApp'));
    expect(localStorage.getItem('uploader_phone_ga')).toBe('+24177000000');
    fireEvent.click(screen.getAllByRole('button', { name: 'Annuler' })[0]);
    expect(localStorage.getItem('uploader_phone_ga')).toBe('+24177000000');
    expect(screen.queryByText('Votre numéro WhatsApp, avant le premier envoi')).toBeNull();
  });
});

describe('supprimer un fichier', () => {
  it('dit quoi, d’où, et ce que cela coûte, avec de grands boutons', async () => {
    // « Êtes-vous sûr… irréversible » ne disait ni quel fichier, ni de quel
    // reportage, ni qu'il faudrait le renvoyer ; les deux petits boutons
    // côte à côte se touchaient l'un pour l'autre sur un téléphone.
    monter('fr');
    await screen.findAllByText('interview.mp4');
    fireEvent.click(screen.getAllByRole('button', { name: /Supprimer.*interview\.mp4/ })[0]);
    const boite = (await screen.findAllByRole('dialog')).find((d) => d.textContent.includes('Supprimer ce fichier'));
    expect(boite).toHaveTextContent('Vous allez supprimer la vidéo « interview.mp4 » de « Marché de Libreville ». Si vous changez d’avis, vous devrez la renvoyer.');
    expect(within(boite).getByRole('button', { name: 'Supprimer' }).className).toContain('min-h-[52px]');
  });
});
