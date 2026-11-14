import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { saveAdminPassword, surSessionMontage, readAdminPassword } from '../src/lib/adminSession.js';
import PlanningView from '../src/components/PlanningView.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

/**
 * Une seule porte pour tout l'espace montage.
 *
 * L'INCIDENT (tests de bout en bout, e2e/montage.spec.js) : l'espace montage
 * déverrouillé, « Programmation » et « Stats & Délais » redemandaient le mot
 * de passe. Ces écrans sont montés dès l'ouverture de la page, cachés ; ils
 * lisaient la session à ce moment-là, vide, et plus jamais ensuite.
 */

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});
afterEach(() => vi.restoreAllMocks());

describe('la session du montage', () => {
  it('prévient les écrans déjà ouverts quand le mot de passe est reconnu ailleurs', () => {
    const rappel = vi.fn();
    const arreter = surSessionMontage(rappel);
    saveAdminPassword('mot-de-passe-des-tests');
    expect(rappel).toHaveBeenCalledWith('mot-de-passe-des-tests');
    expect(readAdminPassword()).toBe('mot-de-passe-des-tests');
    arreter();
    saveAdminPassword('un-autre');
    expect(rappel).toHaveBeenCalledTimes(1);
  });

  it('prévient même quand le navigateur refuse le stockage (navigation privée)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('refusé'); });
    const rappel = vi.fn();
    const arreter = surSessionMontage(rappel);
    saveAdminPassword('mot-de-passe-des-tests');
    expect(rappel).toHaveBeenCalledWith('mot-de-passe-des-tests');
    arreter();
  });

  it('la programmation, ouverte verrouillée, s’ouvre dès que l’espace montage est déverrouillé', async () => {
    const lire = vi.spyOn(api, 'getPlanning').mockResolvedValue({ monteurs: [], semaines: {} });
    vi.spyOn(api, 'getPlanningSujets').mockResolvedValue([]);
    render(<I18nProvider><ToastProvider><PlanningView selectedWeek="2026-w46" isActive /></ToastProvider></I18nProvider>);
    // La session est vide : la porte est là, et rien n'est demandé au serveur.
    expect(await screen.findByRole('button', { name: 'Déverrouiller' })).toBeInTheDocument();
    expect(lire).not.toHaveBeenCalled();

    // Le monteur tape son mot de passe dans l'espace montage, pas ici.
    act(() => saveAdminPassword('mot-de-passe-des-tests'));

    await waitFor(() => expect(lire).toHaveBeenCalledWith('mot-de-passe-des-tests'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Déverrouiller' })).toBeNull());
  });
});
