import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Le store lit son chemin au chargement : on l'isole par test.
let dir, dbPath;

async function loadStoreWith(contenu) {
  fs.writeFileSync(dbPath, JSON.stringify(contenu, null, 2));
  vi.resetModules();
  process.env.JT_STORE_PATH = dbPath;
  const store = await import('../src/data/store.js');
  await store.initDb();
  return store;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-sujets-'));
  dbPath = path.join(dir, 'db.json');
});

afterEach(() => {
  delete process.env.JT_STORE_PATH;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('migration des étiquettes vers des sujets', () => {
  it('crée un sujet par étiquette et n\'abandonne aucun fichier', async () => {
    const store = await loadStoreWith({
      '2026-w37': {
        sn: [
          { id: 'a', name: 'a.mp4', reportage: 'Reportage 1', status: 'approved' },
          { id: 'b', name: 'b.mp4', reportage: 'Reportage 2', status: 'pending' },
          { id: 'c', name: 'c.txt', reportage: 'Reportage 2', status: 'pending' },
        ],
      },
    });

    const sujets = store.getSujets('2026-w37', 'sn');
    expect(sujets.map((s) => s.titre)).toEqual(['Reportage 1', 'Reportage 2']);

    const files = store.getCountryUploads('2026-w37', 'sn');
    expect(files.every((f) => f.sujetId)).toBe(true);
    // Les deux pièces du reportage 2 partagent bien le même sujet.
    expect(files[1].sujetId).toBe(files[2].sujetId);
    expect(files[0].sujetId).not.toBe(files[1].sujetId);
  });

  it('rattache un fichier sans étiquette au premier sujet, comme l\'affichage le faisait', async () => {
    const store = await loadStoreWith({
      '2026-w37': {
        sn: [
          { id: 'vieux', name: 'ancien.mp4', status: 'pending' },
          { id: 'a', name: 'a.mp4', reportage: 'Reportage 1', status: 'pending' },
        ],
      },
    });

    const files = store.getCountryUploads('2026-w37', 'sn');
    expect(files[0].sujetId).toBeTruthy();
    expect(files[0].sujetId).toBe(files[1].sujetId);
  });

  it('déduit l\'état de chaque sujet des fichiers reçus', async () => {
    const store = await loadStoreWith({
      '2026-w37': {
        sn: [
          { id: 'a', reportage: 'Tout bon', status: 'approved' },
          { id: 'b', reportage: 'À reprendre', status: 'rejected' },
          { id: 'c', reportage: 'En attente de revue', status: 'pending' },
        ],
      },
    });

    const parTitre = Object.fromEntries(
      store.getSujets('2026-w37', 'sn').map((s) => [s.titre, s.etat])
    );
    expect(parTitre['Tout bon']).toBe('valide');
    expect(parTitre['À reprendre']).toBe('a_corriger');
    expect(parTitre['En attente de revue']).toBe('recu');
  });

  it('est rejouable : un second démarrage ne duplique rien', async () => {
    const contenu = {
      '2026-w37': {
        sn: [{ id: 'a', reportage: 'Reportage 1', status: 'pending' }],
      },
    };
    const premier = await loadStoreWith(contenu);
    const apres = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    expect(premier.getSujets('2026-w37', 'sn')).toHaveLength(1);

    const second = await loadStoreWith(apres);
    expect(second.getSujets('2026-w37', 'sn')).toHaveLength(1);
  });

  it('laisse tranquilles les clés réservées', async () => {
    const store = await loadStoreWith({
      '2026-w37': {
        _delivery: [{ id: 'jt', name: 'JT.mp4' }],
        _subscriptions: [{ countryId: 'sn', phone: '+221' }],
        sn: [{ id: 'a', reportage: 'Reportage 1', status: 'pending' }],
      },
    });
    expect(store.getDelivery('2026-w37')).toHaveLength(1);
    expect(store.getSujets('2026-w37')).toHaveLength(1);
  });
});
