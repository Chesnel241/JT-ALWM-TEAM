import { describe, it, expect } from 'vitest';
import {
  styleTexte, styleLettre, styleMasque, dureeHabillage,
  ENTREES, ENTREES_PLATES, BOUCLES, SORTIES, PAR_LETTRE,
} from '../../remotion/src/mouvement.js';
import { MOUVEMENT, images } from '../../remotion/src/identite.js';
import { TEXT_ANIMATIONS_IN, TEXT_ANIMATIONS_LOOP, TEXT_ANIMATIONS_OUT } from '../src/data/overlayTemplates.js';

/**
 * Le premier filet jamais posé sur le moteur de rendu.
 *
 * `remotion/src` produit le JT diffusé et comptait zéro test. C'est ce vide
 * qui a laissé vivre `anim.js` : 205 lignes implémentant entrée, boucle et
 * sortie, appelées par personne, pendant que les trois menus du studio
 * promettaient des mouvements qui n'existaient pas à l'image.
 *
 * Rien ici ne monte de composant : ce sont des mathématiques d'images, et
 * elles se testent comme telles.
 */

const FPS = 30;
const DUREE = 90;          // 3 s
const SANS_FIN = 99999;    // ce que JTMaster donne à un habillage sans durée

describe('ce que le monteur choisit finit par bouger', () => {
  it('un texte arrive : invisible au départ, posé à la fin de l’entrée', () => {
    const debut = styleTexte({ frame: 0, durationInFrames: DUREE, fps: FPS, animation: 'fade' });
    const pose = styleTexte({ frame: images(MOUVEMENT.entree, FPS), durationInFrames: DUREE, fps: FPS, animation: 'fade' });

    expect(debut.opacity).toBe(0);
    expect(pose.opacity).toBe(1);
  });

  it('chaque entrée proposée produit un état différent du repos', () => {
    // Le défaut d'origine : un menu de quinze entrées dont aucune ne changeait
    // quoi que ce soit à l'image.
    const repos = { opacity: 1 };
    // Trois mouvements ne passent pas par le style d'ensemble : `mask_reveal`
    // agit sur la boîte (`styleMasque`), `typewriter` et `cascade` sur chaque
    // lettre (`styleLettre`). Ils sont vérifiés par leurs propres tests.
    const parStyle = ENTREES_PLATES.filter((a) => !PAR_LETTRE.has(a) && a !== 'mask_reveal');
    parStyle.forEach((animation) => {
      const milieu = styleTexte({
        frame: Math.round(images(MOUVEMENT.entree, FPS) / 3),
        durationInFrames: DUREE, fps: FPS, animation,
      });
      expect(JSON.stringify(milieu), animation).not.toBe(JSON.stringify(repos));
    });
  });

  it('les entrées se distinguent les unes des autres', () => {
    // Deux mouvements qui rendent le même style sont un seul mouvement
    // présenté deux fois.
    const f = Math.round(images(MOUVEMENT.entree, FPS) / 3);
    const rendus = ENTREES_PLATES
      // Trois sont portées par le découpage du texte, pas par un style global.
      .filter((a) => !PAR_LETTRE.has(a) && a !== 'mask_reveal')
      .map((a) => JSON.stringify(styleTexte({ frame: f, durationInFrames: DUREE, fps: FPS, animation: a })));
    expect(new Set(rendus).size).toBe(rendus.length);
  });

  it('les boucles bougent une fois l’entrée terminée, et pas avant', () => {
    const apres = images(MOUVEMENT.entree, FPS) + 20;
    const immobile = styleTexte({ frame: apres, durationInFrames: SANS_FIN, fps: FPS, boucle: 'none' });
    const flottant = styleTexte({ frame: apres, durationInFrames: SANS_FIN, fps: FPS, boucle: 'float' });

    expect(immobile.transform).toBeUndefined();
    expect(flottant.transform).toMatch(/translateY/);
  });
});

