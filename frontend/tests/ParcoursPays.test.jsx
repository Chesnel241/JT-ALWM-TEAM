import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ParcoursPays from '../src/components/ParcoursPays.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

/**
 * Le suivi de la semaine d'un pays : vos fichiers, votre voix off, le JT.
 *
 * LE BESOIN : sans compte utilisateur, rien ne disait au correspondant où il
 * en était. Trois étapes reliées le lui montrent d'un coup d'œil. Le suivi
 * vivait sur l'accueil, qui devinait le pays ; il est maintenant en tête de
 * l'espace du pays, où l'adresse le dit.
 */

function monter(props = {}) {
  return render(
    <I18nProvider>
      <ParcoursPays weekId="2026-w44" {...props} />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.spyOn(api, 'getDeliveries').mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe('ParcoursPays', () => {
  it('une semaine vide : « Vos fichiers » est à envoyer, et c’est à vous', () => {
    const { container } = monter({ fichiers: [] });
    expect(screen.getByText('À envoyer')).toBeInTheDocument();
    expect(screen.getByText('À vous')).toBeInTheDocument();
    expect(container.querySelector('.jr-etape[data-avous]')?.dataset.etat).toBe('aFaire');
  });

  it('des fichiers reçus et validés : l’étape est faite, et le dit', () => {
    monter({ fichiers: [{ id: 'a', name: 'rush.mp4', type: 'video', status: 'approved' }] });
    expect(screen.getByText('1 fichier envoyé cette semaine · 1 validé')).toBeInTheDocument();
    expect(screen.queryByText('À vous')).toBeNull();
  });

  it('un fichier refusé : un bouton orange mène aux fichiers à corriger', () => {
    const onVoirFichiers = vi.fn();
    monter({ fichiers: [{ id: 'a', name: 'rush.mp4', type: 'video', status: 'rejected' }], onVoirFichiers });
    fireEvent.click(screen.getByText('Voir ce qui est demandé'));
    expect(onVoirFichiers).toHaveBeenCalled();
  });

  it('le JT publié : l’étape annonce « Prêt à télécharger »', async () => {
    api.getDeliveries.mockResolvedValue([{ id: 'jt', name: 'JT.mp4' }]);
    monter({ fichiers: [] });
    expect(await screen.findByText('Prêt à télécharger')).toBeInTheDocument();
  });

  it('chaque étape ouvre l’écran qui la concerne', () => {
    const appels = { onVoirFichiers: vi.fn(), onOpenVoixOff: vi.fn(), onOpenDelivery: vi.fn() };
    monter({ fichiers: [], ...appels });
    fireEvent.click(screen.getByText('Vos fichiers'));
    fireEvent.click(screen.getByText('Votre voix off'));
    fireEvent.click(screen.getByText('Le JT de la semaine'));
    for (const appel of Object.values(appels)) expect(appel).toHaveBeenCalledTimes(1);
  });
});
