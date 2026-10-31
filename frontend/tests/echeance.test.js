import { describe, it, expect } from 'vitest';
import {
  echeanceLocale,
  decalageMinutes,
  libelleDecalage,
  prochaineCloture,
  phaseEcheance,
  cadencePouls,
  decompte,
  SEUILS,
} from '../src/lib/echeance.js';

/**
 * L'heure limite, lue dans l'heure du correspondant.
 *
 * LE BESOIN : la clôture est dimanche 10h30 à l'heure de la rédaction
 * (GMT+2). L'écran l'écrivait ainsi à tout le monde ; un correspondant de
 * São Paulo devait retrancher cinq heures de tête, et celui de Douala une
 * — certains envoyaient en croyant avoir encore le temps. Testé comme des
 * mathématiques : le fuseau et l'instant sont des arguments.
 */

// Dimanche 1er novembre 2026, 10h30 GMT+2 : l'instant que le serveur donne.
const CLOTURE = '2026-11-01T08:30:00.000Z';

describe('la même clôture, lue partout dans le monde', () => {
  it.each([
    ['America/Sao_Paulo', 'dimanche 1 nov. à 05h30', 'GMT-3'],
    ['Africa/Douala', 'dimanche 1 nov. à 09h30', 'GMT+1'],
    ['Africa/Kinshasa', 'dimanche 1 nov. à 09h30', 'GMT+1'],
    ['Africa/Dakar', 'dimanche 1 nov. à 08h30', 'GMT+0'],
    ['Africa/Johannesburg', 'dimanche 1 nov. à 10h30', 'GMT+2'],
    ['Asia/Kolkata', 'dimanche 1 nov. à 14h00', 'GMT+5:30'],
  ])('à %s : %s (%s)', (timeZone, complet, fuseau) => {
    const e = echeanceLocale(CLOTURE, { timeZone });
    expect(e.complet).toBe(complet);
    expect(e.fuseau).toBe(fuseau);
  });

  it('change de jour quand le décalage l’exige : samedi soir à Honolulu', () => {
    const e = echeanceLocale(CLOTURE, { timeZone: 'Pacific/Honolulu' });
    expect(e.jour).toBe('samedi');
    expect(e.heure).toBe('22h30');
  });

  it('parle anglais avec une heure à l’anglaise', () => {
    const e = echeanceLocale(CLOTURE, { timeZone: 'America/Sao_Paulo', lang: 'en' });
    expect(e.complet).toBe('Sunday, Nov 1 at 5:30 AM');
    expect(e.reference).toBe('10:30 AM GMT+2');
  });

  it('rappelle toujours l’heure de la rédaction, et sait quand c’est la même', () => {
    expect(echeanceLocale(CLOTURE, { timeZone: 'Africa/Douala' }).reference).toBe('10h30 GMT+2');
    expect(echeanceLocale(CLOTURE, { timeZone: 'Africa/Douala' }).memeHeureQueRedaction).toBe(false);
    expect(echeanceLocale(CLOTURE, { timeZone: 'Africa/Johannesburg' }).memeHeureQueRedaction).toBe(true);
  });

  it('suit l’heure d’été sans table à tenir', () => {
    // Paris passe de GMT+2 à GMT+1 le dernier dimanche d'octobre.
    expect(decalageMinutes('2026-10-18T08:30:00Z', 'Europe/Paris')).toBe(120);
    expect(decalageMinutes('2026-11-01T08:30:00Z', 'Europe/Paris')).toBe(60);
  });

  it('ne casse rien sur une donnée absente ou fausse', () => {
    expect(echeanceLocale(null)).toBeNull();
    expect(echeanceLocale('pas une date')).toBeNull();
  });
});

describe('libelleDecalage', () => {
  it('écrit le décalage comme sur une horloge murale', () => {
    expect(libelleDecalage(60)).toBe('GMT+1');
    expect(libelleDecalage(-180)).toBe('GMT-3');
    expect(libelleDecalage(330)).toBe('GMT+5:30');
    expect(libelleDecalage(0)).toBe('GMT+0');
  });
});

describe('prochaineCloture', () => {
  it('est le dimanche suivant à 08h30 UTC', () => {
    expect(prochaineCloture(new Date('2026-10-28T12:00:00Z')).toISOString()).toBe(CLOTURE);
    expect(prochaineCloture(new Date('2026-11-01T08:29:00Z')).toISOString()).toBe(CLOTURE);
  });

  it('passe à la semaine suivante dès la clôture atteinte', () => {
    expect(prochaineCloture(new Date(CLOTURE)).toISOString()).toBe('2026-11-08T08:30:00.000Z');
  });
});

describe('la couleur du temps qui reste', () => {
  const H = 3600 * 1000;

  it('vert au-delà de 48 h, orange jusqu’à 12 h, rouge en dessous, puis clos', () => {
    expect(phaseEcheance(SEUILS.procheMs + 1)).toBe('serein');
    expect(phaseEcheance(48 * H)).toBe('proche');
    expect(phaseEcheance(12 * H + 1)).toBe('proche');
    expect(phaseEcheance(12 * H)).toBe('urgent');
    expect(phaseEcheance(1)).toBe('urgent');
    expect(phaseEcheance(0)).toBe('clos');
    expect(phaseEcheance(-5000)).toBe('clos');
    expect(phaseEcheance(Number.NaN)).toBe('clos');
  });

  it('le halo bat de plus en plus vite dans la dernière heure', () => {
    expect(cadencePouls(72 * H)).toBe(4);
    expect(cadencePouls(24 * H)).toBe(3);
    expect(cadencePouls(5 * H)).toBe(2);
    expect(cadencePouls(30 * 60 * 1000)).toBeLessThan(2);
    expect(cadencePouls(1000)).toBeCloseTo(0.6, 1);
    expect(cadencePouls(0)).toBe(0);
  });
});

describe('decompte', () => {
  it('découpe le temps en jours, heures, minutes, secondes', () => {
    expect(decompte(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000)).toEqual({ jours: 2, heures: 3, minutes: 4, secondes: 5 });
    expect(decompte(-61000)).toEqual({ jours: 0, heures: 0, minutes: 1, secondes: 1 });
  });
});
