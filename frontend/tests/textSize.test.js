import { describe, it, expect, beforeEach } from 'vitest';
import {
  readTextSize,
  saveTextSize,
  applyTextSize,
  TEXT_SIZES,
} from '../src/lib/textSize.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-text-size');
});

describe('taille de lecture', () => {
  it('démarre en taille normale', () => {
    expect(readTextSize()).toBe(TEXT_SIZES.NORMAL);
  });

  it('mémorise le choix des gros caractères', () => {
    saveTextSize(TEXT_SIZES.LARGE);
    expect(readTextSize()).toBe(TEXT_SIZES.LARGE);
    saveTextSize(TEXT_SIZES.NORMAL);
    expect(readTextSize()).toBe(TEXT_SIZES.NORMAL);
  });

  it('marque le document, et le démarque au retour à la normale', () => {
    applyTextSize(TEXT_SIZES.LARGE);
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
    applyTextSize(TEXT_SIZES.NORMAL);
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);
  });

  it('ignore une valeur inconnue plutôt que de la propager', () => {
    localStorage.setItem('reader_text_size', 'enorme');
    expect(readTextSize()).toBe(TEXT_SIZES.NORMAL);
  });
});
