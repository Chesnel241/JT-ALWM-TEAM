import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURBES, doux, franc, poser } from '../../remotion/src/overlays/paquet.jsx';

// LE CONSTAT : tous les calques entraient avec la même courbe. Propre, mais
// tout se posait de la même façon, et un JT entier paraissait mécanique. Une
// alerte claque et repart vite ; un chiffre se pose et laisse le temps de lire.

const SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../remotion/src/overlays/paquet.jsx'), 'utf8');
const pas = Array.from({ length: 41 }, (_, i) => i / 40);

describe('les courbes de mouvement par famille', () => {
  it('partent de rien, arrivent pile, et ne reculent jamais', () => {
    for (const courbe of [poser, franc, doux]) {
      expect(courbe(0)).toBe(0);
      expect(courbe(1)).toBe(1);
      const valeurs = pas.map(courbe);
      valeurs.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(valeurs[i]));
      // Sans dépassement : un habillage d'information ne rebondit pas.
      expect(Math.max(...valeurs)).toBeLessThanOrEqual(1);
    }
  });

  it('l’alerte arrive plus vite que la pose de base, la donnée plus lentement', () => {
    expect(franc(0.2)).toBeGreaterThan(poser(0.2));
    expect(doux(0.2)).toBeLessThan(poser(0.2));
  });

  it('l’alerte repart plus vite, la donnée prend son temps', () => {
    expect(COURBES.franc.sortie).toBeLessThan(COURBES.poser.sortie);
    expect(COURBES.doux.sortie).toBeGreaterThan(COURBES.poser.sortie);
  });

  it('chaque famille porte sa courbe', () => {
    const courbeDe = (nom) => {
      const debut = SOURCE.indexOf(`export function ${nom}(`);
      const appel = SOURCE.slice(debut, debut + 300).match(/useCalques\(durationInFrames(?:, '(\w+)')?\)/);
      return appel?.[1] || 'poser';
    };
    for (const nom of ['AlerteBandeau', 'Flash', 'DerniereMinute']) expect(courbeDe(nom)).toBe('franc');
    for (const nom of ['ChiffreCle', 'Essentiel']) expect(courbeDe(nom)).toBe('doux');
    for (const nom of ['NomBandeau', 'TitreBandeau', 'GrandTitre']) expect(courbeDe(nom)).toBe('poser');
  });
});
