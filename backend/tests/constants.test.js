import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  delete process.env.COUNTRIES_JSON;
});

async function loadConstants() {
  vi.resetModules();
  return import('../src/data/constants.js');
}

describe('COUNTRIES env override', () => {
  it('uses the default list when COUNTRIES_JSON is not set', async () => {
    const { COUNTRIES } = await loadConstants();
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(7);
    expect(COUNTRIES.find((c) => c.id === 'sn')).toBeDefined();
  });

  it('uses a valid COUNTRIES_JSON override', async () => {
    process.env.COUNTRIES_JSON = JSON.stringify([
      { id: 'bj', name: 'Bénin', code: 'BJ' },
      { id: 'bf', name: 'Burkina Faso', code: 'BF' },
    ]);
    const { COUNTRIES } = await loadConstants();
    // Deux pays déclarés, deux pays rendus : « Titres & Rappels » n'est plus
    // injecté ici. C'est le conducteur du journal, devenu une rubrique.
    expect(COUNTRIES).toHaveLength(2);
    expect(COUNTRIES.find((c) => c.id === 'bj')).toBeDefined();
    expect(COUNTRIES.find((c) => c.id === 'bf')).toBeDefined();
  });

  it('écarte « tj » même d’un COUNTRIES_JSON hérité qui le contiendrait', async () => {
    // Une configuration déployée avant ce changement peut encore le lister.
    process.env.COUNTRIES_JSON = JSON.stringify([
      { id: 'tj', name: 'Titres & Rappels JT', code: 'TJ' },
      { id: 'bj', name: 'Bénin', code: 'BJ' },
    ]);
    const { COUNTRIES, SPECIAL_BUCKETS, isCountryAccepted } = await loadConstants();
    expect(COUNTRIES.find((c) => c.id === 'tj')).toBeUndefined();
    // Il reste un tiroir de rangement valide : les fichiers déjà déposés y
    // sont toujours, et le studio de montage les adresse toujours ainsi.
    expect(SPECIAL_BUCKETS.has('tj')).toBe(true);
    expect(isCountryAccepted('tj')).toBe(true);
  });

  it('falls back to default when COUNTRIES_JSON is malformed JSON', async () => {
    process.env.COUNTRIES_JSON = '{ not json';
    const { COUNTRIES } = await loadConstants();
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(7);
  });

  it('falls back when an item is missing fields', async () => {
    process.env.COUNTRIES_JSON = JSON.stringify([{ id: 'bj' }]);
    const { COUNTRIES } = await loadConstants();
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(7);
  });

  it('falls back when COUNTRIES_JSON is an empty array', async () => {
    process.env.COUNTRIES_JSON = '[]';
    const { COUNTRIES } = await loadConstants();
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(7);
  });
});
