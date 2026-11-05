import { describe, it, expect } from 'vitest';
import { echeanceApresDelai, heureCourte } from '../src/lib/delais.js';

/**
 * L'heure qu'un bouton de délai donnera, affichée avant le clic.
 *
 * L'INCIDENT : « +1 h » partait de l'heure du clic, et pouvait raccourcir un
 * délai déjà accordé. Le serveur ajoute maintenant le délai à l'échéance en
 * vigueur ; l'écran fait le même calcul pour l'annoncer.
 */
const H = 3600 * 1000;
const CLOTURE = '2026-11-08T08:30:00.000Z';

describe('echeanceApresDelai', () => {
  it('avant la clôture : la clôture plus le délai', () => {
    const r = echeanceApresDelai({ cutoffAt: CLOTURE, minutes: 60, maintenant: new Date('2026-11-07T10:00:00Z') });
    expect(r.toISOString()).toBe('2026-11-08T09:30:00.000Z');
  });

  it('un délai déjà accordé au pays : on part de lui', () => {
    const demande = { status: 'approved', extendedUntil: '2026-11-08T20:30:00.000Z' };
    const r = echeanceApresDelai({ cutoffAt: CLOTURE, demande, minutes: 60, maintenant: new Date('2026-11-08T12:00:00Z') });
    expect(r.getTime()).toBe(new Date('2026-11-08T20:30:00Z').getTime() + H);
  });

  it('une demande seulement en attente ne compte pas', () => {
    const demande = { status: 'pending', extendedUntil: null };
    const r = echeanceApresDelai({ cutoffAt: CLOTURE, demande, minutes: 60, maintenant: new Date('2026-11-08T12:00:00Z') });
    expect(r.toISOString()).toBe('2026-11-08T13:00:00.000Z');
  });

  it('le délai global repousse aussi le point de départ', () => {
    const global = { extendedUntil: '2026-11-08T11:30:00.000Z' };
    const r = echeanceApresDelai({ cutoffAt: CLOTURE, global, minutes: 180, maintenant: new Date('2026-11-08T09:00:00Z') });
    expect(r.toISOString()).toBe('2026-11-08T14:30:00.000Z');
  });
});

describe('heureCourte', () => {
  it('dit le jour et l’heure dans le fuseau demandé', () => {
    expect(heureCourte(new Date('2026-11-08T13:00:00Z'), 'fr', 'Africa/Douala')).toBe('dim. 14:00');
  });
});
