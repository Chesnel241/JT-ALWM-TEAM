import { describe, it, expect } from 'vitest';
import { formaterDuree, totaliserDurees, formaterTotal } from '../src/lib/duree.js';

describe('mise en forme des durées', () => {
  it('écrit les durées comme un monteur les lit', () => {
    expect(formaterDuree(42)).toBe('42 s');
    expect(formaterDuree(102)).toBe('1 min 42');
    expect(formaterDuree(600)).toBe('10 min 00');
    expect(formaterDuree(3840)).toBe('1 h 04 min');
  });

  it('arrondit à la seconde plutôt que d’étaler des décimales', () => {
    expect(formaterDuree(101.6)).toBe('1 min 42');
  });

  it('dit qu’elle ne sait pas, au lieu d’inventer un zéro', () => {
    // Une photo n'a pas de durée. « 0 s » ferait croire à un fichier vide.
    for (const valeur of [null, undefined, 0, -3, NaN, 'deux minutes']) {
      expect(formaterDuree(valeur), String(valeur)).toBeNull();
    }
  });
});

describe('total d’une liste de fichiers', () => {
  const liste = [
    { type: 'video', duree: 90 },
    { type: 'audio', duree: 30 },
    { type: 'video', duree: null },
    { type: 'script' },
    { type: 'image', duree: null },
  ];

  it('additionne les durées connues', () => {
    expect(totaliserDurees(liste).secondes).toBe(120);
    expect(formaterTotal(liste)).toBe('2 min 00');
  });

  it('compte à part les médias qu’on n’a pas su mesurer', () => {
    // Un total muet sur ce qu'il ignore est un chiffre faux : l'écran doit
    // pouvoir dire « 2 min 00, une vidéo non mesurée ».
    const { connus, inconnus } = totaliserDurees(liste);
    expect(connus).toBe(2);
    expect(inconnus).toBe(1);
  });

  it('ne compte pas un script comme un média non mesuré', () => {
    expect(totaliserDurees([{ type: 'script' }])).toEqual({ secondes: 0, connus: 0, inconnus: 0 });
  });

  it('survit à une liste absente ou mal formée', () => {
    expect(totaliserDurees()).toEqual({ secondes: 0, connus: 0, inconnus: 0 });
    expect(totaliserDurees(null)).toEqual({ secondes: 0, connus: 0, inconnus: 0 });
    expect(totaliserDurees([null, undefined])).toEqual({ secondes: 0, connus: 0, inconnus: 0 });
    expect(formaterTotal([])).toBeNull();
  });
});
