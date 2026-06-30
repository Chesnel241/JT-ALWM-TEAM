import { describe, it, expect } from 'vitest';
import { buildWeeks, weekIdFor, weekExpiryDate } from '../src/data/constants.js';

// Helper : date locale au jour/heure indiqués (évite les pièges UTC).
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);

describe('buildWeeks — règle "cycle 9 jours"', () => {
  it('renvoie 3 semaines le lundi (previous + current + next)', () => {
    const monday = at(2026, 5, 18); // lundi semaine 21
    const weeks = buildWeeks(monday);
    expect(weeks).toHaveLength(3);
    expect(weeks.map((w) => w.status)).toEqual(['archived', 'active', 'upcoming']);
    expect(weeks[1].id).toBe('2026-w21');
    expect(weeks[0].id).toBe('2026-w20');
    expect(weeks[2].id).toBe('2026-w22');
  });

  it('renvoie 3 semaines le mardi', () => {
    const tuesday = at(2026, 5, 19); // mardi semaine 21
    const weeks = buildWeeks(tuesday);
    expect(weeks).toHaveLength(3);
    expect(weeks.map((w) => w.status)).toEqual(['archived', 'active', 'upcoming']);
  });

  it('renvoie 2 semaines à partir du mercredi (previous disparaît)', () => {
    const wednesday = at(2026, 5, 20); // mercredi semaine 21
    const weeks = buildWeeks(wednesday);
    expect(weeks).toHaveLength(2);
    expect(weeks.map((w) => w.status)).toEqual(['active', 'upcoming']);
    expect(weeks[0].id).toBe('2026-w21');
    expect(weeks[1].id).toBe('2026-w22');
  });

  it('renvoie 2 semaines le jeudi, vendredi, samedi, dimanche', () => {
    for (const day of [21, 22, 23, 24]) { // jeu, ven, sam, dim
      const weeks = buildWeeks(at(2026, 5, day));
      expect(weeks).toHaveLength(2);
      expect(weeks[0].id).toBe('2026-w21');
      expect(weeks[1].id).toBe('2026-w22');
    }
  });

  it('mercredi 00:00 = limite de bascule (precedente déjà absente)', () => {
    const wedMidnight = at(2026, 5, 20, 0); // mercredi 00:00
    const weeks = buildWeeks(wedMidnight);
    expect(weeks).toHaveLength(2);
  });

  it('mardi 23:59 = encore visible', () => {
    const tueLate = new Date(2026, 4, 19, 23, 59, 0);
    const weeks = buildWeeks(tueLate);
    expect(weeks).toHaveLength(3);
  });

  it('produit des IDs ISO 8601 stables (YYYY-wWW)', () => {
    const weeks = buildWeeks(at(2026, 5, 18));
    weeks.forEach((w) => expect(w.id).toMatch(/^\d{4}-w\d{2}$/));
  });

  it('gère le passage d\'année (semaine 1 de l\'année suivante)', () => {
    const lateDec = at(2026, 12, 29); // mardi semaine 53
    const weeks = buildWeeks(lateDec);
    // mardi → 3 semaines visibles, dont une qui sera w-01 2027
    expect(weeks.some((w) => w.id === '2027-w01')).toBe(true);
  });
});

describe('weekIdFor', () => {
  it('retourne lID ISO pour un mercredi', () => {
    expect(weekIdFor(at(2026, 5, 20))).toBe('2026-w21');
  });

  it('retourne le même ID pour tous les jours d\'une même semaine ISO', () => {
    for (const day of [18, 19, 20, 21, 22, 23, 24]) {
      expect(weekIdFor(at(2026, 5, day))).toBe('2026-w21');
    }
  });
});

describe('weekExpiryDate — purge mercredi 00:00 de la semaine suivante', () => {
  it('expire à mercredi 00:00 de la semaine W+1', () => {
    const expiry = weekExpiryDate('2026-w20');
    // semaine 20 = 11-17 mai. Expire mer 20 mai 00:00:00.001 (en local)
    expect(expiry.getFullYear()).toBe(2026);
    expect(expiry.getMonth()).toBe(4); // mai = 4
    expect(expiry.getDate()).toBe(20);
    expect(expiry.getHours()).toBe(0);
  });

  it('renvoie null pour un ID non reconnu (legacy w-43)', () => {
    expect(weekExpiryDate('w-43')).toBeNull();
    expect(weekExpiryDate('random')).toBeNull();
    expect(weekExpiryDate('')).toBeNull();
  });

  it('expire correctement à la transition d\'année', () => {
    const expiry = weekExpiryDate('2026-w53');
    // semaine 53 2026 = 28 déc - 3 jan 2027. Expire mer 6 jan 2027.
    expect(expiry.getFullYear()).toBe(2027);
    expect(expiry.getDate()).toBe(6);
  });

  it('une semaine expire bien 9 jours après son lundi', () => {
    // Semaine 20 2026 commence lundi 11 mai. Expire mercredi 20 mai 00:00.
    // 20 - 11 = 9 jours après le lundi.
    const expiry = weekExpiryDate('2026-w20');
    const monday = at(2026, 5, 11, 0);
    const diffDays = (expiry - monday) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(9);
  });
});
