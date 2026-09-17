import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  COULEURS, TYPO, LETTRAGE, INTERLIGNE, MOUVEMENT, RESSORT, CARACTERES, versAss, images,
} from '../../remotion/src/identite.js';

/**
 * Une seule identité, lue par les trois formes d'un habillage.
 *
 * Le même titre existe en trois exemplaires — l'aperçu du studio, le rendu
 * Remotion, le repli libass — et quatre palettes se contredisaient : le bleu
 * du JT valait #0057D9 dans theme.js, #14143C dans overlays/index.jsx,
 * #0046C0 côté ASS, et #0d4d8b dans la charte web relevée sur le logo. Rien
 * ne les comparait.
 *
 * Ces tests ne jugent pas du goût : ils vérifient qu'une décision prise à un
 * endroit vaut partout.
 */

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('la charte descend du logo', () => {
  it('reprend exactement les deux bleus de la charte web', () => {
    // `frontend/src/index.css` les a relevés sur logo-lwm.png et en a mesuré
    // les contrastes. L'antenne n'a aucune raison d'en utiliser d'autres.
    const css = fs.readFileSync(path.join(RACINE, 'frontend/src/index.css'), 'utf8');
    const lire = (nom) => new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1];

    expect(lire('brand-navy')?.toUpperCase()).toBe(COULEURS.structure.toUpperCase());
    expect(lire('brand-sky')?.toUpperCase()).toBe(COULEURS.accent.toUpperCase());
  });

  it('range ses bleus du plus sombre au plus clair', () => {
    // Le fond doit rester derrière la structure, qui reste derrière l'accent :
    // c'est cette hiérarchie qui fait lire un bandeau sur une image.
    const clarte = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(clarte(COULEURS.fond)).toBeLessThan(clarte(COULEURS.structure));
    expect(clarte(COULEURS.structure)).toBeLessThan(clarte(COULEURS.accentSoutenu));
    expect(clarte(COULEURS.accentSoutenu)).toBeLessThan(clarte(COULEURS.accent));
  });

  it('évite le blanc et le noir absolus, qui bavent au ré-encodage', () => {
    expect(COULEURS.papier.toUpperCase()).not.toBe('#FFFFFF');
    expect(COULEURS.encre.toUpperCase()).not.toBe('#000000');
    // Mais ils restent des extrêmes crédibles, pas des gris.
    const canaux = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(Math.min(...canaux(COULEURS.papier))).toBeGreaterThan(230);
    expect(Math.max(...canaux(COULEURS.encre))).toBeLessThan(60);
  });
});

