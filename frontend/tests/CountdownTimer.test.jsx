import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

/**
 * Le compte à rebours dit l'heure du correspondant, et sa couleur dit
 * l'urgence.
 *
 * LE BESOIN : un journaliste en GMT-3 lisait « dimanche 10h30 (GMT+2) » et
 * devait retrancher cinq heures de tête. Ici, le navigateur est placé à São
 * Paulo : l'écran doit annoncer 05h30, « votre heure (GMT-3) », et rappeler
 * l'heure de la rédaction en petit.
 */

vi.mock('../src/lib/echeance.js', async (original) => ({
  ...(await original()),
  fuseauNavigateur: () => 'America/Sao_Paulo',
}));

const { default: CountdownTimer } = await import('../src/components/CountdownTimer.jsx');

// Dimanche 1er novembre 2026, 10h30 GMT+2.
const SEMAINE = { id: '2026-w44', startDate: '2026-10-25T22:00:00.000Z', cutoffAt: '2026-11-01T08:30:00.000Z' };

function monter(props, lang = 'fr') {
  localStorage.setItem('jt-alwm-lang', lang);
  return render(<I18nProvider><CountdownTimer week={SEMAINE} {...props} /></I18nProvider>);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('CountdownTimer', () => {
  it('annonce la clôture dans l’heure du correspondant, et la référence de la rédaction', () => {
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const { container } = monter();
    expect(screen.getByText('Clôture : dimanche 1 nov. à 05h30')).toBeInTheDocument();
    expect(screen.getByText('votre heure (GMT-3)')).toBeInTheDocument();
    expect(container.textContent).toContain('10h30 GMT+2 à la rédaction');
  });

  it.each([
    ['2026-10-28T12:00:00Z', 'serein', 'Vous avez le temps'],
    ['2026-10-31T08:30:00Z', 'proche', 'Pensez à envoyer bientôt'],
    ['2026-11-01T02:00:00Z', 'urgent', 'Dernières heures : envoyez maintenant'],
    ['2026-11-01T09:00:00Z', 'clos', 'Les envois de la semaine sont clôturés'],
  ])('à %s : phase %s', (instant, phase, libelle) => {
    vi.setSystemTime(new Date(instant));
    const { container } = monter();
    expect(container.querySelector('.cr').dataset.phase).toBe(phase);
    expect(screen.getByText(libelle)).toBeInTheDocument();
  });

  it('les chiffres suivent le temps qui passe', () => {
    vi.setSystemTime(new Date('2026-11-01T06:29:58Z'));
    const { container } = monter();
    const lire = () => [...container.querySelectorAll('.cr-case')].map((c) => c.textContent).join('');
    expect(lire()).toBe('00020002');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(lire()).toBe('00015959');
  });

  it('marque aujourd’hui sur le ruban de la semaine, dans le calendrier du correspondant', () => {
    // Mercredi 28 octobre à São Paulo.
    vi.setSystemTime(new Date('2026-10-28T15:00:00Z'));
    const { container } = monter();
    const jours = [...container.querySelectorAll('.cr-jour')];
    expect(jours).toHaveLength(7);
    expect(jours[2].dataset.etat).toBe('aujourdhui');
    expect(screen.getByText('Aujourd’hui')).toBeInTheDocument();
  });

  it('en version compacte, garde la couleur, le temps et l’heure locale', () => {
    vi.setSystemTime(new Date('2026-11-01T06:00:00Z'));
    const { container } = monter({ compact: true });
    expect(container.querySelector('.cr').dataset.phase).toBe('urgent');
    expect(screen.getByText('02:30:00')).toBeInTheDocument();
    expect(container.textContent).toContain('Clôture : dimanche 05h30 · votre heure (GMT-3)');
  });

  it('se lit d’une phrase par un lecteur d’écran, sans égrener les secondes', () => {
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    monter({}, 'en');
    const minuteur = screen.getByRole('timer');
    expect(minuteur).toHaveAccessibleName(/Time left to send: 3 days 20 hours\. Deadline: Sunday, Nov 1 at 5:30 AM, your time \(GMT-3\)/);
  });
});
