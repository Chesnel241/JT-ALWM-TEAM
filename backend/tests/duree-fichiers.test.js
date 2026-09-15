import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import './setup.js';
import { semaineActive } from './semaine.js';

/**
 * La durée des rushes, côté store.
 *
 * Le serveur mesure déjà chaque fichier avec ffprobe pour fabriquer le
 * master, puis jette la mesure. Or un journal se monte à durée contrainte :
 * ce que prend chaque sujet se décide avant le montage. Le modèle porte donc
 * la durée ; la mesurer et l'afficher viendront se brancher dessus.
 */

// La semaine active, et non une semaine figée : une suite qui ne passe que la
// semaine de son écriture annonce une panne tous les lundis.
const SEMAINE = semaineActive();
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

const fichier = (id) => ({ id, name: 'Sujet marché.mp4', filename: `${id}.mp4`, type: 'video' });

describe('setFileDuration', () => {
  it('pose la durée d’un fichier existant et la rend lisible', () => {
    store.addUpload(SEMAINE, 'sn', fichier('f1'));

    expect(store.setFileDuration(SEMAINE, 'sn', 'f1', 92.5)).toBe(true);
    // Les accesseurs de lecture la rendent telle quelle, sans conversion.
    expect(store.getCountryUploads(SEMAINE, 'sn')[0].duree).toBe(92.5);
    expect(store.getWeekUploads(SEMAINE).sn[0].duree).toBe(92.5);
  });

  it('rend faux pour un fichier ou un chutier inconnu', () => {
    store.addUpload(SEMAINE, 'sn', fichier('f1'));

    expect(store.setFileDuration(SEMAINE, 'sn', 'jamais-vu')).toBe(false);
    expect(store.setFileDuration(SEMAINE, 'cm', 'f1', 12)).toBe(false);
    expect(store.setFileDuration('2026-w52', 'sn', 'f1', 12)).toBe(false);
  });

  it('range une mesure inexploitable comme « inconnue », pas comme une erreur', () => {
    // ffprobe rend parfois « N/A » sur un flux abîmé : le fichier existe, sa
    // durée non. C'est une réponse, et l'affichage doit pouvoir la lire.
    store.addUpload(SEMAINE, 'sn', fichier('f1'));

    expect(store.setFileDuration(SEMAINE, 'sn', 'f1', 'N/A')).toBe(true);
    expect(store.getCountryUploads(SEMAINE, 'sn')[0].duree).toBeNull();
  });
});

describe('le champ `duree` fait partie du modèle', () => {
  it('vaut `null` et non `undefined` pour un fichier jamais mesuré', () => {
    store.addUpload(SEMAINE, 'sn', fichier('f1'));

    const [depose] = store.getCountryUploads(SEMAINE, 'sn');
    // `undefined` disparaîtrait à la sérialisation JSON : l'affichage ne
    // saurait plus distinguer « pas encore mesurée » d'un champ hors modèle.
    expect(depose.duree).toBeNull();
    expect('duree' in depose).toBe(true);
  });

  it('conserve une durée fournie dès le dépôt', () => {
    store.addUpload(SEMAINE, 'sn', { ...fichier('f2'), duree: 184 });
    expect(store.getCountryUploads(SEMAINE, 'sn')[0].duree).toBe(184);
  });
});
