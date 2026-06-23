import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as store from '../src/data/store.js';
import { isCountryAccepted } from '../src/data/constants.js';

let app;
beforeAll(() => {
  app = createApp({ enableMonitoring: false });
});

/**
 * Régression — "Week ou Country invalide" sur l'upload TUS de la
 * rubrique Mot du JT (`mj`). Le frontend envoie `selectedBin='mj'`
 * comme countryId au TUS endpoint, qui doit l'accepter (au même titre
 * que la voiceover route et le download gate de app.js).
 *
 * Source de vérité unique : isCountryAccepted() dans constants.js.
 */
describe('isCountryAccepted — source de vérité partagée', () => {
  it("accepte le bucket spécial 'mj' (rubrique Mot du JT)", () => {
    expect(isCountryAccepted('mj', [])).toBe(true);
  });
  it("accepte un pays standard de la liste COUNTRIES", () => {
    expect(isCountryAccepted('cm', [])).toBe(true); // Cameroun
  });
  it("accepte un pays custom ajouté dynamiquement", () => {
    expect(isCountryAccepted('bf', [{ id: 'bf', name: 'Burkina Faso', code: 'BF' }])).toBe(true);
  });
  it("refuse un pays inconnu et un id non-string", () => {
    expect(isCountryAccepted('zz', [])).toBe(false);
    expect(isCountryAccepted('', [])).toBe(false);
    expect(isCountryAccepted(null, [])).toBe(false);
    expect(isCountryAccepted(42, [])).toBe(false);
  });
});

describe('notifications + TUS acceptent mj et pays custom', () => {
  it('POST /api/notifications/:week/mj/subscribe → 201 (mj accepté)', async () => {
    const { buildWeeks } = await import('../src/data/constants.js');
    const weekId = buildWeeks()[0].id;
    const r = await request(app)
      .post(`/api/notifications/${weekId}/mj/subscribe`)
      .send({ phone: '+33600000000' });
    // mj est désormais accepté côté validation ; le code retour est 201 (créé)
    expect(r.status).toBe(201);
  });

  it('POST /api/notifications/:week/bf/subscribe → 201 quand bf est custom', async () => {
    vi.spyOn(store, 'getCustomCountries').mockReturnValue([
      { id: 'bf', name: 'Burkina Faso', code: 'BF' },
    ]);
    try {
      const { buildWeeks } = await import('../src/data/constants.js');
      const weekId = buildWeeks()[0].id;
      const r = await request(app)
        .post(`/api/notifications/${weekId}/bf/subscribe`)
        .send({ phone: '+22664374164' });
      expect(r.status).toBe(201);
    } finally {
      store.getCustomCountries.mockRestore?.();
    }
  });

  it('POST /api/notifications/:week/zz/subscribe → 400 (inconnu)', async () => {
    vi.spyOn(store, 'getCustomCountries').mockReturnValue([]);
    try {
      const { buildWeeks } = await import('../src/data/constants.js');
      const weekId = buildWeeks()[0].id;
      const r = await request(app)
        .post(`/api/notifications/${weekId}/zz/subscribe`)
        .send({ phone: '+33600000000' });
      expect(r.status).toBe(400);
    } finally {
      store.getCustomCountries.mockRestore?.();
    }
  });
});
