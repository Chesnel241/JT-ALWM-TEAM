import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildWeeks } from '../src/data/constants.js';
import { requestExtension, getStats, approveExtension, getExtensions } from '../src/data/store.js';

let app;
let weekId;
beforeAll(() => {
  app = createApp({ enableMonitoring: false });
  weekId = buildWeeks()[0].id;
});

/**
 * Chaîne complète des délais exceptionnels :
 *   journaliste demande → admin VOIT la demande dans getStats → admin valide.
 *
 * Bug historique corrigé : getStats() renvoyait un objet plat par pays, mais
 * StatsView lit `delaysByWeek[weekId].requests` + `lateUploadsByCountry` +
 * `extensionsByCountry`. Résultat : les demandes n'apparaissaient jamais côté
 * admin ("Aucune demande de délai") → impossible de valider.
 */
describe('getStats — forme consommée par StatsView', () => {
  it('expose delaysByWeek / lateUploadsByCountry / extensionsByCountry', () => {
    requestExtension(weekId, 'cm');
    const stats = getStats();
    expect(stats).toHaveProperty('delaysByWeek');
    expect(stats).toHaveProperty('lateUploadsByCountry');
    expect(stats).toHaveProperty('extensionsByCountry');
    // La demande du pays 'cm' est visible dans la bonne semaine.
    expect(stats.delaysByWeek[weekId].requests.cm).toBeTruthy();
    expect(stats.delaysByWeek[weekId].requests.cm.status).toBe('pending');
    expect(stats.extensionsByCountry.cm).toBeGreaterThanOrEqual(1);
  });

  it('reflète le passage à "approved" après validation admin', () => {
    requestExtension(weekId, 'sn');
    approveExtension(weekId, 'sn', 60);
    const stats = getStats();
    expect(stats.delaysByWeek[weekId].requests.sn.status).toBe('approved');
    expect(stats.delaysByWeek[weekId].requests.sn.extendedUntil).toBeTruthy();
  });

  it('ne partage pas de référence mutable avec le store (deep copy)', () => {
    requestExtension(weekId, 'ci');
    const stats = getStats();
    stats.delaysByWeek[weekId].requests.ci.status = 'HACKED';
    expect(getExtensions(weekId).requests.ci.status).toBe('pending');
  });
});

describe('POST /api/delays/request — body JSON parsé (Content-Type)', () => {
  it('crée la demande quand le body a le bon Content-Type', async () => {
    const r = await request(app)
      .post('/api/delays/request')
      .set('X-App-Password', 'x')
      .set('Content-Type', 'application/json')
      .send({ weekId, countryId: 'tg' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('pending');
  });

  it('rejette 400 si weekId/countryId manquent', async () => {
    const r = await request(app)
      .post('/api/delays/request')
      .set('X-App-Password', 'x')
      .set('Content-Type', 'application/json')
      .send({ weekId });
    expect(r.status).toBe(400);
  });
});
