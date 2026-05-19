import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('api client BASE URL', () => {
  it('uses VITE_API_URL prefix when set', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { api } = await import('../src/api/index.js');
    await api.getCountries();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/countries',
      expect.any(Object)
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('falls back to relative /api when VITE_API_URL is unset', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { api } = await import('../src/api/index.js');
    await api.getWeeks();
    expect(fetchSpy).toHaveBeenCalledWith('/api/weeks', expect.any(Object));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
