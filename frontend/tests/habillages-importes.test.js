import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Trois défauts d'antenne des quinze habillages importés, tenus par des tests
 * de source plutôt que de rendu — dans l'esprit de celui qui interdit déjà les
 * couleurs codées en dur.
 *
 * Aucun ne se voyait à la lecture du code ni dans une suite : il a fallu
 * rendre un MP4 et regarder les images. Ces tests-ci ne remplacent pas le
 * banc de rendu ; ils empêchent le retour en arrière.
 */

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), '../../remotion/src/overlays');
const fichiers = readdirSync(DOSSIER).filter((n) => n.startsWith('envato_') && n.endsWith('.jsx'));
const lire = (n) => readFileSync(join(DOSSIER, n), 'utf8');

describe('la fenêtre de sortie et son amorti', () => {
  it('amortit sur toute la fenêtre, et pas sur deux tiers', () => {
    // `OUT_DUR = 30` mais `getExpEaseOut(outFrame, 0, 20)` : l'élément avait
    // fini de disparaître dix images avant la fin de la fenêtre, et restait
    // effacé et immobile pendant ce temps. Quatorze emplacements sur quinze.
    const fautifs = [];
    fichiers.forEach((nom) => {
      const lignes = lire(nom).split('\n');
      lignes.forEach((ligne, i) => {
        const amorti = ligne.match(/getExpEaseOut\(outFrame,\s*0,\s*(\d+)\)/);
        if (!amorti) return;
        // La fenêtre est déclarée quelques lignes plus haut, sous l'une ou
        // l'autre des deux écritures que les quinze fichiers emploient.
        let fenetre = null;
        for (let j = Math.max(0, i - 6); j < i; j += 1) {
          const m = lignes[j].match(/OUT_DUR = (\d+)/) || lignes[j].match(/durationInFrames - (\d+)/);
          if (m) fenetre = m[1];
        }
        if (fenetre && fenetre !== amorti[1]) fautifs.push(`${nom}:${i + 1} — fenêtre ${fenetre}, amorti ${amorti[1]}`);
      });
    });
    expect(fautifs).toEqual([]);
  });

  it('couvre bien les quinze habillages', () => {
    // Si ce compte change, c'est que le test précédent en regarde moins qu'il
    // ne le croit — un test qui ne voit rien passe toujours.
    const sorties = fichiers.reduce((n, nom) => n + (lire(nom).match(/getExpEaseOut\(outFrame/g) || []).length, 0);
    expect(sorties).toBe(15);
  });
});

describe('une révélation autour d’un enfant en absolu', () => {
  it('reçoit une boîte, sinon elle ne révèle rien', () => {
    // `EnvatoMaskReveal` rend un <div> EN FLUX. Autour d'un enfant en
    // `position: absolute`, sa boîte fait 0 × 0 et un `inset()` en pourcentage
    // ne se résout contre rien. Le rendu l'a confirmé : dans l'écran scindé,
    // le séparateur diagonal et le liseré n'apparaissaient jamais — sans doute
    // depuis l'import.
    const source = lire('envato_split_screens.jsx');
    const enveloppes = source.match(/<EnvatoMaskReveal[^>]*direction="(vertical|horizontal)"[^>]*>/g) || [];
    expect(enveloppes.length, 'le séparateur et le liseré ont disparu du gabarit').toBe(2);
    enveloppes.forEach((balise) => {
      expect(balise, `${balise} n'a pas de boîte`).toMatch(/position:\s*'absolute'/);
      expect(balise).toMatch(/inset:\s*0/);
    });
  });
});

describe('la barre défilante', () => {
  const source = lire('envato_titles.jsx');

  it('boucle sur sa propre longueur au lieu de partir à l’infini', () => {
    // `-(frame * speed)` sans repli : à 4 px par image, la bande avait quitté
    // l'écran au bout d'une trentaine de secondes et n'y revenait plus. Un JT
    // de trois minutes montrait une barre vide pendant deux minutes trente.
    expect(source, 'le défilement est reparti à l’infini').not.toMatch(/translateX\(\$\{translateX\}px\)/);
    expect(source).toMatch(/frame % cycleImages/);
  });

  it('rend la bande deux fois, sinon la boucle laisse un trou', () => {
    // Translater de la moitié de sa propre largeur ne déplace exactement une
    // copie que s'il y en a deux. Avec une seule, le raccord se voit.
    const copies = (source.match(/<span>\{bande\}<\/span>/g) || []).length;
    expect(copies).toBe(2);
    expect(source).toMatch(/width:\s*'max-content'/);
  });

  it('se cale sur la cadence reçue et non sur 30 sous-entendu', () => {
    // Les quinze importés codaient des nombres d'images bruts ; quatre
    // importaient `useVideoConfig` sans jamais s'en servir. Le jour où un JT
    // sort en 25 images par seconde, tout leur minutage se décale.
    const ticker = source.slice(source.indexOf('export function EnvatoTicker'));
    expect(ticker).toMatch(/const \{ fps \} = useVideoConfig\(\)/);
    expect(ticker).toMatch(/cycleImages[^\n]*fps/);
  });
});

describe('la charte typographique est lue, et non décorative', () => {
  const NATIFS = join(dirname(fileURLToPath(import.meta.url)), '../../remotion/src/overlays/index.jsx');
  const source = readFileSync(NATIFS, 'utf8');

  it('ne nomme plus aucune police en clair dans les gabarits', () => {
    // `CARACTERES` existait depuis le lot 2 — et **aucun gabarit ne le
    // lisait** : trente-deux déclarations nommaient Montserrat ou Inter en
    // clair. La charte était donc décorative pour la typographie, et la
    // bascule « d'une seule ligne » annoncée n'aurait rien changé à l'image.
    // Le rendu avant / après l'a montré : deux plans identiques.
    const enClair = source
      .split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => /['"]Montserrat|['"]Inter['"]/.test(l) && !l.trimStart().startsWith('//'))
      .map(([n, l]) => `${n}: ${l.trim().slice(0, 70)}`);
    expect(enClair).toEqual([]);
  });

  it('pose bien les deux piles de la charte', () => {
    // Un test qui ne voit rien passe toujours : si les substitutions
    // disparaissaient, le test précédent serait vert pour la mauvaise raison.
    expect((source.match(/PILES\.titrage/g) || []).length).toBeGreaterThanOrEqual(15);
    expect((source.match(/PILES\.courant/g) || []).length).toBeGreaterThanOrEqual(8);
  });

  it('garde Montserrat en second, pour ne pas retomber sur la police système', () => {
    // La leçon du lot 3 : une déclaration invalide avait fait retomber quinze
    // habillages en serif sans que personne ne s'en aperçoive. Si un fichier
    // de fonte manque côté worker, le JT doit sortir dans la police d'avant.
    const charte = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../remotion/src/identite.js'), 'utf8');
    const debut = charte.indexOf('export const PILES');
    const piles = charte.slice(debut, charte.indexOf('};', debut));
    expect(piles).toMatch(/Montserrat ExtraBold/);
    expect(piles).toMatch(/Montserrat Medium/);
    // Et aucune famille vide entre deux virgules — le défaut exact du lot 3.
    expect(piles).not.toMatch(/,\s*,/);
  });
});
