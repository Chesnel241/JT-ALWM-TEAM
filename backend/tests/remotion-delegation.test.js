import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { delegateToRemotion } from '../src/services/editorService.js';

// Mock global fetch via vi.stubGlobal pour intercepter les appels worker
// sans monter de serveur HTTP.
let fetchCalls;
let fetchImpl;

beforeEach(() => {
  fetchCalls = [];
  fetchImpl = vi.fn(async (url, init) => {
    fetchCalls.push({ url, init });
    if (url.endsWith('/health')) return { ok: true, status: 200 };
    if (url.endsWith('/render')) return { ok: true, status: 202, text: async () => 'ok' };
    return { ok: false, status: 404, text: async () => 'not found' };
  });
  vi.stubGlobal('fetch', fetchImpl);

  process.env.RENDER_WORKER_URL = 'https://worker.example';
  process.env.WORKER_KEY = 'unit-test-key';
  process.env.PUBLIC_API_URL = 'https://api.example';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RENDER_WORKER_URL;
  delete process.env.WORKER_KEY;
  delete process.env.PUBLIC_API_URL;
});

const clip = { filename: 'a.mp4', inPoint: 0, outPoint: 5 };

describe('delegateToRemotion', () => {
  it('ping /health du worker AVANT /render (fail-fast)', async () => {
    await delegateToRemotion([clip], 'job1', {});
    expect(fetchCalls[0].url).toBe('https://worker.example/health');
    expect(fetchCalls[1].url).toBe('https://worker.example/render');
  });

  it('envoie X-Worker-Key + returnTo dans le body /render', async () => {
    await delegateToRemotion([clip], 'job2', {});
    const renderCall = fetchCalls.find((c) => c.url.endsWith('/render'));
    expect(renderCall.init.headers['X-Worker-Key']).toBe('unit-test-key');
    const body = JSON.parse(renderCall.init.body);
    expect(body.returnTo).toBe('https://api.example');
    expect(body.jobId).toBe('job2');
    expect(body.payload.clips).toHaveLength(1);
  });

  it('retourne { delegated: true } sur succès', async () => {
    const out = await delegateToRemotion([clip], 'job3', {});
    expect(out).toEqual({ delegated: true });
  });

  it('lève une erreur explicite si /health échoue (fail-fast)', async () => {
    fetchImpl.mockImplementation(async (url) => {
      if (url.endsWith('/health')) throw new Error('ECONNREFUSED');
      return { ok: true, status: 202 };
    });
    await expect(delegateToRemotion([clip], 'job-h', {})).rejects.toThrow(/injoignable/);
    // /render ne doit pas être appelé.
    expect(fetchCalls.some((c) => c.url.endsWith('/render'))).toBe(false);
  });

  it('lève si RENDER_WORKER_URL manquant', async () => {
    delete process.env.RENDER_WORKER_URL;
    await expect(delegateToRemotion([clip], 'jx', {})).rejects.toThrow(/RENDER_WORKER_URL/);
  });

  it('lève si WORKER_KEY manquant', async () => {
    delete process.env.WORKER_KEY;
    await expect(delegateToRemotion([clip], 'jx', {})).rejects.toThrow(/WORKER_KEY/);
  });

  it('lève si PUBLIC_API_URL manquant', async () => {
    delete process.env.PUBLIC_API_URL;
    await expect(delegateToRemotion([clip], 'jx', {})).rejects.toThrow(/PUBLIC_API_URL/);
  });

  it('inclut le corps de la réponse si /render échoue non-2xx', async () => {
    fetchImpl.mockImplementation(async (url) => {
      if (url.endsWith('/health')) return { ok: true };
      return { ok: false, status: 500, text: async () => 'kaboom internal' };
    });
    await expect(delegateToRemotion([clip], 'jx', {})).rejects.toThrow(/kaboom/);
  });
});
