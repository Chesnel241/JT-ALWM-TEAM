import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import RubriqueView from '../src/components/RubriqueView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import { ecrireBrouillon, cleRubrique } from '../src/lib/brouillon.js';

/**
 * Le conducteur est le seul écran de la plateforme où l'on écrit longtemps, et
 * c'était le seul où rien ne protégeait ce qui était écrit. Ces tests décrivent
 * les trois filets : brouillon local, enregistrement automatique, révision.
 */

const SEMAINE = '2026-w37';

const RUBRIQUE_CONDUCTEUR = {
  cle: 'conducteur',
  nom: 'Conducteur du JT',
  description: 'Le déroulé du journal.',
  libelleFichier: 'La voix off (audio)',
  natureFichier: 'audio',
  champs: [
    { cle: 'texte', libelle: 'Le conducteur', multiligne: true, max: 20000 },
    { cle: 'texteVoixOff', libelle: 'Texte de la voix off', multiligne: true, max: 20000 },
  ],
};

function poser(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <RubriqueView cle="conducteur" selectedWeek={SEMAINE} isActive {...props} />
      </ToastProvider>
    </I18nProvider>
  );
}

function champConducteur() {
  return document.getElementById('rubrique-conducteur-texte');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.restoreAllMocks();

  vi.spyOn(api, 'getRubrique').mockResolvedValue({
    rubrique: RUBRIQUE_CONDUCTEUR,
    champs: { texte: 'Ouverture plateau.', texteVoixOff: '' },
    revision: 4,
    majLe: '2026-09-12T08:00:00.000Z',
  });
  vi.spyOn(api, 'getUploads').mockResolvedValue([]);
  vi.spyOn(api, 'getSujets').mockResolvedValue([]);
  vi.spyOn(api, 'setRubrique').mockResolvedValue({
    conflit: false, revision: 5, majLe: new Date().toISOString(),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('enregistrement automatique', () => {
  it('n’envoie qu’une seule fois après la dernière frappe', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    poser();
    const champ = await screen.findByDisplayValue('Ouverture plateau.');

    // Trois frappes rapprochées : sur une connexion mobile facturée au
    // volume, une requête par lettre serait indéfendable.
    fireEvent.change(champ, { target: { value: 'O' } });
    fireEvent.change(champ, { target: { value: 'Ou' } });
    fireEvent.change(champ, { target: { value: 'Ouv' } });
    expect(api.setRubrique).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(api.setRubrique).toHaveBeenCalledTimes(1);
    expect(api.setRubrique.mock.calls[0][2]).toEqual(
      expect.objectContaining({ texte: 'Ouv' })
    );
  });

  it('envoie la révision reçue, pour ne pas écraser un autre rédacteur', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    poser();
    const champ = await screen.findByDisplayValue('Ouverture plateau.');
    fireEvent.change(champ, { target: { value: 'Nouveau texte.' } });
    await act(async () => { vi.advanceTimersByTime(2100); });

    expect(api.setRubrique).toHaveBeenCalledWith(SEMAINE, 'conducteur', expect.any(Object), 4);
  });

  it('garde un brouillon local dès la frappe, avant même le serveur', () => {
    poser();
    return waitFor(() => expect(champConducteur()).toBeTruthy()).then(() => {
      fireEvent.change(champConducteur(), { target: { value: 'Texte non encore parti.' } });
      const brut = localStorage.getItem(`jt-brouillon:${cleRubrique(SEMAINE, 'conducteur')}`);
      expect(brut).toContain('Texte non encore parti.');
    });
  });
});

describe('conflit d’écriture', () => {
  it('n’écrase pas la saisie et propose la version à jour', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.setRubrique.mockResolvedValue({
      conflit: true,
      revision: 9,
      majLe: new Date().toISOString(),
      texte: 'Ce que l’autre personne a écrit.',
    });

    poser();
    const champ = await screen.findByDisplayValue('Ouverture plateau.');
    fireEvent.change(champ, { target: { value: 'Ma version à moi.' } });
    await act(async () => { vi.advanceTimersByTime(2100); });

    expect(await screen.findByRole('alert')).toHaveTextContent(/modifié cette rubrique/i);
    // Le point essentiel : ce que la personne a tapé est toujours là.
    expect(champConducteur().value).toBe('Ma version à moi.');
  });
});

