/**
 * Accès i18n depuis du code hors-contexte React (API client, ErrorBoundary).
 * Lit la langue depuis localStorage — même clé que I18nContext.
 */
import { translations } from './translations.js';

const STORAGE_KEY = 'jt-alwm-lang';
const SUPPORTED = ['fr', 'en'];
const DEFAULT_LANG = 'fr';

export function getCurrentLang() {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored && SUPPORTED.includes(stored)) return stored;
    if (typeof navigator !== 'undefined') {
      const nav = (navigator.language || '').toLowerCase();
      if (nav.startsWith('en')) return 'en';
    }
  } catch { /* localStorage indisponible */ }
  return DEFAULT_LANG;
}

export function tStatic() {
  return translations[getCurrentLang()];
}
