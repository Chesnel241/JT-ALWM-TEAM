import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { delegateToRemotion, verifierPlans } from '../src/services/editorService.js';

// Le serveur vérifie désormais que chaque plan existe avant de déléguer.
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-delegation-'));
fs.writeFileSync(path.join(DOSSIER, 'a.mp4'), 'x');
const ANCIEN_DOSSIER = process.env.UPLOADS_DIR;

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
  process.env.UPLOADS_DIR = DOSSIER;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RENDER_WORKER_URL;
  delete process.env.WORKER_KEY;
  delete process.env.PUBLIC_API_URL;
  if (ANCIEN_DOSSIER === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = ANCIEN_DOSSIER;
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

// Incident : la durée des plans venait du navigateur du monteur. Avec des
// centaines de plans, ceux dont la vidéo tardait à répondre recevaient
// « 5 secondes » d'office ; un rush effacé n'était découvert qu'en plein rendu.
describe('verifierPlans — le serveur mesure lui-même chaque plan', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-plans-'));
  for (const f of ['long.mp4', 'court.mp4', 'photo.jpg']) fs.writeFileSync(path.join(dossier, f), 'x');
  const mesurer = async (chemin) => ({ 'long.mp4': 30, 'court.mp4': 4, 'photo.jpg': 0 }[path.basename(chemin)]);

  it('un plan sans durée connue prend celle de son fichier, pas 5 secondes', async () => {
    const [p] = await verifierPlans([{ filename: 'long.mp4' }], { mesurer, dossier });
    expect(p.durationSec).toBe(30);
  });

  it('un plan plus long que son fichier est ramené à ce qui existe', async () => {
    const [p] = await verifierPlans([{ filename: 'court.mp4', inPoint: 1, outPoint: 12 }], { mesurer, dossier });
    expect(p.durationSec).toBe(3);
    expect(p.outPoint).toBe(4);
  });

  it('un rognage valable est respecté tel quel', async () => {
    const [p] = await verifierPlans([{ filename: 'long.mp4', inPoint: 5, outPoint: 12.5 }], { mesurer, dossier });
    expect(p).toMatchObject({ inPoint: 5, outPoint: 12.5, durationSec: 7.5 });
  });

  it('une image fixe garde la durée choisie au montage', async () => {
    const [p] = await verifierPlans([{ filename: 'photo.jpg', durationSec: 6 }], { mesurer, dossier });
    expect(p.durationSec).toBe(6);
  });

  it('un fichier effacé arrête tout de suite, en nommant le plan', async () => {
    await expect(verifierPlans(
      [{ filename: 'long.mp4' }, { filename: 'disparu.mp4', name: 'Marché de Mokolo' }],
      { mesurer, dossier },
    )).rejects.toThrow(/plan n° 2 \(Marché de Mokolo\) est introuvable/);
  });

  it('un plan qui commence après la fin de son fichier est refusé', async () => {
    await expect(verifierPlans([{ filename: 'court.mp4', inPoint: 9 }], { mesurer, dossier }))
      .rejects.toThrow(/commence après la fin/);
  });

  it('un rush utilisé par trois cents plans n’est mesuré qu’une fois', async () => {
    const compte = vi.fn(mesurer);
    const plans = Array.from({ length: 300 }, (_, i) => ({ filename: 'long.mp4', inPoint: i % 20, outPoint: (i % 20) + 2 }));
    const res = await verifierPlans(plans, { mesurer: compte, dossier });
    expect(res).toHaveLength(300);
    expect(compte).toHaveBeenCalledTimes(1);
  });

  it('un nom de fichier qui sort du dossier est refusé', async () => {
    const [p] = await verifierPlans([{ filename: '../../long.mp4' }], { mesurer, dossier });
    expect(p.durationSec).toBe(30); // ramené au nom seul, dans le dossier des rushes
    await expect(verifierPlans([{ filename: '..' }], { mesurer, dossier })).rejects.toThrow(/invalide/);
  });
});
