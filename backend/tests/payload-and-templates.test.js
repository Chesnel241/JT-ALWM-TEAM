import { describe, it, expect } from 'vitest';
import { buildRemotionPayload, XFADE_TRANSITIONS } from '../src/services/editorService.js';
import { OVERLAY_TEMPLATES, TEXT_ANIMATIONS_IDS, FONT_FAMILIES } from '../src/data/overlayTemplates.js';

describe('buildRemotionPayload — robustesse', () => {
  it('clamp durationSec négatif/NaN/0 → 0.3 s mini', () => {
    const out = buildRemotionPayload([
      { filename: 'a.mp4', durationSec: -5 },
      { filename: 'b.mp4', durationSec: 0 },
      { filename: 'c.mp4', durationSec: 'oops' },
      { filename: 'd.mp4', durationSec: undefined, inPoint: 5, outPoint: 2 },
    ], {});
    out.clips.forEach((c) => expect(c.durationSec).toBeGreaterThanOrEqual(0.3));
  });

  it('garde durationSec valide (5 s)', () => {
    const out = buildRemotionPayload([{ filename: 'a.mp4', durationSec: 5 }], {});
    expect(out.clips[0].durationSec).toBe(5);
  });

  it('URL toujours via backend (full-Hetzner ou R2)', () => {
    process.env.PUBLIC_API_URL = 'http://backend:3010';
    const out = buildRemotionPayload([{ filename: 'a.mp4' }], {});
    expect(out.clips[0].url).toBe('http://backend:3010/uploads/a.mp4');
  });

  it('atmosphere clampée 0..1', () => {
    const out = buildRemotionPayload([{ filename: 'a.mp4' }], {
      atmosphere: { vignette: -1, grain: 2, sweep: 0.5 },
    });
    expect(out.branding.atmosphere).toEqual({ vignette: 0, grain: 1, sweep: 0.5 });
  });
});

describe('Registre brand ALWM (mode v3 + Envato)', () => {
  it('expose intro_jt + Envato pack', () => {
    const ids = OVERLAY_TEMPLATES.map((t) => t.id);
    ['intro_jt', 'envato_presenter', 'envato_news', 'envato_big_title',
     'envato_ticker', 'envato_split_screen'].forEach((id) => expect(ids).toContain(id));
  });

  it('FONT_FAMILIES contient Montserrat ExtraBold (charte H1)', () => {
    expect(FONT_FAMILIES).toContain('Montserrat ExtraBold');
  });

  it('XFADE_TRANSITIONS contient transitions custom Remotion', () => {
    ['whippan', 'glitch', 'rgbsplit', 'lightsweep', 'flashwhite']
      .forEach((t) => expect(XFADE_TRANSITIONS.has(t)).toBe(true));
  });
});
