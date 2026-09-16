import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Ce qui était écrit et ne faisait rien.
 *
 * Deux familles, la même cause : une déclaration que le navigateur jette en
 * silence. Rien ne casse, rien n'avertit, et l'effet annoncé n'existe pas.
 *
 * 1. Dix composants portaient `animate-in fade-in zoom-in-95 duration-200` et
 *    consorts — la syntaxe du greffon `tailwindcss-animate`, qui n'est ni dans
 *    `package.json` ni dans `tailwind.config.js`. Les panneaux et les boîtes
 *    apparaissaient d'un coup.
 * 2. `var(--primary)` n'est défini nulle part : une variable CSS indéfinie
 *    **sans valeur de repli rend toute la déclaration invalide**, et la
 *    couleur retombe sur l'héritée. C'est exactement le défaut qui avait fait
 *    sortir quinze habillages en serif au lot 3, ici côté web.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src');
const RACINE = join(SRC, '..');

const fichiers = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (
  e.isDirectory() ? fichiers(join(dossier, e.name)) : (e.name.endsWith('.jsx') ? [join(dossier, e.name)] : [])
));

const css = readFileSync(join(SRC, 'index.css'), 'utf8');

describe('les classes d’animation', () => {
  it('ne nomment pas un greffon absent', () => {
    const greffonInstalle = /tailwindcss-animate/.test(readFileSync(join(RACINE, 'package.json'), 'utf8'))
      && /tailwindcss-animate/.test(readFileSync(join(RACINE, 'tailwind.config.js'), 'utf8'));
    if (greffonInstalle) return;

    const inertes = [];
    fichiers(SRC).forEach((f) => {
      readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
        if (/\banimate-in\b|\bfade-in-|\bslide-in-from|\bzoom-in-/.test(ligne)) {
          inertes.push(`${f.slice(SRC.length + 1)}:${i + 1}`);
        }
      });
    });
    expect(inertes, 'ces classes viennent de `tailwindcss-animate`, qui n’est pas installé').toEqual([]);
  });

  it('s’appuient sur l’échelle de mouvement de la maison', () => {
    // Un test qui ne voit rien passe toujours : si les classes de
    // remplacement disparaissaient, le précédent serait vert pour la mauvaise
    // raison. Et elles doivent emprunter durées et courbes à la charte plutôt
    // que d'en inventer.
    expect(css).toMatch(/\.motion-boite\s*\{/);
    expect(css).toMatch(/\.motion-voile\s*\{/);
    const bloc = css.slice(css.indexOf('.motion-boite'), css.indexOf('.motion-voile') + 200);
    expect(bloc).toMatch(/var\(--motion-enter\)/);
    expect(bloc).toMatch(/var\(--ease-/);
  });

  it('sont couvertes par le respect de `prefers-reduced-motion`', () => {
    // Le garde global neutralise toute animation : c'est ce qui dispense
    // d'écrire une exception par classe, et ce qu'il ne faut pas perdre.
    const garde = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(garde).toMatch(/animation-duration:\s*1ms\s*!important/);
  });
});

describe('les jetons de la charte', () => {
  it('sont tous définis quelque part', () => {
    // Une variable CSS indéfinie sans valeur de repli invalide toute la
    // déclaration : la couleur annoncée n'arrive jamais, et rien ne le dit.
    const definis = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const fantomes = [];
    fichiers(SRC).forEach((f) => {
      readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
        [...ligne.matchAll(/var\(--([a-z0-9-]+)/g)].forEach((m) => {
          if (!definis.has(m[1])) fantomes.push(`${f.slice(SRC.length + 1)}:${i + 1} → --${m[1]}`);
        });
      });
    });
    expect(fantomes, 'ces jetons ne sont définis nulle part').toEqual([]);
  });
});
