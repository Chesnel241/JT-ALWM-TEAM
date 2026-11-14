import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useRafraichissement, INTERVALLE_MS, INTERVALLE_ECONOME_MS, ECART_MIN_MS } from '../src/hooks/useRafraichissement.js';

/**
 * L'écran d'un correspondant se met à jour seul.
 *
 * L'INCIDENT (tests de bout en bout, e2e/journalistes.spec.js) : un fichier
 * validé ou refusé par le montage, un délai accordé, le JT publié — rien ne
 * s'affichait tant que le correspondant ne rechargeait pas la page.
 * LE BESOIN : relire au retour sur la page, au retour du réseau, et de temps
 * en temps ; jamais page cachée, jamais hors ligne, jamais en rafale.
 */

function Sonde({ relire, ...options }) {
  useRafraichissement(relire, options);
  return null;
}

const visibilite = (etat) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => etat });
  document.dispatchEvent(new Event('visibilitychange'));
};
const enLigne = (oui) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => oui });

beforeEach(() => {
  vi.useFakeTimers();
  visibilite('visible');
  enLigne(true);
  document.documentElement.removeAttribute('data-econome');
});
afterEach(() => {
  vi.useRealTimers();
  visibilite('visible');
  enLigne(true);
});

describe('useRafraichissement', () => {
  it('ne relit pas à l’ouverture : la page vient de tout lire', () => {
    const relire = vi.fn();
    render(<Sonde relire={relire} />);
    expect(relire).not.toHaveBeenCalled();
  });

  it('relit toutes les minutes tant que la page est à l’écran', () => {
    const relire = vi.fn();
    render(<Sonde relire={relire} />);
    vi.advanceTimersByTime(INTERVALLE_MS * 3 + 100);
    expect(relire).toHaveBeenCalledTimes(3);
  });

  it('relit quand on revient sur la page, pas pendant qu’elle est cachée', () => {
    const relire = vi.fn();
    render(<Sonde relire={relire} />);
    visibilite('hidden');
    vi.advanceTimersByTime(INTERVALLE_MS * 5);
    expect(relire).not.toHaveBeenCalled();
    visibilite('visible');
    expect(relire).toHaveBeenCalledTimes(1);
  });

  it('relit au retour de la connexion, pas sans elle', () => {
    const relire = vi.fn();
    render(<Sonde relire={relire} />);
    enLigne(false);
    vi.advanceTimersByTime(INTERVALLE_MS * 2);
    expect(relire).not.toHaveBeenCalled();
    enLigne(true);
    window.dispatchEvent(new Event('online'));
    expect(relire).toHaveBeenCalledTimes(1);
  });

  it('ne relit pas en rafale : « focus » et « visible » arrivent souvent ensemble', () => {
    const relire = vi.fn();
    render(<Sonde relire={relire} />);
    vi.advanceTimersByTime(ECART_MIN_MS + 1);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    expect(relire).toHaveBeenCalledTimes(1);
  });

  it('espace les relectures en mode économe', () => {
    document.documentElement.setAttribute('data-econome', '');
    const relire = vi.fn();
    render(<Sonde relire={relire} />);
    vi.advanceTimersByTime(INTERVALLE_ECONOME_MS - 1000);
    expect(relire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(relire).toHaveBeenCalledTimes(1);
  });

  it('s’arrête quand on le lui demande, et à la fermeture de l’écran', () => {
    const relire = vi.fn();
    const { rerender, unmount } = render(<Sonde relire={relire} actif={false} />);
    vi.advanceTimersByTime(INTERVALLE_MS * 2);
    expect(relire).not.toHaveBeenCalled();
    rerender(<Sonde relire={relire} actif />);
    vi.advanceTimersByTime(INTERVALLE_MS + 100);
    expect(relire).toHaveBeenCalledTimes(1);
    unmount();
    vi.advanceTimersByTime(INTERVALLE_MS * 3);
    window.dispatchEvent(new Event('focus'));
    expect(relire).toHaveBeenCalledTimes(1);
  });

  it('appelle toujours la dernière fonction reçue, sans se réabonner', () => {
    const premiere = vi.fn();
    const seconde = vi.fn();
    const { rerender } = render(<Sonde relire={premiere} />);
    rerender(<Sonde relire={seconde} />);
    vi.advanceTimersByTime(INTERVALLE_MS + 100);
    expect(premiere).not.toHaveBeenCalled();
    expect(seconde).toHaveBeenCalledTimes(1);
  });

  it('survit à une relecture qui lève une erreur', () => {
    const relire = vi.fn(() => { throw new Error('serveur occupé'); });
    render(<Sonde relire={relire} />);
    expect(() => vi.advanceTimersByTime(INTERVALLE_MS * 2 + 100)).not.toThrow();
    expect(relire).toHaveBeenCalledTimes(2);
  });
});