describe('ce que les habillages lisent', () => {
  it('theme.js ne déclare plus de teinte à lui, sauf l’or documenté', () => {
    // `COL` est devenu une table de correspondance. Une valeur en dur qui y
    // réapparaît recrée la palette parallèle qu'on vient de supprimer.
    const source = fs.readFileSync(path.join(RACINE, 'remotion/src/theme.js'), 'utf8');
    const bloc = source.slice(source.indexOf('export const COL'), source.indexOf('FONT_FILES'));
    const enDur = (bloc.match(/#[0-9A-Fa-f]{6}/g) || []);
    expect(enDur.sort()).toEqual(['#1E293B', '#FFD700']);
  });

  it('aucun habillage ne recrée une palette locale', () => {
    // overlays/index.jsx portait NAVY/ELEC/LIGHT, trois bleus de plus.
    const source = fs.readFileSync(path.join(RACINE, 'remotion/src/overlays/index.jsx'), 'utf8');
    expect(source).not.toMatch(/^const (NAVY|ELEC|LIGHT) = '#/m);
  });

  it('les valeurs par défaut des habillages importés viennent de la charte', () => {
    // Un bandeau d'interview sortait en rouge #d61f1f par défaut : la couleur
    // du fournisseur du gabarit, pas celle du JT.
    const dossier = path.join(RACINE, 'remotion/src/overlays');
    const coupables = [];
    fs.readdirSync(dossier).filter((f) => f.startsWith('envato_')).forEach((f) => {
      const source = fs.readFileSync(path.join(dossier, f), 'utf8');
      const m = source.match(/\|\|\s*['"]#[0-9A-Fa-f]{6}['"]/g) || [];
      m.forEach((occurrence) => coupables.push(`${f} ${occurrence}`));
    });
    expect(coupables, `teintes en dur : ${coupables.join(' · ')}`).toEqual([]);
  });

  it('le générateur ASS convertit la charte plutôt que de la recopier', () => {
    const source = fs.readFileSync(path.join(RACINE, 'backend/src/data/overlayTemplates.js'), 'utf8');
    expect(source).toMatch(/versAss\(COULEURS\./);
  });

  it('theme.js fait correspondre ses rôles à la charte', () => {
    // On lit la source plutôt que le module : `theme.js` importe `remotion`,
    // que le serveur n'a pas. C'est justement ce que garde le test suivant.
    const source = fs.readFileSync(path.join(RACINE, 'remotion/src/theme.js'), 'utf8');
    const bloc = source.slice(source.indexOf('export const COL'), source.indexOf('FONT_FILES'));
    expect(bloc).toMatch(/navy:\s*COULEURS\.fond/);
    expect(bloc).toMatch(/ticker:\s*COULEURS\.structure/);
    expect(bloc).toMatch(/band:\s*COULEURS\.structure/);
  });

  it('la charte ne dépend de rien, pour rester lisible par le serveur', () => {
    // `backend/src/data/overlayTemplates.js` l'importe. Si `identite.js`
    // importait `remotion`, tout le serveur tomberait au démarrage — un
    // paquet que le backend n'installe pas.
    const source = fs.readFileSync(path.join(RACINE, 'remotion/src/identite.js'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});

describe('la conversion vers ASS', () => {
  it('rend du BGR, pas du RGB', () => {
    // Un rouge pur doit ressortir en &H0000FF&, sinon il sort bleu à l'écran.
    expect(versAss('#FF0000')).toBe('&H0000FF&');
    expect(versAss('#0000FF')).toBe('&HFF0000&');
    expect(versAss(COULEURS.structure)).toBe('&H8B4D0D&');
  });

  it('refuse ce qui n’est pas une couleur', () => {
    expect(versAss('bleu')).toBeNull();
    expect(versAss('')).toBeNull();
    expect(versAss(null)).toBeNull();
  });
});

describe('l’échelle typographique', () => {
  it('descend du titre fort à la mention, sans trou ni inversion', () => {
    const tailles = [TYPO.fort, TYPO.titre, TYPO.sous, TYPO.mention];
    expect(tailles).toEqual([...tailles].sort((a, b) => b - a));
    expect(new Set(tailles).size).toBe(tailles.length);
  });

  it('ne descend jamais sous le plancher de lisibilité à l’antenne', () => {
    // Un JT se lit à quelques mètres. En dessous de 20 px sur une image de
    // 1080, une mention devient illisible sur un téléviseur.
    expect(TYPO.mention).toBeGreaterThanOrEqual(20);
  });

  it('exprime l’interlettrage en em, jamais en px', () => {
    // Les habillages natifs l'exprimaient en `em`, les importés en `px` : un
    // interlettrage en px ne suit pas la taille du texte.
    Object.values(LETTRAGE).forEach((v) => expect(String(v)).not.toMatch(/px$/));
  });

  it('retient deux familles, et les livre bien', () => {
    const polices = fs.readdirSync(path.join(RACINE, 'remotion/public/fonts'));
    Object.values(CARACTERES).forEach((famille) => {
      const attendu = famille.replace(/\s+/g, '');
      expect(polices.some((f) => f.replace(/[-_]/g, '').startsWith(attendu)), famille).toBe(true);
    });
    expect(INTERLIGNE.titre).toBeLessThan(INTERLIGNE.courant);
  });
});

describe('le mouvement', () => {
  it('propose peu de durées, et ordonnées', () => {
    expect(MOUVEMENT.accent).toBeLessThan(MOUVEMENT.entree);
    expect(MOUVEMENT.entree).toBeLessThan(MOUVEMENT.ampleur);
  });

  it('sort plus vite qu’il n’entre', () => {
    // Une sortie qui traîne donne l'impression d'un JT qui se termine mal.
    expect(MOUVEMENT.sortie).toBeLessThan(MOUVEMENT.entree);
  });

  it('n’a qu’un seul ressort, et sans rebond', () => {
    // Neuf réglages coexistaient. Celui-ci respecte la règle de la maison
    // inscrite en tête de broadcast.jsx : jamais de rebond.
    expect(RESSORT.damping).toBeGreaterThanOrEqual(15);
    expect(RESSORT.stiffness).toBeLessThanOrEqual(140);
  });

  it('convertit ses durées pour une autre cadence', () => {
    expect(images(MOUVEMENT.entree, 30)).toBe(MOUVEMENT.entree);
    expect(images(MOUVEMENT.entree, 60)).toBe(MOUVEMENT.entree * 2);
    // Jamais zéro : une durée nulle supprime l'animation au lieu de l'accélérer.
    expect(images(1, 1)).toBeGreaterThanOrEqual(1);
  });
});

describe('les polices livrées au repli libass', () => {
  it('le serveur dispose des mêmes familles que le moteur de rendu', () => {
    // Il manquait deux graisses Montserrat : libass y substituait
    // silencieusement une autre police, et le repli ne ressemblait plus au
    // master même de loin.
    //
    // La comparaison porte sur le **nom de base**, plus sur le fichier : les
    // deux côtés servent désormais des formats différents, et c'est voulu. Le
    // navigateur reçoit du woff2 — 64 % plus léger, et ces polices voyagent
    // jusqu'à des monteurs qui n'ont pas tous la fibre. libass, lui, ne lit
    // pas le woff2 : `backend/fonts/` garde le TTF.
    const familles = (p) => new Set(
      fs.readdirSync(path.join(RACINE, p))
        .filter((f) => /\.(ttf|otf|woff2?)$/i.test(f))
        .map((f) => f.replace(/\.(ttf|otf|woff2?)$/i, '')),
    );
    const cote = familles('backend/fonts');
    const manquantes = [...familles('remotion/public/fonts')].filter((f) => !cote.has(f));
    expect(manquantes, `absentes de backend/fonts : ${manquantes.join(', ')}`).toEqual([]);
  });

  it('garde bien du TTF côté serveur, et du woff2 côté navigateur', () => {
    // L'inverse du défaut ci-dessus : si `backend/fonts/` passait au woff2,
    // libass ne chargerait plus rien et les titres du repli disparaîtraient
    // sans un message. Et si le navigateur revenait au TTF, la charge
    // quadruplerait sans que rien ne le signale.
    const ext = (p, r) => fs.readdirSync(path.join(RACINE, p)).filter((f) => r.test(f)).length;
    expect(ext('backend/fonts', /\.ttf$/i), 'libass n’a plus de TTF').toBeGreaterThan(10);
    expect(ext('backend/fonts', /\.woff2?$/i), 'libass ne lit pas le woff2').toBe(0);
    expect(ext('remotion/public/fonts', /\.ttf$/i), 'le navigateur reçoit encore du TTF').toBe(0);
  });
});
