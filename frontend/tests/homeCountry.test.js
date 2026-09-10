import { describe, it, expect, beforeEach } from 'vitest';
import {
  readLastCountryId,
  saveLastCountryId,
  readHomeCountryId,
  saveHomeCountryId,
  forgetHomeCountry,
  resolveCountry,
} from '../src/lib/homeCountry.js';

const COUNTRIES = [
  { id: 'ga', name: 'Gabon' },
  { id: 'ci', name: "Côte d'Ivoire" },
];

beforeEach(() => {
  localStorage.clear();
});

describe('homeCountry — mémoire par appareil', () => {
  it('ne renvoie rien tant que rien n\'a été mémorisé', () => {
    expect(readHomeCountryId()).toBe('');
    expect(readLastCountryId()).toBe('');
  });

  it('sépare le pays confirmé du simple dernier pays ouvert', () => {
    saveLastCountryId('ci');
    expect(readHomeCountryId()).toBe('');
    expect(readLastCountryId()).toBe('ci');

    saveHomeCountryId('ga');
    expect(readHomeCountryId()).toBe('ga');
    expect(readLastCountryId()).toBe('ci');
  });

  it('oublie le pays confirmé sans toucher au dernier ouvert', () => {
    saveLastCountryId('ci');
    saveHomeCountryId('ga');
    forgetHomeCountry();
    expect(readHomeCountryId()).toBe('');
    expect(readLastCountryId()).toBe('ci');
  });

  it('normalise la casse et les espaces', () => {
    saveHomeCountryId('  GA ');
    expect(readHomeCountryId()).toBe('ga');
  });

  it('survit à un stockage indisponible', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage blocked'); },
    });
    expect(() => saveHomeCountryId('ga')).not.toThrow();
    expect(readHomeCountryId()).toBe('');
    if (original) Object.defineProperty(window, 'localStorage', original);
  });
});

describe('homeCountry — résolution', () => {
  it('retrouve le pays dans la liste courante', () => {
    expect(resolveCountry(COUNTRIES, 'ga')).toEqual({ id: 'ga', name: 'Gabon' });
    expect(resolveCountry(COUNTRIES, 'GA')).toEqual({ id: 'ga', name: 'Gabon' });
  });

  it('renvoie null pour un pays supprimé ou inconnu', () => {
    // Un pays personnalisé peut disparaître côté serveur : on préfère la
    // liste complète à un raccourci qui mène nulle part.
    expect(resolveCountry(COUNTRIES, 'zz')).toBeNull();
    expect(resolveCountry(COUNTRIES, '')).toBeNull();
    expect(resolveCountry(null, 'ga')).toBeNull();
  });
});
