import { describe, it, expect, afterEach } from 'vitest';
import { reessayerSi, tailleMorceauParDefaut, RECHARGES_RESEAU, REFUS_DEFINITIFS } from '../src/api/index.js';

/**
 * Ce qui décide qu'un envoi est perdu.
 *
 * Avant : cinq tentatives sur 38 secondes, et tout code 4xx — 429 compris —
 * abandonnait. Un correspondant qui bascule d'un relais à l'autre perdait
 * son envoi et voyait un bandeau rouge dont il n'était pas responsable.
 */

const echecReseau = () => ({ message: 'network error' });
const echecServeur = (statut) => ({
  message: `HTTP ${statut}`,
  originalResponse: { getStatus: () => statut },
});

describe('quand réessayer', () => {
  it('réessaie toujours une coupure réseau — aucune réponse reçue', () => {
    expect(reessayerSi(echecReseau())).toBe(true);
    expect(reessayerSi({})).toBe(true);
    expect(reessayerSi(null)).toBe(true);
  });

  it('réessaie un 429 : le limiteur dit « plus tard », pas « jamais »', () => {
    expect(reessayerSi(echecServeur(429))).toBe(true);
  });

  it('réessaie les pannes passagères du serveur', () => {
    for (const statut of [500, 502, 503, 504]) {
      expect(reessayerSi(echecServeur(statut)), String(statut)).toBe(true);
    }
  });

  it('renonce sur les refus qui ne changeront pas', () => {
    for (const statut of [400, 403, 413, 415, 423]) {
      expect(reessayerSi(echecServeur(statut)), String(statut)).toBe(false);
    }
    expect([...REFUS_DEFINITIFS].sort()).toEqual([400, 403, 413, 415, 423]);
  });
});

describe('patience réseau', () => {
  it('tient une dizaine de minutes, par paliers croissants', () => {
    const total = RECHARGES_RESEAU.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(9 * 60 * 1000);
    // Les paliers ne redescendent jamais : on espace, on ne s'acharne pas.
    for (let i = 1; i < RECHARGES_RESEAU.length; i += 1) {
      expect(RECHARGES_RESEAU[i]).toBeGreaterThanOrEqual(RECHARGES_RESEAU[i - 1]);
    }
  });
});

describe('taille des morceaux selon le lien', () => {
  const vraiNavigateur = globalThis.navigator;
  afterEach(() => {
    if (vraiNavigateur) Object.defineProperty(globalThis, 'navigator', { value: vraiNavigateur, configurable: true });
  });

  const avecLien = (effectiveType) => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { connection: { effectiveType } },
      configurable: true,
    });
  };

  it('réduit les morceaux sur un lien lent — un morceau perdu est un morceau à refaire', () => {
    avecLien('slow-2g');
    expect(tailleMorceauParDefaut()).toBe(1024 * 1024);
    avecLien('2g');
    expect(tailleMorceauParDefaut()).toBe(1024 * 1024);
    avecLien('3g');
    expect(tailleMorceauParDefaut()).toBe(2 * 1024 * 1024);
  });

  it('garde la valeur nominale sur un bon lien, ou sans information', () => {
    avecLien('4g');
    expect(tailleMorceauParDefaut()).toBe(5 * 1024 * 1024);
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    expect(tailleMorceauParDefaut()).toBe(5 * 1024 * 1024);
  });
});
