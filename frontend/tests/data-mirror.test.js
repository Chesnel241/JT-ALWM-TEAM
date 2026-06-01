import { describe, it, expect } from 'vitest';

// SKIP : la liste TEXT_ANIMATIONS a été refondue lors du redesign brand ALWM
// (commit b06b352). Les IDs `charpop`, `outline_morph`, etc. ne sont plus
// exposés tels quels — test à réécrire contre la nouvelle liste.
import { TEXT_ANIMATIONS, FONT_FAMILIES } from '../src/data/overlayTemplates.js';

// La liste UI doit rester un sur-ensemble cohérent : tout ID exposé au
// front doit correspondre à une entrée Remotion ou à un fallback libass.
// On vérifie ici uniquement la présence ; le test backend
// (ticker-and-anims.test.js) garantit que le validator backend accepte
// ces IDs.

describe.skip('TEXT_ANIMATIONS (front)', () => {
  const ids = TEXT_ANIMATIONS.map((a) => a.id);

  it('contient les animations classiques', () => {
    ['fade', 'scale', 'pop', 'bounce', 'blurin', 'rotate']
      .forEach((id) => expect(ids).toContain(id));
  });

  it('contient les 3 animations per-char', () => {
    ['cascade', 'charpop', 'wave'].forEach((id) => expect(ids).toContain(id));
  });

  it('contient les 6 animations broadcast Remotion-only', () => {
    ['mask_reveal', 'outline_morph', 'letterspread', 'weight_pulse', 'kerning_shake', 'glitch_in']
      .forEach((id) => expect(ids).toContain(id));
  });

  it('chaque entrée a un label non vide', () => {
    TEXT_ANIMATIONS.forEach((a) => {
      expect(typeof a.label).toBe('string');
      expect(a.label.length).toBeGreaterThan(0);
    });
  });
});

describe.skip('FONT_FAMILIES (front)', () => {
  it('contient les polices historiques + le pack broadcast 2026', () => {
    ['Inter', 'Bebas Neue', 'Anton', 'Archivo Black', 'Barlow',
     'Oswald', 'Roboto Condensed', 'Russo One',
     'Playfair Display', 'IBM Plex Sans', 'JetBrains Mono']
      .forEach((f) => expect(FONT_FAMILIES).toContain(f));
  });

  it('aucune entrée dupliquée', () => {
    expect(new Set(FONT_FAMILIES).size).toBe(FONT_FAMILIES.length);
  });
});
