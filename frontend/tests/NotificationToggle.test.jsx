import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationToggle from '../src/components/NotificationToggle.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
// Le fournisseur porte l'état, le conteneur affiche : sans lui, aucun message
// ne serait rendu et le test ne verrait pas ce que la personne voit.
import ToastContainer from '../src/components/Toast.jsx';

/**
 * Le bouton cloche. Deux défauts réels sont couverts ici :
 * la clé publique figée dans le code alors que le serveur a la sienne, et la
 * réponse du serveur ignorée à l'abonnement.
 */

const CLE_SERVEUR = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

let abonnementCourant;
let sAbonner;

function monterPush({ existant = null } = {}) {
  abonnementCourant = existant;
  sAbonner = vi.fn(async () => {
    abonnementCourant = {
      endpoint: 'https://push.example/abc',
      keys: { auth: 'a', p256dh: 'b' },
      unsubscribe: vi.fn(async () => { abonnementCourant = null; return true; }),
    };
    return abonnementCourant;
  });

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          subscribe: (...args) => sAbonner(...args),
          getSubscription: async () => abonnementCourant,
        },
      }),
    },
  });
  window.PushManager = function PushManager() {};
}

function poser(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <NotificationToggle audience="reporter" countryId="ga" {...props} />
        <ToastContainer />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.restoreAllMocks();
  monterPush();
});

afterEach(() => {
  delete window.PushManager;
});

describe('clé publique du serveur', () => {
  it('s’abonne avec la clé que le serveur publie, pas avec celle du code', async () => {
    // Si les deux diffèrent, le serveur ne peut pas signer ses envois :
    // l'abonnement est accepté, la cloche s'allume, et rien n'arrive jamais.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('vapidPublicKey')) {
        return { ok: true, status: 200, json: async () => ({ publicKey: CLE_SERVEUR }) };
      }
      return { ok: true, status: 201, json: async () => ({ success: true }) };
    });

    poser();
    const bouton = await screen.findByRole('button');
    await waitFor(() => expect(bouton).not.toBeDisabled());
    fireEvent.click(bouton);

    await waitFor(() => expect(sAbonner).toHaveBeenCalled());
    const cleEnvoyee = sAbonner.mock.calls[0][0].applicationServerKey;
    // La clé de test fait 65 octets une fois décodée, comme toute clé VAPID.
    expect(cleEnvoyee).toBeInstanceOf(Uint8Array);
    expect(cleEnvoyee.length).toBe(65);
  });

  it('n’offre pas l’abonnement quand le serveur n’a pas de push configuré', async () => {
    // 503 : les clés VAPID manquent côté serveur. Demander l'autorisation du
    // navigateur ne mènerait nulle part.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 503, json: async () => ({ error: 'Push non configuré' }),
    });

    poser();
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
    expect(screen.getByText(/pas activées sur le serveur/i)).toBeInTheDocument();
  });
});

describe('réponse du serveur à l’abonnement', () => {
  it('défait l’abonnement local quand le serveur ne l’a pas gardé', async () => {
    // Sinon le navigateur garde un abonnement fantôme : la cloche paraît
    // allumée, et un nouvel essai retombe dessus sans rien corriger.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('vapidPublicKey')) {
        return { ok: true, status: 200, json: async () => ({ publicKey: CLE_SERVEUR }) };
      }
      return { ok: false, status: 500, json: async () => ({ error: 'boom' }) };
    });

    poser();
    const bouton = await screen.findByRole('button');
    await waitFor(() => expect(bouton).not.toBeDisabled());
    fireEvent.click(bouton);

    await waitFor(() => expect(sAbonner).toHaveBeenCalled());
    await waitFor(() => expect(abonnementCourant).toBeNull());
  });

  it('confirme seulement quand le serveur a vraiment enregistré', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('vapidPublicKey')) {
        return { ok: true, status: 200, json: async () => ({ publicKey: CLE_SERVEUR }) };
      }
      return { ok: true, status: 201, json: async () => ({ success: true }) };
    });

    poser();
    const bouton = await screen.findByRole('button');
    await waitFor(() => expect(bouton).not.toBeDisabled());
    fireEvent.click(bouton);

    expect(await screen.findByText(/c.est activé/i)).toBeInTheDocument();
    // Le message affiché a son propre bouton : on vise la cloche par son
    // libellé exact plutôt que « le bouton » de la page.
    await waitFor(() => expect(
      screen.getByLabelText('Désactiver les notifications')
    ).toHaveAttribute('aria-pressed', 'true'));
  });
});

describe('libellés', () => {
  it('parle la langue de l’interface', async () => {
    // « Activer Notifications » s'affichait tel quel au milieu de l'anglais.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => ({ publicKey: CLE_SERVEUR }),
    });
    localStorage.setItem('jt-alwm-lang', 'en');

    poser();
    const bouton = await screen.findByRole('button');
    expect(bouton.textContent).toMatch(/turn on notifications/i);
    expect(bouton.textContent).not.toMatch(/activer/i);
  });

  it('n’affiche pas de libellé en mode compact, mais le garde pour les lecteurs d’écran', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => ({ publicKey: CLE_SERVEUR }),
    });

    poser({ compact: true });
    const bouton = await screen.findByRole('button');
    expect(bouton.textContent.trim()).toBe('');
    expect(bouton).toHaveAttribute('aria-label', expect.stringMatching(/notification/i));
  });
});

describe('navigateur sans push', () => {
  it('le dit, sans proposer un bouton qui ne ferait rien', async () => {
    delete window.PushManager;
    poser();
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
    expect(screen.getByText(/ne sait pas recevoir/i)).toBeInTheDocument();
  });
});
