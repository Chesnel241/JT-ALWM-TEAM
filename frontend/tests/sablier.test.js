import { describe, it, expect } from 'vitest';
import {
  niveaux,
  etatSablier,
  volumeDepuisGoulot,
  volumeDepuisCulot,
  VOLUME_TOTAL,
  REMPLISSAGE_MAX,
  CULOT,
} from '../src/lib/sablier.js';

/**
 * La géométrie du sablier du compte à rebours.
 *
 * LE BESOIN (le propriétaire) : « au lieu d'une jauge, un grand sablier
 * dynamique, réaliste ». Un sablier n'est crédible que si son sable se
 * comporte comme du sable : ce qui quitte l'ampoule du haut arrive dans celle
 * du bas, le niveau bouge à peine dans la panse et file près du goulot, et
 * plus rien ne coule une fois tout passé. Ces tests le vérifient sur le calcul
 * seul, sans dessin.
 */

const PRES = 1e-6;

describe('le sablier', () => {
  it('est plein en haut au début de la semaine, vide en haut à la clôture', () => {
    expect(niveaux(1).haut).toBeCloseTo(REMPLISSAGE_MAX, 5);
    expect(niveaux(1).bas).toBe(0);
    expect(niveaux(0).haut).toBe(0);
    expect(niveaux(0).bas).toBeGreaterThan(0.3);
  });

  it.each([0.95, 0.7, 0.5, 0.3, 0.05])('passe le sable en volume : à %s du temps, rien ne se perd', (f) => {
    const { haut, bas } = niveaux(f);
    const enHaut = volumeDepuisGoulot(haut);
    const enBas = volumeDepuisCulot(1 - bas);
    expect(Math.abs(enHaut - f * VOLUME_TOTAL)).toBeLessThan(PRES * 10);
    expect(Math.abs(enBas - (1 - f) * VOLUME_TOTAL)).toBeLessThan(PRES * 10);
    expect(enHaut + enBas).toBeCloseTo(VOLUME_TOTAL, 5);
  });

  it('baisse à peine dans la panse, et file près du goulot', () => {
    // Le même dixième du temps, au début puis à la fin de la semaine.
    const debut = niveaux(1).haut - niveaux(0.9).haut;
    const fin = niveaux(0.1).haut - niveaux(0).haut;
    expect(fin).toBeGreaterThan(debut * 3);
  });

  it('ne remonte jamais : plus le temps passe, plus le haut se vide et le bas se remplit', () => {
    let precedent = niveaux(1);
    for (let f = 0.98; f >= 0; f -= 0.02) {
      const courant = niveaux(f);
      expect(courant.haut).toBeLessThanOrEqual(precedent.haut + PRES);
      expect(courant.bas).toBeGreaterThanOrEqual(precedent.bas - PRES);
      precedent = courant;
    }
  });

  it('fait tomber le filet jusqu’au sommet du tas, puis l’arrête', () => {
    const moitie = etatSablier(0.5);
    expect(moitie.coule).toBe(true);
    expect(moitie.filet.y2).toBe(moitie.tas.ySommet);
    // Le tas est un cône : son sommet dépasse son bord.
    expect(moitie.tas.ySommet).toBeLessThan(moitie.tas.yBord);

    const clos = etatSablier(0);
    expect(clos.coule).toBe(false);
    expect(clos.filet).toBeNull();
    expect(clos.surfaceHaut).toBeNull();
  });

  it('coule jusqu’au culot tant que le bas est vide', () => {
    const e = etatSablier(1);
    expect(e.tas).toBeNull();
    expect(e.filet.y2).toBe(CULOT);
  });

  it.each([Number.NaN, -0.4, 1.7, undefined])('tient bon face à une part de temps aberrante (%s)', (f) => {
    const { haut, bas } = niveaux(f);
    expect(haut).toBeGreaterThanOrEqual(0);
    expect(haut).toBeLessThanOrEqual(REMPLISSAGE_MAX + PRES);
    expect(bas).toBeGreaterThanOrEqual(0);
    expect(bas).toBeLessThanOrEqual(1);
  });
});
