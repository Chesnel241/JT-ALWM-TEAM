import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withViewTransition, supportsViewTransitions, prefersReducedMotion } from '../src/lib/viewTransition.js';

function setReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  setReducedMotion(false);
  delete document.startViewTransition;
  document.documentElement.removeAttribute('data-transition');
});

afterEach(() => {
  delete document.startViewTransition;
});

describe('transition d\'écran', () => {
  it('applique directement quand le navigateur ne connaît pas l\'API', () => {
    const update = vi.fn();
    expect(supportsViewTransitions()).toBe(false);
    withViewTransition(update, 'forward');
    expect(update).toHaveBeenCalledOnce();
  });

  it('applique directement quand la personne a demandé moins de mouvement', () => {
    setReducedMotion(true);
    document.startViewTransition = vi.fn();
    const update = vi.fn();
    expect(prefersReducedMotion()).toBe(true);
    withViewTransition(update, 'forward');
    expect(update).toHaveBeenCalledOnce();
    expect(document.startViewTransition).not.toHaveBeenCalled();
  });

  it('passe par l\'API et nomme le sens quand c\'est possible', async () => {
    let finish;
    document.startViewTransition = vi.fn((cb) => {
      cb();
      return { finished: new Promise((resolve) => { finish = resolve; }) };
    });
    const update = vi.fn();

    withViewTransition(update, 'back');
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.transition).toBe('back');

    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.dataset.transition).toBeUndefined();
  });

  it('applique quand même si l\'API refuse', () => {
    document.startViewTransition = vi.fn(() => { throw new Error('déjà en cours'); });
    const update = vi.fn();
    withViewTransition(update, 'forward');
    // Une transition déjà en cours ne doit jamais bloquer une navigation.
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.transition).toBeUndefined();
  });

  it('nettoie le sens même si la transition échoue', async () => {
    document.startViewTransition = vi.fn((cb) => {
      cb();
      return { finished: Promise.reject(new Error('interrompue')) };
    });
    withViewTransition(() => {}, 'forward');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.dataset.transition).toBeUndefined();
  });
});
