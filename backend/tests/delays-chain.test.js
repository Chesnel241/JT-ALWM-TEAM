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

  it('rejette 404 un weekId invalide (anti-pollution du store)', async () => {
    const r = await request(app)
      .post('/api/delays/request')
      .set('X-App-Password', 'x')
      .set('Content-Type', 'application/json')
      .send({ weekId: '1999-w99', countryId: 'cm' });
    expect(r.status).toBe(404);
  });

  it('rejette 404 un countryId inconnu', async () => {
    const r = await request(app)
      .post('/api/delays/request')
      .set('X-App-Password', 'x')
      .set('Content-Type', 'application/json')
      .send({ weekId, countryId: 'zz-inconnu' });
    expect(r.status).toBe(404);
  });

  it("rejette une durée d'approbation aberrante (négative / énorme)", async () => {
    for (const minutes of [-5, 0, 999999]) {
      const r = await request(app)
        .post('/api/delays/approve')
        .set('X-App-Password', 'x')
        .set('X-Admin-Password', 'x')
        .set('Content-Type', 'application/json')
        .send({ weekId, countryId: 'cm', minutes });
      expect(r.status).toBe(400);
    }
  });
});

/**
 * Un délai s'ajoute à l'échéance en vigueur, il ne repart pas de l'heure du clic.
 *
 * L'INCIDENT : « +1 h » donné après « +12 h » raccourcissait le délai de onze
 * heures, et un délai accordé avant la clôture tombait avant elle.
 */
describe('délais — calcul de la nouvelle échéance', () => {
  const H = 60 * 60 * 1000;

  it('avant la clôture, +1 h repousse la clôture d’une heure', async () => {
    const { weekUploadCutoff } = await import('../src/data/constants.js');
    const cloture = weekUploadCutoff(weekId).getTime();
    const ext = approveExtension(weekId, 'bj', 60, new Date(cloture - 5 * H));
    expect(new Date(ext.extendedUntil).getTime()).toBe(cloture + H);
  });

  it('+1 h après +12 h prolonge encore, il ne raccourcit pas', async () => {
    const { weekUploadCutoff } = await import('../src/data/constants.js');
    const cloture = weekUploadCutoff(weekId).getTime();
    const apres = new Date(cloture + 2 * H);
    approveExtension(weekId, 'ga', 12 * 60, apres);
    const ext = approveExtension(weekId, 'ga', 60, new Date(cloture + 3 * H));
    expect(new Date(ext.extendedUntil).getTime()).toBe(cloture + 2 * H + 12 * H + H);
  });

  it('échéance déjà passée : le délai part de maintenant', async () => {
    const { weekUploadCutoff } = await import('../src/data/constants.js');
    const cloture = weekUploadCutoff(weekId).getTime();
    const maintenant = new Date(cloture + 30 * H);
    const ext = approveExtension(weekId, 'ml', 180, maintenant);
    expect(new Date(ext.extendedUntil).getTime()).toBe(maintenant.getTime() + 3 * H);
  });

  it('le délai global suit la même règle', async () => {
    const { setGlobalExtension } = await import('../src/data/store.js');
    const { weekUploadCutoff } = await import('../src/data/constants.js');
    const cloture = weekUploadCutoff(weekId).getTime();
    setGlobalExtension(weekId, 120, new Date(cloture - H));
    const ext = setGlobalExtension(weekId, 60, new Date(cloture));
    expect(new Date(ext.extendedUntil).getTime()).toBe(cloture + 2 * H + H);
  });
});
