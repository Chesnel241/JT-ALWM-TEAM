import { describe, it, expect } from 'vitest';
import { buildRemotionPayload, XFADE_TRANSITIONS } from '../src/services/editorService.js';

describe('buildRemotionPayload', () => {
  const baseClips = [
    { filename: 'a.mp4', inPoint: 0, outPoint: 5, overlays: [], transition: { type: 'fade', duration: 0.5 } },
  ];

  it('mappe globalOverlays[ticker] → branding.ticker avec speed', () => {
    const out = buildRemotionPayload(baseClips, {
      globalOverlays: [{ templateId: 'ticker', fields: { categorie: 'X', texte: 'y', speed: 5 } }],
    });
    expect(out.branding.ticker).toEqual({ enabled: true, categorie: 'X', texte: 'y', speed: 5 });
  });

  it('default speed = 3 si fields.speed manquant', () => {
    const out = buildRemotionPayload(baseClips, {
      globalOverlays: [{ templateId: 'ticker', fields: { texte: 'y' } }],
    });
    expect(out.branding.ticker.speed).toBe(3);
  });

  it('mappe globalOverlays[live_badge] → branding.live', () => {
    const out = buildRemotionPayload(baseClips, {
      globalOverlays: [{ templateId: 'live_badge', fields: { label: 'DIRECT' } }],
    });
    expect(out.branding.live).toEqual({ enabled: true, label: 'DIRECT' });
  });

  it('expose logo + logoPosition dans branding', () => {
    const out = buildRemotionPayload(baseClips, { logo: true, logoPosition: 'tl' });
    expect(out.branding.logo).toBe(true);
    expect(out.branding.logoPosition).toBe('tl');
  });

  it('logoPosition par défaut = br', () => {
    const out = buildRemotionPayload(baseClips, { logo: true });
    expect(out.branding.logoPosition).toBe('br');
  });

  it('clamp atmosphere {vignette,grain,sweep} dans [0, 1]', () => {
    const out = buildRemotionPayload(baseClips, {
      atmosphere: { vignette: -5, grain: 0.5, sweep: 99 },
    });
    expect(out.branding.atmosphere).toEqual({ vignette: 0, grain: 0.5, sweep: 1 });
  });

  it('ignore atmosphere si non fourni', () => {
    const out = buildRemotionPayload(baseClips, {});
    expect(out.branding.atmosphere).toBeUndefined();
  });

  it('calcule durationSec si absent depuis outPoint - inPoint', () => {
    const out = buildRemotionPayload([{ filename: 'a.mp4', inPoint: 2, outPoint: 7 }], {});
    expect(out.clips[0].durationSec).toBe(5);
  });

  it('respecte durationSec explicite si fourni', () => {
    const out = buildRemotionPayload([{ filename: 'a.mp4', inPoint: 0, outPoint: 10, durationSec: 3.5 }], {});
    expect(out.clips[0].durationSec).toBe(3.5);
  });

  it('propage subtitles + subtitleStyle + transition + kenBurns', () => {
    const out = buildRemotionPayload([{
      filename: 'a.mp4',
      subtitles: [{ start: 0, end: 1, text: 'hi' }],
      subtitleStyle: { position: 'bottom', size: 'M' },
      transition: { type: 'glitch', duration: 0.4 },
      kenBurns: { mode: 'in' },
    }], {});
    expect(out.clips[0].subtitles).toHaveLength(1);
    expect(out.clips[0].subtitleStyle.size).toBe('M');
    expect(out.clips[0].transition.type).toBe('glitch');
    expect(out.clips[0].kenBurns.mode).toBe('in');
  });
});

describe('XFADE_TRANSITIONS allowlist', () => {
  it('contient les transitions xfade historiques', () => {
    ['fade', 'fadeblack', 'wipeleft', 'slideright', 'circleopen'].forEach((t) => {
      expect(XFADE_TRANSITIONS.has(t)).toBe(true);
    });
  });

  it('contient les 5 transitions broadcast Remotion', () => {
    ['whippan', 'glitch', 'rgbsplit', 'lightsweep', 'flashwhite'].forEach((t) => {
      expect(XFADE_TRANSITIONS.has(t)).toBe(true);
    });
  });

  it('rejette les types inconnus', () => {
    expect(XFADE_TRANSITIONS.has('totally-not-real')).toBe(false);
  });
});
