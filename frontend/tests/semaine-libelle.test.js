import { describe, it, expect } from 'vitest';
import {
  formatWeekLabel,
  formatWeekFull,
  formatWeekTechnical,
  formatWeekDates,
} from '../src/lib/dates.js';

// La semaine ouverte au moment de l'audit : la rédaction l'appelle « Sem. 18 »,
// la norme internationale « 37 ». Dix-neuf d'écart, et les deux s'affichaient
// côte à côte dans la même application.
const SEMAINE = {
  id: '2026-w37',
  num: 37,
  name: 'Semaine 37',
  libelle: 'Sem. 18',
  startDate: '2026-09-07T00:00:00.000Z',
  endDate: '2026-09-13T23:59:59.999Z',
  status: 'active',
};

const SANS_LIBELLE = { ...SEMAINE, libelle: '' };

describe('nom d’une semaine', () => {
  it('dit le nom que la rédaction prononce', () => {
    expect(formatWeekLabel(SEMAINE, 'fr')).toBe('Sem. 18');
    expect(formatWeekLabel(SEMAINE, 'en')).toBe('Sem. 18');
  });

  it('retombe sur le numéro international quand la semaine n’est pas programmée', () => {
    expect(formatWeekLabel(SANS_LIBELLE, 'fr')).toBe('Semaine 37');
    expect(formatWeekLabel(SANS_LIBELLE, 'en')).toBe('Week 37');
  });

  it('ignore un libellé vide ou fait d’espaces', () => {
    expect(formatWeekLabel({ ...SEMAINE, libelle: '   ' }, 'fr')).toBe('Semaine 37');
    expect(formatWeekLabel({ ...SEMAINE, libelle: null }, 'fr')).toBe('Semaine 37');
  });

  it('ne lève pas sur une semaine absente', () => {
    expect(() => formatWeekLabel(undefined, 'fr')).not.toThrow();
    expect(() => formatWeekFull(null, 'fr')).not.toThrow();
  });
});

describe('forme complète, celle des sélecteurs', () => {
  it('accole le nom et les dates, pour lever l’ambiguïté du seul numéro', () => {
    const complet = formatWeekFull(SEMAINE, 'fr');
    expect(complet).toContain('Sem. 18');
    expect(complet).toContain(formatWeekDates(SEMAINE, 'fr'));
    expect(complet).toMatch(/·/);
  });

  it('se contente du nom quand les dates manquent', () => {
    expect(formatWeekFull({ libelle: 'Sem. 18' }, 'fr')).toBe('Sem. 18');
  });
});

describe('identifiant technique', () => {
  it('reste disponible pour le support', () => {
    // C'est cette chaîne qu'on demande à quelqu'un qui signale un problème.
    expect(formatWeekTechnical(SEMAINE)).toBe('2026-w37');
    expect(formatWeekTechnical(undefined)).toBe('');
  });
});
