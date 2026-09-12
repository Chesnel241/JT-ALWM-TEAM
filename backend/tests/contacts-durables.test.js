import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { TEST_UPLOADS_DIR } from './setup.js';

/**
 * Les numéros WhatsApp appartiennent aux pays, pas aux semaines.
 *
 * Un abonnement n'était rangé que sous la semaine où il avait été laissé :
 * le lundi suivant, la liste « prévenir les pays que le JT est prêt »
 * repartait vide, et la rédaction redemandait son numéro à chaque
 * correspondant. Le carnet `_contacts` les garde d'une semaine sur l'autre ;
 * la semaine, elle, dit qui a re-confirmé.
 */

const SEMAINE_A = '2026-w37';
const SEMAINE_B = '2026-w38';
const STORE_PATH = process.env.JT_STORE_PATH;

let store;

beforeEach(async () => {
  if (STORE_PATH && existsSync(STORE_PATH)) rmSync(STORE_PATH);
  vi.resetModules();
  store = await import('../src/data/store.js');
});

afterAll(() => {
  if (STORE_PATH && existsSync(STORE_PATH)) {
    try { rmSync(STORE_PATH); } catch { /* ignore */ }
  }
});

describe('un numéro laissé une fois sert les semaines suivantes', () => {
  it('ressort la semaine d’après, marqué comme repris du carnet', () => {
    store.addSubscription(SEMAINE_A, 'sn', '+221770000001');

    const semaineA = store.getSubscriptions(SEMAINE_A);
    expect(semaineA).toHaveLength(1);
    expect(semaineA[0].origine).toBe('semaine');

    const semaineB = store.getSubscriptions(SEMAINE_B);
    expect(semaineB).toHaveLength(1);
    expect(semaineB[0]).toMatchObject({
      countryId: 'sn',
      phone: '+221770000001',
      origine: 'contact',
    });
    // Le frontend lit déjà ces champs : ils ne bougent pas.
    expect(semaineB[0].timestamp).toBeTruthy();
  });

  it('laisse la re-confirmation de la semaine l’emporter sur le carnet', () => {
    store.addSubscription(SEMAINE_A, 'sn', '+221770000001');
    store.addSubscription(SEMAINE_B, 'sn', '+221770000002');

    const semaineB = store.getSubscriptions(SEMAINE_B);
    // Un seul Sénégal : le numéro de la semaine, pas les deux.
    expect(semaineB.filter((s) => s.countryId === 'sn')).toHaveLength(1);
    expect(semaineB[0].phone).toBe('+221770000002');
    expect(semaineB[0].origine).toBe('semaine');
    // Et c'est le nouveau numéro que le carnet retient pour la suite.
    expect(store.getContacts().sn.phone).toBe('+221770000002');
  });

  it('complète la semaine sans écraser ceux qui ont re-confirmé', () => {
    store.addSubscription(SEMAINE_A, 'sn', '+221770000001');
    store.addSubscription(SEMAINE_A, 'cm', '+237690000001');
    store.addSubscription(SEMAINE_B, 'cm', '+237690000002');

    const parPays = Object.fromEntries(
      store.getSubscriptions(SEMAINE_B).map((s) => [s.countryId, s]),
    );
    expect(parPays.cm).toMatchObject({ phone: '+237690000002', origine: 'semaine' });
    expect(parPays.sn).toMatchObject({ phone: '+221770000001', origine: 'contact' });
  });
});

describe('un téléphone ne vaut que pour un pays', () => {
  it('ne retient pas le même numéro sous deux pays, ni pour la suite', () => {
    store.addSubscription(SEMAINE_A, 'sn', '+221770000001');
    store.addSubscription(SEMAINE_A, 'cm', '+221770000001');

    // La semaine ne retient qu'une inscription par numéro — un seul message
    // part — et le carnet suit la même règle : sans quoi le doublon
    // reviendrait toutes les semaines suivantes, cette fois sans personne
    // pour l'avoir demandé.
    expect(store.getSubscriptions(SEMAINE_A)).toHaveLength(1);
    expect(store.getSubscriptions(SEMAINE_B)).toHaveLength(1);
    expect(store.getContacts().cm).toBeUndefined();
  });
});

describe('le carnet se tient à la main', () => {
  it('inscrit et retire un pays', () => {
    expect(store.setContact('ci', '+225010000001').phone).toBe('+225010000001');
    expect(store.getContacts().ci.majLe).toBeTruthy();

    expect(store.retirerContact('ci')).toBe(true);
    expect(store.getContacts().ci).toBeUndefined();
    // Un pays déjà absent n'est pas une erreur, mais ce n'est pas un retrait.
    expect(store.retirerContact('ci')).toBe(false);
  });

  it('refuse un numéro vide plutôt que d’inscrire un pays injoignable', () => {
    expect(store.setContact('tg', '   ')).toBeNull();
    expect(store.getContacts().tg).toBeUndefined();
  });
});

describe('`_contacts` est une méta, jamais une semaine', () => {
  it('n’apparaît pas comme un chutier et ne sort pas comme un pays', () => {
    store.addSubscription(SEMAINE_A, 'sn', '+221770000001');
    store.addUpload(SEMAINE_A, 'sn', { id: 'u1', filename: 'a.mp4' });

    expect(store.getWeekUploads('_contacts')).toEqual({});
    expect(Object.keys(store.getWeekUploads(SEMAINE_A))).toEqual(['sn']);
    expect(store.getSubscriptions(SEMAINE_A).map((s) => s.countryId)).not.toContain('_contacts');
  });

  it('survit au balayage de purge, qui lit toutes les clés du store', async () => {
    // Le piège : une méta absente de META_KEYS est lue comme une semaine de
    // reportages — c'est ce qui vaut leur place à `_liens` et `_planning`.
    store.setContact('cd', '+243810000001');
    store.addUpload('2020-w01', 'cd', { id: 'vieux', filename: 'vieux.mp4' });

    await store.cleanupExpiredUploads(null, TEST_UPLOADS_DIR);

    expect(store.getContacts().cd.phone).toBe('+243810000001');
    // La semaine réellement expirée, elle, est bien partie.
    expect(store.getWeekUploads('2020-w01')).toEqual({});
  });
});
