import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGISTRY } from '../../remotion/src/overlays/index.jsx';
import { poser, quitter, MARGE } from '../../remotion/src/overlays/paquet.jsx';
import { OVERLAY_TEMPLATES } from '../src/data/overlayTemplates.js';

const source = readFileSync(resolve(__dirname, '../../remotion/src/overlays/paquet.jsx'), 'utf8');

// LE CONSTAT : les habillages étaient de petits cartouches de site web, qui
// entraient tous d'un fondu ou d'un glissé ; les écrans pleins étaient presque
// vides. Le paquet d'antenne les reconstruit par calques (filet, volet, texte
// derrière un cache), sur une seule courbe, et à l'échelle d'un écran de TV.
describe('le paquet d’antenne', () => {
  it('dessine chaque habillage du catalogue, sans exception', () => {
    for (const modele of OVERLAY_TEMPLATES) {
      expect(typeof REGISTRY[modele.id], modele.id).toBe('function');
    }
  });

  it('une seule courbe : rapide au départ, posée sans rebond', () => {
    let avant = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = poser(t);
      expect(v).toBeGreaterThanOrEqual(avant); // jamais de retour en arrière
      expect(v).toBeLessThanOrEqual(1);        // jamais de dépassement
      avant = v;
    }
    expect(poser(0)).toBe(0);
    expect(poser(1)).toBe(1);
    expect(poser(0.25)).toBeGreaterThan(0.6); // l'essentiel du trajet dans le premier quart
    expect(poser(5)).toBe(1);
    expect(poser(-1)).toBe(0);
  });

  it('la sortie accélère au lieu de se poser', () => {
    expect(quitter(0)).toBe(0);
    expect(quitter(1)).toBe(1);
    expect(quitter(0.5)).toBeLessThan(0.2);
  });

  it('rien d’important à moins de 5 % du bord de l’image', () => {
    expect(MARGE).toBeGreaterThanOrEqual(1920 * 0.05);
  });

  it('chaque habillage passe par les calques : aucun n’invente sa propre sortie', () => {
    const composants = source.match(/^export function [A-Z][A-Za-z]+\(\{ overlay, durationInFrames/gm) || [];
    // Avec ou sans courbe de famille (« franc », « doux ») : le socle reste le même.
    const avecCalques = source.match(/useCalques\(durationInFrames(?:, '\w+')?\)/g) || [];
    expect(composants.length).toBeGreaterThanOrEqual(22);
    // NomDeuxInvites délègue à NomBandeau : tous les autres appellent le socle.
    expect(avecCalques.length).toBeGreaterThanOrEqual(composants.length - 1);
    expect(source).not.toMatch(/\bspring\(/); // pas de ressort : pas de rebond
  });

  it('aucune couleur ni police écrite en dur : tout vient de la charte', () => {
    expect(source.match(/#[0-9A-Fa-f]{3,8}\b|rgba?\(/g)).toBeNull();
    expect(source).not.toMatch(/fontFamily:\s*['"`]/);
  });

  it('le bandeau défilant boucle sur sa longueur et suit la cadence reçue', () => {
    const defilant = source.slice(source.indexOf('export function Defilant'));
    expect(defilant).toMatch(/% largeur/);
    expect(defilant).toMatch(/frame \/ k/);
  });

  // LE CONSTAT : les titres s'affichaient en liste numérotée, 01, 02, 03 —
  // une liste de courses. Chaque titre a maintenant sa scène, seul à l'écran.
  it('les titres passent un par un, et non en liste numérotée', () => {
    const titres = source.slice(source.indexOf('export function RappelTitres'), source.indexOf('export function Fin'));
    expect(titres).not.toMatch(/padStart\(2, '0'\)/);      // plus de « 01, 02, 03 »
    expect(titres).toMatch(/const rang = /);                 // un seul titre en scène
    expect(titres).toMatch(/titres\[rang\]/);
    expect(titres).toMatch(/scaleX\(\$\{rempli/);            // la barre segmentée se remplit
    expect(titres).toMatch(/'titre4', 'titre5'/);            // jusqu'à cinq titres
  });

  it('les couleurs réglées par le monteur restent prises en compte', () => {
    expect(source).toMatch(/pickColors\(overlay\)/);
    expect(source).toMatch(/overlay\.posX/);
    expect(source).toMatch(/overlay\.scale/);
    expect(source).toMatch(/overlay\.fontSize/);
  });
});

// Les nouveaux modèles : ce qu'on voit sur les grandes chaînes et qui manquait.
describe('le chiffre clé se compte à l’écran', () => {
  it('garde ce qui entoure le nombre, tel qu’il a été écrit', async () => {
    const { lireChiffre, ecrireChiffre } = await import('../../remotion/src/overlays/paquet.jsx');
    const fin = (texte) => ecrireChiffre(lireChiffre(texte), 1);
    for (const texte of ['72 %', '1 250 000 FCFA', '3,4 millions', '+12.5%', '45', '-3 °C']) {
      expect(fin(texte), texte).toBe(texte);
    }
  });

  it('part de zéro et monte jusqu’au nombre, sans le dépasser', async () => {
    const { lireChiffre, ecrireChiffre } = await import('../../remotion/src/overlays/paquet.jsx');
    const c = lireChiffre('72 %');
    expect(ecrireChiffre(c, 0)).toBe('0 %');
    expect(ecrireChiffre(c, 0.5)).toBe('36 %');
    expect(ecrireChiffre(c, 3)).toBe('72 %');
    expect(ecrireChiffre(lireChiffre('1 250 000 FCFA'), 0.5)).toBe('625 000 FCFA');
  });

  it('un texte sans nombre s’affiche tel quel', async () => {
    const { lireChiffre } = await import('../../remotion/src/overlays/paquet.jsx');
    expect(lireChiffre('Record battu')).toBeNull();
  });
});

describe('les transitions de la chaîne', () => {
  const transitions = readFileSync(resolve(__dirname, '../../remotion/src/transitions.jsx'), 'utf8');
  const montage = readFileSync(resolve(__dirname, '../../remotion/src/JTMaster.jsx'), 'utf8');
  const serveur = readFileSync(resolve(__dirname, '../../backend/src/services/editorService.js'), 'utf8');

  it('sont connues du moteur, du studio et du serveur', async () => {
    const { translations } = await import('../src/i18n/translations.js');
    for (const id of ['volet_antenne', 'lames', 'zoom_rapide', 'rideau']) {
      expect(montage, id).toContain(`'${id}'`);
      expect(serveur, id).toContain(`'${id}'`);      // sinon le serveur refuse le montage
      expect(translations.fr.studio.transitions[id], id).toBeTruthy();
      expect(translations.en.studio.transitions[id], id).toBeTruthy();
    }
  });

  // Le plan qui entre est dessiné AU-DESSUS de celui qui sort : un effet posé
  // sur le plan sortant seul ne se voit pas (le rideau l'a montré au rendu).
  it('le rideau et les lames agissent sur le plan qui entre', () => {
    for (const nom of ['Rideau', 'Lames', 'VoletAntenne']) {
      const corps = transitions.slice(transitions.indexOf(`function ${nom}(`));
      expect(corps.slice(0, 400), nom).toMatch(/presentationDirection !== 'entering'\) return <AbsoluteFill>\{children\}<\/AbsoluteFill>/);
    }
  });

  it('le zoom n’arrive jamais plus petit que l’image', () => {
    const corps = transitions.slice(transitions.indexOf('function ZoomRapide('), transitions.indexOf('Le rideau'));
    expect(corps).toMatch(/scale\(\$\{\(1\.22 - 0\.22/);
  });
});

// L'INCIDENT, vu sur un JT rendu avec tout l'habillage : un nom posé en bas à
// droite passait sous le logo, qui en cachait la moitié.
describe('les habillages s’écartent de ce qui est déjà à l’antenne', () => {
  it('un bandeau posé dans le coin du logo remonte au-dessus de lui', async () => {
    const { ecartPermanent } = await import('../../remotion/src/overlays/paquet.jsx');
    expect(ecartPermanent('bas-droite', { logo: 'bas-droite' })).toBeGreaterThanOrEqual(150);
    expect(ecartPermanent('bas-gauche', { logo: 'bas-droite' })).toBe(0);
  });

  it('une mention en haut à droite descend sous la pastille « DIRECT »', async () => {
    const { ecartPermanent } = await import('../../remotion/src/overlays/paquet.jsx');
    expect(ecartPermanent('haut-droite', { direct: true })).toBeGreaterThanOrEqual(90);
    expect(ecartPermanent('haut-gauche', { direct: true })).toBe(0);
  });

  it('une bande pleine largeur se pose sur le bandeau défilant, pas dessous', async () => {
    const { ecartPermanent } = await import('../../remotion/src/overlays/paquet.jsx');
    expect(ecartPermanent('bas', { defilant: true })).toBeGreaterThanOrEqual(72);
    expect(ecartPermanent('bas', {})).toBe(0);
  });

  it('le montage dit aux habillages ce qui occupe l’image', () => {
    const montage = readFileSync(resolve(__dirname, '../../remotion/src/JTMaster.jsx'), 'utf8');
    expect(montage).toMatch(/<Antenne\.Provider value=\{antenne\}>/);
  });
});
