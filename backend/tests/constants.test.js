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
    // 'tj' (Titres & Rappels JT) est toujours injecté en tête → 2 + 1.
    expect(COUNTRIES).toHaveLength(3);
    expect(COUNTRIES.find((c) => c.id === 'tj')).toBeDefined();
    expect(COUNTRIES.find((c) => c.id === 'bj')).toBeDefined();
    expect(COUNTRIES.find((c) => c.id === 'bf')).toBeDefined();
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
