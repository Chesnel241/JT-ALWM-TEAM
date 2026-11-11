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
    const avecCalques = source.match(/useCalques\(durationInFrames\)/g) || [];
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
