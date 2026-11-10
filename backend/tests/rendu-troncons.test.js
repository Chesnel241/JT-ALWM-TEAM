import { describe, it, expect, vi } from 'vitest';
import { decouper, avancement, avecReprises, messageEchec, reglages, placeNecessaire } from '../../worker/src/troncons.js';

// Incident (mesuré) : le moteur rend 5 à 10 images par seconde, soit 1 h 30 à
// 3 h pour un JT de 30 minutes. Rendu d'un seul tenant, un incident à la
// 170e minute faisait tout perdre. Le master est donc rendu par tronçons.
describe('rendu du master par tronçons', () => {
  it('les tronçons couvrent toutes les images, sans trou ni doublon', () => {
    for (const [total, pas] of [[54000, 1800], [1801, 1800], [1800, 1800], [1, 1800], [5399, 450]]) {
      const plages = decouper(total, pas);
      expect(plages[0][0]).toBe(0);
      expect(plages.at(-1)[1]).toBe(total - 1);
      for (let i = 1; i < plages.length; i += 1) expect(plages[i][0]).toBe(plages[i - 1][1] + 1);
      for (const [d, f] of plages) expect(f - d + 1).toBeLessThanOrEqual(pas);
    }
    expect(decouper(54000, 1800)).toHaveLength(30);
  });

  it('l’avancement ne recule jamais et n’annonce pas 100 avant le lien', () => {
    let avant = -1;
    for (let t = 0; t < 30; t += 1) {
      for (const fraction of [0, 0.5, 1]) {
        const p = avancement({ phase: 'troncons', fraction, tronconsFaits: t, nbTroncons: 30 });
        expect(p).toBeGreaterThanOrEqual(avant);
        avant = p;
      }
    }
    expect(avancement({ phase: 'assemblage', fraction: 0 })).toBeGreaterThanOrEqual(avant);
    expect(avancement({ phase: 'assemblage', fraction: 1 })).toBeLessThan(100);
  });

  it('un tronçon qui échoue est repris, et réussit au troisième essai', async () => {
    const rendre = vi.fn()
      .mockRejectedValueOnce(new Error('navigateur figé'))
      .mockRejectedValueOnce(new Error('navigateur figé'))
      .mockResolvedValue('ok');
    const journal = vi.fn();
    await expect(avecReprises(rendre, 3, journal)).resolves.toBe('ok');
    expect(rendre).toHaveBeenCalledTimes(3);
    expect(journal).toHaveBeenCalledTimes(2);
  });

  it('après trois échecs, l’erreur remonte au lieu de tourner sans fin', async () => {
    const rendre = vi.fn().mockRejectedValue(new Error('fichier abîmé'));
    await expect(avecReprises(rendre, 3)).rejects.toThrow('fichier abîmé');
    expect(rendre).toHaveBeenCalledTimes(3);
  });

  it('le message d’échec dit où regarder dans le montage', () => {
    const m = messageEchec(19800, 21599, 30, 3, new Error('No video stream\n  at trace'));
    expect(m).toContain('de 11:00 à 12:00');
    expect(m).toContain('No video stream');
    expect(m).not.toContain('at trace');
  });

  // Incident (mesuré) : deux rendus de front occupent environ 3 Go. Dans le
  // conteneur limité à 2 Go, le noyau tuait le moteur sans message.
  it('dans 2 Go, un seul rendu à la fois et un cache réduit', () => {
    expect(reglages({ memoireMo: 2048, coeurs: 4 })).toEqual({ concurrence: 1, cacheMo: 256 });
  });

  it('avec 4 Go et deux cœurs, deux rendus de front', () => {
    expect(reglages({ memoireMo: 4096, coeurs: 2 })).toEqual({ concurrence: 2, cacheMo: 512 });
    expect(reglages({ memoireMo: 4096, coeurs: 1 }).concurrence).toBe(1);
  });

  it('une valeur imposée par la configuration reste prioritaire', () => {
    expect(reglages({ memoireMo: 2048, coeurs: 4, concurrenceVoulue: '3', cacheVouluMo: '128' }))
      .toEqual({ concurrence: 3, cacheMo: 128 });
  });

  // Un master de 2 Go existe deux fois le temps de l'assemblage : mieux vaut
  // refuser au départ que d'échouer après trois heures.
  it('la place demandée couvre les tronçons et le master final', () => {
    const trenteMinutes = placeNecessaire(54000, 30);
    expect(trenteMinutes).toBeGreaterThan(2 * 2.1e9);
    expect(trenteMinutes).toBeLessThan(8e9);
    expect(placeNecessaire(900, 30)).toBeLessThan(1e9);
  });
});
