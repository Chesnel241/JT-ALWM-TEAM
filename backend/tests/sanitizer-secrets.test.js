import { describe, it, expect } from 'vitest';
import { sanitizeParams } from '../src/middleware/sanitizer.js';

/**
 * Régression login — root cause d'un "Mot de passe incorrect" alors que le
 * bon mot de passe est saisi : sanitizeParams() s'exécute en middleware
 * global AVANT auth.js et strippait les `<` `>` du corps de requête. Un
 * GLOBAL_PASSWORD/ADMIN_PASSWORD contenant ces caractères (lu depuis l'env,
 * jamais sanitizé) ne pouvait alors JAMAIS matcher le mot de passe saisi.
 */
describe('sanitizeParams — préservation des champs secrets', () => {
  it("ne strippe pas les < > d'un champ password", () => {
    expect(sanitizeParams({ password: 'Alwm<Jt>2026' }).password).toBe('Alwm<Jt>2026');
  });

  it("ne strippe pas les < > d'un champ adminPassword", () => {
    expect(sanitizeParams({ adminPassword: 'Adm<i>n' }).adminPassword).toBe('Adm<i>n');
  });

  it('préserve token et secret', () => {
    expect(sanitizeParams({ token: 'a<b>c' }).token).toBe('a<b>c');
    expect(sanitizeParams({ apiSecret: 'x<y>' }).apiSecret).toBe('x<y>');
  });

  it("ne trim pas un secret (auth re-normalise) — pas de troncature d'espaces signifiants", () => {
    expect(sanitizeParams({ password: '  ab cd  ' }).password).toBe('  ab cd  ');
  });

  it('continue de stripper les < > sur les champs non sensibles (défense XSS)', () => {
    expect(sanitizeParams({ name: 'Hello<script>' }).name).toBe('Helloscript');
    expect(sanitizeParams({ reportage: 'a<b>c' }).reportage).toBe('abc');
  });

  it('cap la longueur même pour les secrets (anti-DoS)', () => {
    const long = 'x'.repeat(60000);
    expect(sanitizeParams({ password: long }).password.length).toBe(50000);
  });

  it('gère récursivement les objets imbriqués', () => {
    const out = sanitizeParams({ creds: { password: 'p<a>ss', name: 'n<a>me' } });
    expect(out.creds.password).toBe('p<a>ss');
    expect(out.creds.name).toBe('name');
  });
});
