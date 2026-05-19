import { describe, it, expect } from 'vitest';
import { sanitizeFilename, isValidUUID, sanitizeParams } from '../src/middleware/sanitizer.js';

describe('sanitizeFilename', () => {
  it('strips path separators', () => {
    const out = sanitizeFilename('../../etc/passwd');
    expect(out).not.toMatch(/[/\\]/);
    // Multer renomme ensuite avec un UUID, donc même si `..` survit le
    // chemin final est sûr ; on vérifie juste qu'aucun séparateur ne passe.
  });

  it('returns a fallback for null input', () => {
    const out = sanitizeFilename(null);
    expect(out).toMatch(/^upload_/);
  });

  it('preserves safe alphanumeric names', () => {
    const out = sanitizeFilename('reportage_001.mp4');
    expect(out).toBe('reportage_001.mp4');
  });

  it('truncates to 255 chars', () => {
    const long = 'a'.repeat(500) + '.mp4';
    const out = sanitizeFilename(long);
    expect(out.length).toBeLessThanOrEqual(255);
  });
});

describe('isValidUUID', () => {
  it('accepts a valid v4 UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects garbage', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(null)).toBe(false);
  });
});

describe('sanitizeParams', () => {
  it('drops keys with $ or __', () => {
    const out = sanitizeParams({ name: 'ok', $where: 'bad', __proto__: 'bad' });
    expect(out).toHaveProperty('name');
    expect(out).not.toHaveProperty('$where');
    expect(out).not.toHaveProperty('__proto__');
  });

  it('trims string values', () => {
    const out = sanitizeParams({ name: '  trimmed  ' });
    expect(out.name).toBe('trimmed');
  });

  it('drops non-primitive values', () => {
    const out = sanitizeParams({ obj: { nested: true }, arr: [1, 2], n: 42, b: true });
    expect(out).not.toHaveProperty('obj');
    expect(out).not.toHaveProperty('arr');
    expect(out.n).toBe(42);
    expect(out.b).toBe(true);
  });
});
