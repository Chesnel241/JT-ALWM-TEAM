import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('api client BASE URL', () => {
  it('uses VITE_API_URL prefix when set', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('[]') })
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
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('[]') })
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { api } = await import('../src/api/index.js');
    await api.getWeeks();
    expect(fetchSpy).toHaveBeenCalledWith('/api/weeks', expect.any(Object));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});

describe('api client — en-tête admin', () => {
  const okResponse = (payload = '{}') => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(payload),
  });

  it('envoie X-Admin-Password et baseRevision sur saveTimelineWorkspace', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetchSpy = vi.fn(() => Promise.resolve(okResponse('{"workspace":{"revision":8}}')));
    vi.stubGlobal('fetch', fetchSpy);
    const { api } = await import('../src/api/index.js');

    const res = await api.saveTimelineWorkspace(
      '2026-W03',
      { clips: [], overlays: [], branding: {}, baseRevision: 7 },
      'secret-monteur',
    );

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/editor/timeline/2026-W03');
    expect(init.headers['X-Admin-Password']).toBe('secret-monteur');
    expect(JSON.parse(init.body).baseRevision).toBe(7);
    expect(res.workspace.revision).toBe(8);

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('envoie X-Admin-Password sur editorConcat', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetchSpy = vi.fn(() => Promise.resolve(okResponse('{"ok":true}')));
    vi.stubGlobal('fetch', fetchSpy);
    const { api } = await import('../src/api/index.js');

    await api.editorConcat({ jobId: 'j1', weekId: '2026-W03', clips: [] }, 'secret-monteur');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/editor/concat');
    expect(init.headers['X-Admin-Password']).toBe('secret-monteur');

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('n’ajoute pas l’en-tête admin quand aucun mot de passe n’est fourni', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetchSpy = vi.fn(() => Promise.resolve(okResponse('{}')));
    vi.stubGlobal('fetch', fetchSpy);
    const { api } = await import('../src/api/index.js');

    await api.saveTimelineWorkspace('2026-W03', { clips: [] });

    expect(fetchSpy.mock.calls[0][1].headers['X-Admin-Password']).toBeUndefined();

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});

describe('api client — remontée des erreurs HTTP', () => {
  it('attache statut, code et corps sur un 409 TIMELINE_CONFLICT', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const conflict = {
      code: 'TIMELINE_CONFLICT',
      message: 'Un autre monteur a modifié le montage.',
      workspace: { clips: [{ filename: 'a.mp4' }], overlays: [], branding: {}, revision: 9 },
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      status: 409,
      json: () => Promise.resolve(conflict),
    })));
    const { api } = await import('../src/api/index.js');

    const error = await api.saveTimelineWorkspace('2026-W03', { clips: [] }, 'secret')
      .then(() => null, (err) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(409);
    expect(error.code).toBe('TIMELINE_CONFLICT');
    expect(error.body.workspace.revision).toBe(9);
    expect(error.message).toBe(conflict.message);

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('distingue un 403 admin d’un conflit', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Mot de passe administrateur incorrect ou manquant' }),
    })));
    const { api } = await import('../src/api/index.js');

    const error = await api.editorConcat({}, '').then(() => null, (err) => err);

    expect(error.status).toBe(403);
    expect(error.code).toBeUndefined();

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
