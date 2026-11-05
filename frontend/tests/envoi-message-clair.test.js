import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'INCIDENT : le message brut de la bibliothèque d'envoi — anglais,
 * technique, avec l'adresse du serveur — arrivait tel quel à l'écran d'un
 * correspondant. On simule ici l'échec tel que tus le rapporte.
 */
const MESSAGE_TUS = 'tus: failed to upload chunk at offset 0, caused by [object ProgressEvent], originated from request (method: PATCH, response code: 423)';
let statutSimule = 0;

vi.mock('tus-js-client', () => ({
  Upload: class {
    constructor(_file, options) { this.options = options; }
    findPreviousUploads() { return Promise.resolve([]); }
    start() {
      const erreur = new Error(MESSAGE_TUS);
      erreur.originalResponse = statutSimule ? { getStatus: () => statutSimule } : null;
      this.options.onError(erreur);
    }
    abort() {}
  },
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('un envoi refusé', () => {
  it('dit « date limite passée », pas le message de tus', async () => {
    statutSimule = 423;
    const { api } = await import('../src/api/index.js');
    const fichier = new File(['x'], 'rush.mp4', { type: 'video/mp4' });
    const erreur = await api.uploadFile('2026-W34', 'ga', fichier).catch((e) => e);
    expect(erreur.message).toMatch(/date limite est passée/);
    expect(erreur.message).not.toMatch(/tus:/);
    expect(erreur.definitif).toBe(true);
  });

  it('une coupure réseau parle de connexion, et reste rattrapable', async () => {
    statutSimule = 0;
    const { api } = await import('../src/api/index.js');
    const fichier = new File(['x'], 'rush.mp4', { type: 'video/mp4' });
    const erreur = await api.uploadFile('2026-W34', 'ga', fichier).catch((e) => e);
    expect(erreur.message).toMatch(/connexion/i);
    expect(erreur.definitif).toBe(false);
  });
});