describe('brouillon plus récent que le serveur', () => {
  it('le propose, mais ne l’applique jamais en silence', async () => {
    // La personne doit savoir d'où vient le texte qu'elle a sous les yeux.
    ecrireBrouillon(cleRubrique(SEMAINE, 'conducteur'), { texte: 'Brouillon du téléphone.' });

    poser();
    await screen.findByDisplayValue('Ouverture plateau.');
    expect(screen.getByText('Brouillon gardé sur cet appareil')).toBeInTheDocument();
    // Tant qu'on n'a pas choisi, l'écran montre la version du serveur.
    expect(champConducteur().value).toBe('Ouverture plateau.');
  });

  it('l’applique quand on le demande', async () => {
    ecrireBrouillon(cleRubrique(SEMAINE, 'conducteur'), { texte: 'Brouillon du téléphone.' });
    poser();
    await screen.findByDisplayValue('Ouverture plateau.');

    fireEvent.click(screen.getByText('Voir la version à jour'));
    await waitFor(() => expect(champConducteur().value).toBe('Brouillon du téléphone.'));
  });
});

describe('envoi du fichier', () => {
  it('montre une progression et peut être annulé', async () => {
    // C'est l'écran dont le fichier est une vidéo : une roue sans chiffre
    // pendant dix minutes ne dit pas si quelque chose avance.
    let signalerProgression;
    vi.spyOn(api, 'uploadFile').mockImplementation((_w, _b, _f, options) => {
      signalerProgression = options.onProgress;
      return new Promise(() => {}); // jamais résolu : l'envoi reste en cours
    });

    poser();
    await screen.findByDisplayValue('Ouverture plateau.');

    const entree = document.querySelector('input[type="file"]');
    const fichier = new File(['x'], 'intervenant.mp4', { type: 'video/mp4' });
    fireEvent.change(entree, { target: { files: [fichier] } });

    await waitFor(() => expect(api.uploadFile).toHaveBeenCalled());
    act(() => signalerProgression(42));

    expect(await screen.findByText(/42 %/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText(/annuler l.envoi/i)).toBeInTheDocument();
  });
});

describe('insertion du déroulé', () => {
  it('ajoute les reportages reçus sans écraser ce qui est déjà écrit', async () => {
    api.getSujets.mockResolvedValue([
      { id: 's1', countryId: 'cm', titre: 'Le marché de Douala', duree: 102 },
      { id: 's2', countryId: 'sn', titre: 'Le port de Dakar', duree: null },
    ]);

    poser();
    await screen.findByDisplayValue('Ouverture plateau.');
    fireEvent.click(await screen.findByText('Insérer les reportages reçus'));

    await waitFor(() => {
      const valeur = champConducteur().value;
      // Ce qui était là reste là : écraser le texte de quelqu'un pour lui
      // rendre service serait exactement le contraire du service.
      expect(valeur).toContain('Ouverture plateau.');
      expect(valeur).toContain('Le marché de Douala');
      expect(valeur).toContain('1 min 42');
      expect(valeur).toContain('Le port de Dakar');
    });
  });
});

describe('langue', () => {
  it('ne laisse plus l’écran en français quand l’interface est en anglais', async () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    poser({ onBack: () => {} });
    await screen.findByDisplayValue('Ouverture plateau.');

    expect(screen.queryByText('Retour')).not.toBeInTheDocument();
    expect(screen.queryByText('Choisir un fichier')).not.toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });
});
