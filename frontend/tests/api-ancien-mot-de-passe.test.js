import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * L'ancien mot de passe global ne quitte plus le navigateur.
 *
 * L'INCIDENT : il était resté dans le `localStorage` des correspondants
 * (`app-password`) après la suppression de l'écran de connexion, et partait
 * encore avec chaque envoi, dans le champ `adminPassword` des métadonnées
 * TUS. Le serveur le comparait au mot de passe montage et comptait un échec :
 * vingt envois un dimanche, et l'espace montage refusait le bon mot de passe
 * à toute l'équipe.
 */

let options;
vi.mock('tus-js-client', () => ({
  Upload: class {
    constructor(_fichier, opts) { options = opts; }
    findPreviousUploads() { return Promise.resolve([]); }
    resumeFromPreviousUpload() {}
    start() {}
    abort() {}
  },
}));

const { api } = await import('../src/api/index.js');

beforeEach(() => {
  options = undefined;
  localStorage.setItem('app-password', 'ancien-global');
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('l’ancien mot de passe global', () => {
  it('ne part plus avec l’envoi d’un correspondant', async () => {
    api.uploadFile('2026-w40', 'cm', new File(['x'], 'rush.mp4', { type: 'video/mp4' }), { reportage: 'Reportage 1' });
    await vi.waitFor(() => expect(options).toBeDefined());
    expect(options.metadata.adminPassword).toBe('');
    expect(JSON.stringify(options.metadata)).not.toContain('ancien-global');
  });

  it('laisse passer le mot de passe montage quand c’est la rédaction qui envoie', async () => {
    api.uploadFile('2026-w40', 'cm', new File(['x'], 'rush.mp4'), { adminPassword: 'montage' });
    await vi.waitFor(() => expect(options).toBeDefined());
    expect(options.metadata.adminPassword).toBe('montage');
  });

  it('ne part plus en en-tête des requêtes', async () => {
    let entetes;
    vi.stubGlobal('fetch', (_url, init) => {
      entetes = init.headers;
      return Promise.resolve({ ok: true, status: 200, text: async () => '[]', json: async () => [] });
    });
    await api.getSujets('2026-w40', 'cm');
    expect(entetes['X-App-Password']).toBeUndefined();
    expect(JSON.stringify(entetes)).not.toContain('ancien-global');
  });
});
