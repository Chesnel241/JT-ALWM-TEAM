import { describe, it, expect, beforeEach } from 'vitest';
import {
  readReporterToken,
  saveReporterToken,
  forgetReporterToken,
  adoptTokenFromSearch,
} from '../src/lib/reporterIdentity.js';

beforeEach(() => localStorage.clear());

describe('identité du correspondant', () => {
  it('ne connaît personne au premier lancement', () => {
    expect(readReporterToken()).toBe('');
  });

  it('adopte le jeton reçu dans le lien, puis le retient', () => {
    expect(adoptTokenFromSearch('?k=abc.def')).toBe(true);
    expect(readReporterToken()).toBe('abc.def');
  });

  it('ignore un lien sans jeton', () => {
    expect(adoptTokenFromSearch('')).toBe(false);
    expect(adoptTokenFromSearch('?pays=sn')).toBe(false);
    expect(adoptTokenFromSearch('?k=')).toBe(false);
    expect(readReporterToken()).toBe('');
  });

  it('oublie le jeton sur demande', () => {
    saveReporterToken('abc');
    forgetReporterToken();
    expect(readReporterToken()).toBe('');
  });

  it('survit à un stockage indisponible', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage blocked'); },
    });
    expect(() => saveReporterToken('abc')).not.toThrow();
    expect(readReporterToken()).toBe('');
    if (original) Object.defineProperty(window, 'localStorage', original);
  });
});
