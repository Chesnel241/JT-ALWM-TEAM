import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as store from '../src/data/store.js';

let app;
beforeAll(() => {
  app = createApp({ enableMonitoring: false });
});

/**
 * Régression — "Erreur : Semaine ou pays invalide" sur la modale
 * "Valider et débloquer l'upload" pour un pays AJOUTÉ via le bouton
 * "Ajouter un pays" (ex: Burkina Faso `bf`, absent de COUNTRIES hardcodés).
 *
 * Cause : routes/notifications.js ne consultait que la liste COUNTRIES,
 * pas getCustomCountries() — alors que uploads.js et tus.js le faisaient.
 * Conséquence : la modale était bloquante et l'utilisateur ne pouvait
 * plus uploader.
 */
describe('POST /api/notifications/:weekId/:countryId/subscribe', () => {
  it('accepte un pays custom (ajouté via /api/countries)', async () => {
    vi.spyOn(store, 'getCustomCountries').mockReturnValue([
      { id: 'bf', code: 'BF', name: 'Burkina Faso' },
    ]);
    try {
      // weekId actif (la 1re semaine retournée par buildWeeks)
      const { buildWeeks } = await import('../src/data/constants.js');
      const weekId = buildWeeks()[0].id;

      const r = await request(app)
        .post(`/api/notifications/${weekId}/bf/subscribe`)
        .send({ phone: '+22664374164' });

      expect(r.status).toBe(201);
      expect(r.body.success).toBe(true);
    } finally {
      store.getCustomCountries.mockRestore?.();
    }
  });

  it('refuse un pays totalement inconnu (ni COUNTRIES ni custom)', async () => {
    vi.spyOn(store, 'getCustomCountries').mockReturnValue([]);
    try {
      const { buildWeeks } = await import('../src/data/constants.js');
      const weekId = buildWeeks()[0].id;
      const r = await request(app)
        .post(`/api/notifications/${weekId}/zz/subscribe`)
        .send({ phone: '+22664374164' });
      expect(r.status).toBe(400);
    } finally {
      store.getCustomCountries.mockRestore?.();
    }
  });
});
