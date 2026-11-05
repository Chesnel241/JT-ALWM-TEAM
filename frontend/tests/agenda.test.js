import { describe, it, expect } from 'vitest';
import { rappelCloture, echapperIcs, plierLigne, dateIcs } from '../src/lib/agenda.js';

const base = {
  cutoffAt: '2026-11-08T08:30:00.000Z',
  paysId: 'cm',
  titre: 'Clôture des envois — Cameroun',
  description: 'Envoyez vos fichiers avant la clôture : https://exemple.org/journalistes/cm',
  alarmeVeille: 'Clôture demain',
  alarme3h: 'Clôture dans 3 heures',
  maintenant: new Date('2026-11-05T12:00:00.000Z'),
};

describe('le rappel de clôture dans l’agenda', () => {
  it('revient chaque semaine, à l’heure de clôture en UTC', () => {
    const ics = rappelCloture(base);
    expect(ics).toContain('DTSTART:20261108T083000Z\r\n');
    expect(ics).toContain('RRULE:FREQ=WEEKLY\r\n');
  });

  it('sonne la veille et 3 h avant', () => {
    const ics = rappelCloture(base);
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('TRIGGER:-PT3H');
  });

  it('garde le même identifiant par pays : réimporter met à jour', () => {
    expect(rappelCloture(base)).toContain('UID:cloture-cm@jt-alwm');
  });

  it('échappe virgules, points-virgules et retours à la ligne', () => {
    expect(echapperIcs('a, b; c\nd\\e')).toBe('a\\, b\; c\\nd\\\\e');
  });

  it('plie les lignes longues à 75 octets sans couper un accent', () => {
    const longue = `DESCRIPTION:${'é'.repeat(80)}`;
    const pliee = plierLigne(longue);
    for (const ligne of pliee.split('\r\n')) {
      expect(new TextEncoder().encode(ligne).length).toBeLessThanOrEqual(75);
    }
    expect(pliee.replace(/\r\n /g, '')).toBe(longue);
  });

  it('refuse une clôture inconnue plutôt que d’écrire une date fausse', () => {
    expect(() => rappelCloture({ ...base, cutoffAt: undefined })).toThrow();
    expect(dateIcs('2026-01-02T03:04:05.678Z')).toBe('20260102T030405Z');
  });
});
