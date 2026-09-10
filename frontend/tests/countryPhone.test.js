import { describe, it, expect, beforeEach } from 'vitest';
import {
  readCountryPhone,
  saveCountryPhone,
  forgetCountryPhone,
  isUsablePhone,
} from '../src/lib/countryPhone.js';

beforeEach(() => {
  localStorage.clear();
});

describe('numéro WhatsApp par pays', () => {
  it('garde chaque pays indépendant', () => {
    saveCountryPhone('cm', '+237600000000');
    saveCountryPhone('sn', '+221770000000');
    expect(readCountryPhone('cm')).toBe('+237600000000');
    expect(readCountryPhone('sn')).toBe('+221770000000');
    expect(readCountryPhone('ci')).toBe('');
  });

  it('ne fait plus déborder un numéro sur les autres pays', () => {
    // Ancienne clé partagée : elle servait de repli et le numéro d'un pays
    // réapparaissait sur tous les autres.
    localStorage.setItem('uploader_phone', '+33778669907');
    expect(readCountryPhone('cm')).toBe('');
    expect(readCountryPhone('sn')).toBe('');
  });

  it('efface l\'ancienne clé partagée dès la première lecture', () => {
    localStorage.setItem('uploader_phone', '+33778669907');
    readCountryPhone('cm');
    expect(localStorage.getItem('uploader_phone')).toBeNull();
  });

  it('oublie le numéro d\'un pays sans toucher aux autres', () => {
    saveCountryPhone('cm', '+237600000000');
    saveCountryPhone('sn', '+221770000000');
    forgetCountryPhone('cm');
    expect(readCountryPhone('cm')).toBe('');
    expect(readCountryPhone('sn')).toBe('+221770000000');
  });

  it('reconnaît un numéro exploitable', () => {
    expect(isUsablePhone('+237600000000')).toBe(true);
    expect(isUsablePhone('123')).toBe(false);
    expect(isUsablePhone('')).toBe(false);
    expect(isUsablePhone(undefined)).toBe(false);
  });
});
