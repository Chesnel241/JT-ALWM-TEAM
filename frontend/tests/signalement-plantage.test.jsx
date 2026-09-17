import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';
import { corpsDuSignalement, signalerPlantage, CHEMIN_SIGNALEMENT } from '../src/lib/signalerPlantage.js';

/**
 * Quand le studio s'effondre, quelqu'un doit l'apprendre.
 *
 * L'INCIDENT
 * ----------
 * `ErrorBoundary.componentDidCatch` ne faisait qu'un `console.error`. Un
 * monteur voyait l'écran rouge à Douala un samedi soir, et personne n'était au
 * courant à moins qu'il ne pense à le dire — avant la clôture du dimanche
 * 10h30. `VITE_SENTRY_DSN` était documenté dans trois fichiers, mais aucun
 * code Sentry n'existait côté navigateur : une variable fantôme de plus.
 *
 * LA RÈGLE QUI PRIME SUR LE SIGNALEMENT
 * -------------------------------------
 * Le rapporteur s'exécute au pire moment. S'il lève, il remplace l'écran
 * d'erreur par une page blanche, et le monteur ne sait même plus quoi vous
 * dire. C'est la convention `useOptionalToast` : une feuille n'abat pas son
 * parent.
 */

function Casse() {
  throw new Error('la timeline a explosé pour paul.yaounde@example.org');
}

let erreurConsole;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  // React journalise l'erreur attrapée : on tait le bruit sans masquer les
  // vraies régressions.
  erreurConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  erreurConsole.mockRestore();
  vi.unstubAllGlobals();
});

describe('l’écran d’erreur du studio', () => {
  it('s’affiche même quand le signalement échoue', () => {
    // LE test. Un rapporteur cassé ne doit pas transformer un plantage
    // rattrapé en page blanche.
    vi.stubGlobal('fetch', () => { throw new Error('réseau coupé'); });
    render(<ErrorBoundary><Casse /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: /rafraîchir la page|reload page/i })).toBeInTheDocument();
  });

  it('s’affiche même sans `fetch` du tout', () => {
    // Un navigateur ancien, ou un environnement de test : le studio doit
    // continuer de s'excuser proprement.
    vi.stubGlobal('fetch', undefined);
    render(<ErrorBoundary><Casse /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: /rafraîchir la page|reload page/i })).toBeInTheDocument();
  });

  it('signale le plantage au backend', () => {
    const appels = [];
    vi.stubGlobal('fetch', (url, options) => { appels.push({ url, options }); return Promise.resolve({ ok: true }); });

    render(<ErrorBoundary><Casse /></ErrorBoundary>);

    expect(appels, 'aucun signalement n’est parti').toHaveLength(1);
    expect(appels[0].url).toContain(CHEMIN_SIGNALEMENT);
    expect(appels[0].options.method).toBe('POST');
    // La page est peut-être sur le point d'être rechargée par le monteur.
    expect(appels[0].options.keepalive).toBe(true);
    expect(JSON.parse(appels[0].options.body).message).toMatch(/la timeline a explosé/);
  });

  it('n’envoie aucun mot de passe avec le signalement', () => {
    // La route est publique par nécessité ; lui confier une session
    // n'apporterait rien et l'exposerait.
    localStorage.setItem('app-password', 'sesame-de-session');
    const appels = [];
    vi.stubGlobal('fetch', (url, options) => { appels.push({ url, options }); return Promise.resolve({ ok: true }); });

    render(<ErrorBoundary><Casse /></ErrorBoundary>);

    const entetes = JSON.stringify(appels[0].options.headers || {});
    expect(entetes).not.toMatch(/[Pp]assword|[Tt]oken/);
    expect(appels[0].options.body).not.toMatch(/sesame-de-session/);
  });

  it('avale un rejet asynchrone sans bruit', async () => {
    // Un rejet non traité ferait du bruit dans la console au moment précis où
    // l'on a le plus besoin de la lire.
    vi.stubGlobal('fetch', () => Promise.reject(new Error('hors ligne')));
    render(<ErrorBoundary><Casse /></ErrorBoundary>);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByRole('button', { name: /rafraîchir la page|reload page/i })).toBeInTheDocument();
  });
});

describe('le corps du signalement', () => {
  it('borne ce qu’il emporte', () => {
    // Un plantage en boucle ne doit pas pouvoir remplir le journal du serveur
    // ni le quota d'erreurs de l'association.
    const c = corpsDuSignalement(
      Object.assign(new Error('x'.repeat(5000)), { stack: 'y'.repeat(50000) }),
      { componentStack: 'z'.repeat(5000) },
    );
    expect(c.message).toHaveLength(500);
    expect(c.stack).toHaveLength(4000);
    expect(c.composant).toHaveLength(200);
  });

  it('tient debout sur ce qui n’est pas une erreur', () => {
    // React peut rattraper une valeur lancée qui n'est pas une `Error`.
    expect(() => corpsDuSignalement('juste une chaîne')).not.toThrow();
    expect(() => corpsDuSignalement(undefined)).not.toThrow();
    expect(corpsDuSignalement(null).message).toBe('');
  });

  it('retient la langue du studio, et rien d’autre', () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    expect(corpsDuSignalement(new Error('x')).langue).toBe('en');
    localStorage.setItem('jt-alwm-lang', 'constructor');
    expect(corpsDuSignalement(new Error('x')).langue).toBe('');
  });
});

describe('le rapporteur lui-même', () => {
  it('ne lève jamais, quoi qu’on lui donne', () => {
    expect(signalerPlantage(new Error('x'), {}, { fetch: () => { throw new Error('non'); } })).toBe(false);
    expect(signalerPlantage(undefined, undefined, { fetch: undefined })).toBeTypeOf('boolean');
  });
});