describe('la sortie n’existe que si la fin existe', () => {
  it('s’efface à l’approche de la fin d’un habillage borné', () => {
    const avant = styleTexte({ frame: DUREE - images(MOUVEMENT.sortie, FPS) - 1, durationInFrames: DUREE, fps: FPS });
    const fin = styleTexte({ frame: DUREE - 1, durationInFrames: DUREE, fps: FPS });

    expect(avant.opacity).toBe(1);
    expect(fin.opacity).toBeLessThan(0.2);
  });

  it('ne s’efface jamais quand la durée n’est pas bornée', () => {
    // JTMaster donne 99999 à tout habillage dont la durée n'est pas
    // renseignée — et le studio annonce « vide = toute la vidéo ». Un test
    // `frame > durée - 30` serait alors faux en permanence : mieux vaut
    // reconnaître le cas que faire semblant.
    [1000, 50000, SANS_FIN - 2].forEach((frame) => {
      expect(styleTexte({ frame, durationInFrames: SANS_FIN, fps: FPS }).opacity, `image ${frame}`).toBe(1);
    });
  });

  it('répond à l’entrée quand on ne choisit pas de sortie', () => {
    // « auto » : un texte entré en glissant repart en glissant, un texte entré
    // en fondu repart en fondu. Le choix courant redevient un seul geste.
    const fin = DUREE - 2;
    const glisse = styleTexte({ frame: fin, durationInFrames: DUREE, fps: FPS, animation: 'slide', sortie: 'auto' });
    const flou = styleTexte({ frame: fin, durationInFrames: DUREE, fps: FPS, animation: 'blurin', sortie: 'auto' });

    expect(glisse.transform).toMatch(/translateX/);
    expect(flou.filter).toMatch(/blur/);
  });

  it('respecte une sortie choisie explicitement', () => {
    const s = styleTexte({ frame: DUREE - 2, durationInFrames: DUREE, fps: FPS, animation: 'fade', sortie: 'scale_down' });
    expect(s.transform).toMatch(/scale/);
  });
});

