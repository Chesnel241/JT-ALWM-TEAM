import { describe, it, expect } from 'vitest';
import { estChutier, chutierARouvrir, doitRestaurer } from '../src/lib/chutiers.js';

// L'INCIDENT (tests de bout en bout, e2e/montage.spec.js) : après un passage
// par l'onglet Jingles, « Rushes reçus » rouvrait les jingles. Il n'y avait
// plus moyen de revenir aux rushes sans recharger la page.

const SPECIAUX = ['delivery', 'mj', 'tj', 'studio', 'jingles'];
const valideAvec = (pays) => (bin) => SPECIAUX.includes(bin) || pays.includes(bin);

describe('les chutiers de l’espace montage', () => {
  it('un pays ou une rubrique est un chutier ; le studio, les jingles et la livraison non', () => {
    for (const bin of ['cm', 'sn', 'tj', 'mj']) expect(estChutier(bin), bin).toBe(true);
    for (const bin of ['studio', 'jingles', 'delivery', '', null, undefined]) expect(estChutier(bin), String(bin)).toBe(false);
  });

  it('« Rushes reçus » ne rouvre jamais les jingles, même si c’est le dernier écran vu', () => {
    const cible = chutierARouvrir({ dernier: 'jingles', memorise: 'jingles', avecEnvois: ['cd'], estValide: valideAvec(['cd']), defaut: 'cm' });
    expect(cible).toBe('cd');
  });

  it('ni la livraison, ni le studio', () => {
    expect(chutierARouvrir({ dernier: 'delivery', memorise: 'studio', avecEnvois: [], estValide: valideAvec([]), defaut: 'cm' })).toBe('cm');
  });

  it('rouvre le dernier pays consulté, avant celui gardé en mémoire, avant le premier qui a envoyé', () => {
    const estValide = valideAvec(['cm', 'sn', 'ma']);
    expect(chutierARouvrir({ dernier: 'sn', memorise: 'ma', avecEnvois: ['cm'], estValide, defaut: 'tj' })).toBe('sn');
    expect(chutierARouvrir({ dernier: null, memorise: 'ma', avecEnvois: ['cm'], estValide, defaut: 'tj' })).toBe('ma');
    expect(chutierARouvrir({ dernier: null, memorise: null, avecEnvois: ['cm'], estValide, defaut: 'tj' })).toBe('cm');
  });

  it('écarte un pays qui n’a plus rien (semaine changée)', () => {
    expect(chutierARouvrir({ dernier: 'sn', memorise: null, avecEnvois: ['cm'], estValide: valideAvec(['cm']), defaut: 'tj' })).toBe('cm');
  });
});

describe('l’écran mémorisé', () => {
  const estValide = valideAvec(['sn']);

  it('se rouvre à l’ouverture de la page, quel qu’il soit', () => {
    expect(doitRestaurer({ courant: null, memorise: 'jingles', estValide })).toBe(true);
    expect(doitRestaurer({ courant: null, memorise: 'sn', estValide })).toBe(true);
  });

  // Le second visage de l'incident : sur une semaine où aucun pays n'a
  // encore envoyé, « Rushes reçus » ouvrait un pays vide, que cette
  // restauration remplaçait aussitôt par les jingles mémorisés.
  it('ne remplace pas des rushes vides par les jingles, la livraison ou le studio', () => {
    for (const ecran of ['jingles', 'delivery', 'studio']) {
      expect(doitRestaurer({ courant: 'cm', memorise: ecran, estValide }), ecran).toBe(false);
    }
  });

  it('remplace un pays vide par le pays mémorisé qui a des fichiers', () => {
    expect(doitRestaurer({ courant: 'cm', memorise: 'sn', estValide })).toBe(true);
  });

  it('ne rouvre pas un écran qui n’existe plus cette semaine', () => {
    expect(doitRestaurer({ courant: null, memorise: 'ci', estValide })).toBe(false);
    expect(doitRestaurer({ courant: null, memorise: null, estValide })).toBe(false);
  });
});
