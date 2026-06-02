import { describe, it, expect } from 'vitest';
import {
  OVERLAY_TEMPLATES,
  CLIP_TEMPLATES,
  GLOBAL_TEMPLATES,
  TEXT_ANIMATIONS,
  TEXT_ANIMATIONS_IN,
  TEXT_ANIMATIONS_LOOP,
  TEXT_ANIMATIONS_OUT,
  FONT_FAMILIES,
} from '../src/data/overlayTemplates.js';

// Mirror frontend du registre brand ALWM (ne doit pas dériver des templates
// servis au backend / Remotion). Garde-fou minimal.

describe('OVERLAY_TEMPLATES (front)', () => {
  const ids = OVERLAY_TEMPLATES.map((t) => t.id);

  it('expose les modèles core + pack Envato', () => {
    [
      'intro_jt', 'titre_reportage', 'transition_reportage',
      'nom_interview', 'rappel_titres', 'fin_merci',
      'flash_info', 'breaking_news',
      'envato_presenter', 'envato_news', 'envato_big_title',
      'envato_ticker', 'envato_split_screen',
    ].forEach((id) => expect(ids).toContain(id));
  });

  it('CLIP_TEMPLATES + GLOBAL_TEMPLATES couvrent l\'intégralité du registre', () => {
    expect(CLIP_TEMPLATES.length + GLOBAL_TEMPLATES.length).toBe(OVERLAY_TEMPLATES.length);
  });

  it('aucun id dupliqué', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TEXT_ANIMATIONS (front)', () => {
  it('TEXT_ANIMATIONS = TEXT_ANIMATIONS_IN', () => {
    expect(TEXT_ANIMATIONS).toBe(TEXT_ANIMATIONS_IN);
  });

  it('TEXT_ANIMATIONS_IN contient fade + Remotion-only (mask_reveal, glitch_in, letterspread)', () => {
    const ids = TEXT_ANIMATIONS_IN.map((a) => a.id);
    ['fade', 'mask_reveal', 'glitch_in', 'letterspread', 'cascade', 'typewriter']
      .forEach((id) => expect(ids).toContain(id));
  });

  it('TEXT_ANIMATIONS_LOOP contient les loops permanents', () => {
    const ids = TEXT_ANIMATIONS_LOOP.map((a) => a.id);
    ['none', 'float', 'pulse', 'kerning_shake'].forEach((id) => expect(ids).toContain(id));
  });

  it('TEXT_ANIMATIONS_OUT contient fade + glitch_out', () => {
    const ids = TEXT_ANIMATIONS_OUT.map((a) => a.id);
    ['fade', 'glitch_out', 'blurout'].forEach((id) => expect(ids).toContain(id));
  });

  it('chaque animation a un label non vide', () => {
    [...TEXT_ANIMATIONS_IN, ...TEXT_ANIMATIONS_LOOP, ...TEXT_ANIMATIONS_OUT].forEach((a) => {
      expect(typeof a.label).toBe('string');
      expect(a.label.length).toBeGreaterThan(0);
    });
  });
});

describe('FONT_FAMILIES (front)', () => {
  it('contient les polices brand (Montserrat) + iconiques broadcast', () => {
    [
      'Montserrat Bold', 'Montserrat Medium',
      'Inter', 'Anton', 'Bebas Neue', 'Archivo Black', 'Oswald',
    ].forEach((f) => expect(FONT_FAMILIES).toContain(f));
  });

  it('aucune entrée dupliquée', () => {
    expect(new Set(FONT_FAMILIES).size).toBe(FONT_FAMILIES.length);
  });
});
