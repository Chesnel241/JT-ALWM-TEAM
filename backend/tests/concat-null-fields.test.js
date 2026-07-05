import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

let app;
beforeAll(() => {
  app = createApp({ enableMonitoring: false });
});

/**
 * Régression — "Générer le Master" échouait en 400 "Champ invalide :
 * globalOverlays[0].duration (Invalid value)". Le frontend envoie des
 * overlays de la piste texte avec `duration: null` (= "jusqu'à la fin"),
 * et d'autres champs numériques à null quand non positionnés. Or
 * express-validator `.optional()` ne saute que `undefined`, PAS `null` →
 * `.isFloat()` tournait sur null → rejet. Fix : `.optional({ values:
 * 'null' })` sur tous les champs optionnels.
 */
describe('POST /api/editor/concat — tolérance des champs null', () => {
  const clip = { filename: 'x.mp4', inPoint: 0, outPoint: 10, durationSec: 10, overlays: [] };

  it('accepte un overlay global avec duration/startTime/posX/posY/scale = null', async () => {
    const r = await request(app)
      .post('/api/editor/concat')
      .set('X-App-Password', 'x')
      .send({
        clips: [clip],
        globalOverlays: [{
          templateId: 'ticker',
          duration: null, startTime: null,
          posX: null, posY: null, scale: null,
          fields: { texte: 'INFO' },
        }],
        logo: false, logoPosition: 'br',
        atmosphere: { vignette: 0, grain: 0, sweep: 0 },
      });
    // 202 = accepté (montage démarré). Surtout PAS 400.
    expect(r.status).toBe(202);
  });

  it('accepte un clip.overlay avec duration null', async () => {
    const r = await request(app)
      .post('/api/editor/concat')
      .set('X-App-Password', 'x')
      .send({
        clips: [{ ...clip, overlays: [{ templateId: undefined, startTime: 0, duration: null, fields: { texte: 'a' } }] }],
      });
    expect(r.status).toBe(202);
  });

  it('rejette toujours une vraie valeur invalide (non-null)', async () => {
    const r = await request(app)
      .post('/api/editor/concat')
      .set('X-App-Password', 'x')
      .send({ clips: [{ ...clip, durationSec: 'pas-un-nombre' }] });
    expect(r.status).toBe(400);
  });
});
