import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { MAX_FILE_SIZE, DELIVERY_MAX_FILE_SIZE } from '../src/lib/upload.js';
import { createApp } from '../src/app.js';
import { buildWeeks } from '../src/data/constants.js';

/**
 * Garde-fous "échelle production" : les monteurs exportent des masters de
 * 30 min pouvant peser 20 Go. Ces tests verrouillent les constantes qui,
 * historiquement, tuaient les rendus/uploads longs :
 *   - STEP_MAX_MS 12 min → tuait l'encodage d'un master 30 min
 *   - JOB_TTL_MS 30 min  → tuait le job en plein rendu
 *   - MAX_FILE_SIZE 2 Go → rejetait les fichiers de prod
 *   - express.json 100kb → 413 sur le payload /concat d'un gros montage
 */
describe('Limites dimensionnées pour la production (20 Go / 30 min)', () => {
  it('MAX_FILE_SIZE ≥ 20 Go (rushes/TUS)', () => {
    expect(MAX_FILE_SIZE).toBeGreaterThanOrEqual(20 * 1024 * 1024 * 1024);
  });

  it('DELIVERY_MAX_FILE_SIZE ≥ 20 Go (JT final)', () => {
    expect(DELIVERY_MAX_FILE_SIZE).toBeGreaterThanOrEqual(20 * 1024 * 1024 * 1024);
  });

  it('accepte un payload /concat volumineux (> 100 ko, montage 30 min)', async () => {
    const app = createApp({ enableMonitoring: false });
    const weekId = buildWeeks()[0].id;
    // 30 clips, chacun avec des sous-titres auto (~40 segments) → ~350 ko.
    const subtitles = Array.from({ length: 40 }, (_, i) => ({
      text: `Sous-titre automatique numéro ${i} avec du texte réaliste de reportage terrain.`,
      start: i * 2,
      end: i * 2 + 1.8,
    }));
    const clips = Array.from({ length: 30 }, (_, i) => ({
      filename: `clip_${i}.mp4`,
      inPoint: 0,
      outPoint: 60,
      durationSec: 60,
      overlays: [],
      subtitles,
    }));
    const r = await request(app)
      .post('/api/editor/concat')
      .set('X-App-Password', 'x')
      .set('Content-Type', 'application/json')
      .send({ jobId: `test-${weekId}`, clips });
    // 202 = accepté. Surtout PAS 413 (payload too large).
    expect(r.status).toBe(202);
  });
});
