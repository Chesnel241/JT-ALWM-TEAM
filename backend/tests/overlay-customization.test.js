import { describe, it, expect } from 'vitest';
import { buildRemotionPayload } from '../src/services/editorService.js';

describe('buildRemotionPayload — personnalisation overlays globaux', () => {
  it('propage posX/posY/scale/colors du ticker', () => {
    const out = buildRemotionPayload([{ filename: 'a.mp4', durationSec: 5 }], {
      globalOverlays: [{
        templateId: 'ticker',
        fields: { categorie: 'INFO', texte: 'Hello', speed: 1 },
        posX: 100, posY: -30, scale: 150,
        colors: { text: '#ffffff', bg: '#0057D9', accent: '#FFD700' },
      }],
    });
    expect(out.branding.ticker.enabled).toBe(true);
    expect(out.branding.ticker.posX).toBe(100);
    expect(out.branding.ticker.posY).toBe(-30);
    expect(out.branding.ticker.scale).toBe(150);
    expect(out.branding.ticker.colors.bg).toBe('#0057D9');
  });

  it('propage posX/posY/scale/colors du live_badge', () => {
    const out = buildRemotionPayload([{ filename: 'a.mp4', durationSec: 5 }], {
      globalOverlays: [{
        templateId: 'live_badge',
        fields: { label: 'DIRECT' },
        posX: 50, posY: 50, scale: 80,
        colors: { bg: '#D81818' },
      }],
    });
    expect(out.branding.live.label).toBe('DIRECT');
    expect(out.branding.live.posX).toBe(50);
    expect(out.branding.live.scale).toBe(80);
    expect(out.branding.live.colors.bg).toBe('#D81818');
  });

  it('conserve les overlays texte globaux dans timelineOverlays', () => {
    const out = buildRemotionPayload([{ filename: 'a.mp4', durationSec: 5 }], {
      globalOverlays: [{
        templateId: 'envato_presenter',
        fields: { context: 'A', name: 'B', title: 'C' },
        posX: 12, posY: 34, scale: 110,
        colors: { text: '#ffffff', bg: '#000000', accent: '#0057D9' },
      }],
    });
    expect(out.timelineOverlays).toHaveLength(1);
    const o = out.timelineOverlays[0];
    expect(o.posX).toBe(12);
    expect(o.posY).toBe(34);
    expect(o.scale).toBe(110);
    expect(o.colors.accent).toBe('#0057D9');
    expect(o.fields.name).toBe('B');
  });

  it('overlays par clip propagent posX/posY/scale/colors intacts', () => {
    const overlay = {
      templateId: 'titre_reportage',
      fields: { titre: 'Test' },
      posX: -50, posY: 200, scale: 75,
      colors: { bg: '#031A3A', text: '#FFFFFF', accent: '#0057D9' },
      font: 'Montserrat ExtraBold',
      fontSize: 110,
    };
    const out = buildRemotionPayload([{ filename: 'a.mp4', durationSec: 5, overlays: [overlay] }], {});
    expect(out.clips[0].overlays[0]).toMatchObject(overlay);
  });

  it('clamp durationSec garde un plancher 0.3 s', () => {
    const out = buildRemotionPayload([{ filename: 'a.mp4', durationSec: 'NaN' }], {});
    expect(out.clips[0].durationSec).toBeGreaterThanOrEqual(0.3);
  });
});