describe('ce qui ne doit jamais casser', () => {
  it('un identifiant inconnu donne un fondu, pas un écran vide', () => {
    // Des montages enregistrés portent des valeurs que ces menus ne proposent
    // plus. Faire disparaître leur titre serait pire que de l'animer mal.
    const inconnu = styleTexte({ frame: 60, durationInFrames: DUREE, fps: FPS, animation: 'tourbillon_arc_en_ciel' });
    expect(inconnu.opacity).toBe(1);
    expect(inconnu.transform).toBeUndefined();
  });

  it('survit à une durée nulle, négative ou absente', () => {
    [0, -10, undefined, null, NaN].forEach((durationInFrames) => {
      const s = styleTexte({ frame: 5, durationInFrames, fps: FPS });
      expect(Number.isFinite(s.opacity), String(durationInFrames)).toBe(true);
      expect(s.opacity).toBeGreaterThanOrEqual(0);
      expect(s.opacity).toBeLessThanOrEqual(1);
    });
  });

  it('survit à une cadence absurde', () => {
    [0, -1, undefined].forEach((fps) => {
      expect(() => styleTexte({ frame: 5, durationInFrames: DUREE, fps })).not.toThrow();
    });
  });

  it('ne rend jamais une opacité hors des bornes', () => {
    ENTREES_PLATES.forEach((animation) => {
      for (let f = 0; f <= DUREE; f += 3) {
        const { opacity } = styleTexte({ frame: f, durationInFrames: DUREE, fps: FPS, animation });
        expect(opacity, `${animation} à l’image ${f}`).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('le minutage suit la cadence', () => {
  it('une entrée dure le même temps en 25 comme en 30 images par seconde', () => {
    // Les quinze habillages importés codaient des nombres d'images bruts :
    // leur minutage se décalait dès qu'on changeait de cadence.
    [24, 25, 30, 50, 60].forEach((fps) => {
      const fin = images(MOUVEMENT.entree, fps);
      expect(styleTexte({ frame: fin, durationInFrames: fps * 3, fps }).opacity, `${fps} i/s`).toBe(1);
      expect(styleTexte({ frame: 0, durationInFrames: fps * 3, fps }).opacity).toBe(0);
    });
  });
});

describe('lettre par lettre', () => {
  it('la machine à écrire pose les lettres l’une après l’autre', () => {
    const commun = { total: 10, fps: FPS, animation: 'typewriter' };
    expect(styleLettre({ ...commun, index: 0, frame: 0 }).opacity).toBe(1);
    expect(styleLettre({ ...commun, index: 9, frame: 0 }).opacity).toBe(0);
    expect(styleLettre({ ...commun, index: 9, frame: 60 }).opacity).toBe(1);
  });

  it('la cascade fait monter chaque lettre à son tour', () => {
    const s = styleLettre({ index: 3, total: 10, frame: 2, fps: FPS, animation: 'cascade' });
    expect(s.transform).toMatch(/translateY/);
    expect(s.opacity).toBeLessThan(1);
  });

  it('un titre long reste lisible : le décalage est plafonné', () => {
    // Un décalage constant par lettre ferait attendre plusieurs secondes la
    // dernière lettre d'un gros titre.
    const derniere = styleLettre({ index: 79, total: 80, frame: images(MOUVEMENT.entree, FPS), fps: FPS, animation: 'typewriter' });
    expect(derniere.opacity).toBe(1);
  });
});

describe('la révélation par masque', () => {
  it('découvre la boîte de gauche à droite', () => {
    expect(styleMasque({ frame: 0, fps: FPS }).clipPath).toBe('inset(0 100.00% 0 0)');
    expect(styleMasque({ frame: images(MOUVEMENT.entree, FPS), fps: FPS }).clipPath).toBe('inset(0 0.00% 0 0)');
  });
});

describe('le studio et le moteur proposent la même chose', () => {
  it('toute entrée du menu est implémentée', () => {
    const orphelines = TEXT_ANIMATIONS_IN.map((a) => a.id).filter((id) => !ENTREES_PLATES.includes(id));
    expect(orphelines, `proposées mais non implémentées : ${orphelines.join(', ')}`).toEqual([]);
  });

  it('toute entrée implémentée est proposée', () => {
    const cachees = ENTREES_PLATES.filter((id) => !TEXT_ANIMATIONS_IN.some((a) => a.id === id));
    expect(cachees, `implémentées mais introuvables : ${cachees.join(', ')}`).toEqual([]);
  });

  it('boucles et sorties s’accordent aussi', () => {
    const boucles = TEXT_ANIMATIONS_LOOP.map((a) => a.id);
    expect(boucles.filter((id) => !BOUCLES.includes(id))).toEqual([]);

    const sorties = TEXT_ANIMATIONS_OUT.map((a) => a.id);
    expect(sorties.filter((id) => !SORTIES.includes(id))).toEqual([]);
  });

  it('les trois familles d’intention sont non vides et sans doublon', () => {
    Object.entries(ENTREES).forEach(([famille, liste]) => {
      expect(liste.length, famille).toBeGreaterThan(0);
    });
    expect(new Set(ENTREES_PLATES).size).toBe(ENTREES_PLATES.length);
  });
});

describe('la durée qu’un habillage reçoit quand le monteur n’en fixe pas', () => {
  /**
   * L'incident, vérifié au banc de rendu.
   *
   * Le champ du studio annonce « vide = toute la vidéo ». `JTMaster` traduisait
   * cela par 99 999 images — cinquante-cinq minutes. Le test `frame >
   * durationInFrames - 30` que porte chaque habillage était donc faux en
   * permanence : **la sortie ne se jouait jamais**, et le bandeau était coupé
   * net à la coupe. Les rendus avant / après le montrent sur le titre de
   * reportage, le flash, l'alerte et la barre défilante.
   *
   * La règle vivait recopiée aux trois endroits de `JTMaster`. C'est cette
   * triplication qui l'a laissée passer : elle est ici, une fois.
   */
  it('hérite de ce qui reste de son plan', () => {
    // Un plan de 120 images, un bandeau posé à la 30ᵉ : il lui en reste 90.
    expect(dureeHabillage(null, 120, 30)).toBe(90);
    expect(dureeHabillage(0, 120, 0)).toBe(120);
    expect(dureeHabillage(undefined, 300, 0)).toBe(300);
  });

  it('respecte la durée que le monteur a fixée', () => {
    expect(dureeHabillage(45, 120, 30)).toBe(45);
    // Même quand elle dépasse le plan : c'est son choix, et `Sequence` coupe.
    expect(dureeHabillage(400, 120, 0)).toBe(400);
  });

  it('ne rend jamais 99 999', () => {
    // Le test qui aurait attrapé le défaut.
    expect(dureeHabillage(null, 120, 0)).toBeLessThan(1000);
    expect(dureeHabillage(null, 90, 10)).toBeLessThan(1000);
  });

  it('survit à un habillage posé après la fin de sa porteuse', () => {
    // Une image plutôt qu'une durée nulle ou négative : `Sequence` refuse zéro.
    expect(dureeHabillage(null, 120, 200)).toBe(1);
    expect(dureeHabillage(null, 120, 120)).toBe(1);
    expect(dureeHabillage(null, NaN, 0)).toBe(1);
    expect(dureeHabillage(null, -5, 0)).toBe(1);
  });

  it('rend un nombre entier d’images', () => {
    // Une durée fractionnaire ferait tomber la sortie entre deux images.
    expect(Number.isInteger(dureeHabillage(null, 120.4, 30.7))).toBe(true);
    expect(Number.isInteger(dureeHabillage(45.6, 120, 0))).toBe(true);
  });

  it('donne une sortie, là où 99 999 n’en donnait aucune', () => {
    // La conséquence qui compte : avec la durée héritée, le style de sortie
    // bouge dans les dernières images ; avec l'ancienne valeur, jamais.
    const duree = dureeHabillage(null, 120, 0);
    const finAvant = styleTexte({ frame: duree - 2, durationInFrames: duree, fps: 30, sortie: 'fade' });
    const finApres = styleTexte({ frame: 99999 - 2, durationInFrames: 99999, fps: 30, sortie: 'fade' });
    expect(finAvant.opacity, 'la sortie ne se joue toujours pas').toBeLessThan(1);
    expect(finApres.opacity, 'une durée aberrante ne doit pas produire de sortie').toBe(1);
  });
});
