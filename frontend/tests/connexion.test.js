import { describe, it, expect } from 'vitest';
import { estConnexionFaible, suivreConnexion } from '../src/lib/connexion.js';

describe('le mode connexion faible', () => {
  it('se déclenche sur l’économie de données, une 2G/3G, ou la préférence du système', () => {
    expect(estConnexionFaible({ connection: { saveData: true, effectiveType: '4g' } })).toBe(true);
    expect(estConnexionFaible({ connection: { effectiveType: '3g' } })).toBe(true);
    expect(estConnexionFaible({ connection: { effectiveType: '4g' } })).toBe(false);
    expect(estConnexionFaible({ donneesReduites: true })).toBe(true);
    expect(estConnexionFaible({})).toBe(false);
  });

  it('pose et retire data-econome sur <html> quand la connexion change', () => {
    const ecouteurs = {};
    const connection = { effectiveType: '3g', saveData: false, addEventListener: (e, f) => { ecouteurs[e] = f; }, removeEventListener: () => {} };
    const fenetre = { document, navigator: { connection }, matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) };
    const arreter = suivreConnexion(fenetre);
    expect(document.documentElement.hasAttribute('data-econome')).toBe(true);
    connection.effectiveType = '4g';
    ecouteurs.change();
    expect(document.documentElement.hasAttribute('data-econome')).toBe(false);
    arreter();
  });
});
