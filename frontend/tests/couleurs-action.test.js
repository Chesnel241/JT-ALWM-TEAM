import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Les couleurs d'action de l'espace journalistes restent lisibles.
 *
 * LE BESOIN : une couleur par nature d'action (vert envoyer, bleu ouvrir,
 * orange corriger, rouge supprimer ou urgence), lue avant le mot par des
 * correspondants peu familiers du numérique. L'orange existant (`--signal`)
 * ne portait du texte blanc qu'à 2,5:1 : illisible au soleil, sur un
 * téléphone d'entrée de gamme. Ce test relit les valeurs dans la feuille de
 * style : une retouche de teinte trop claire ne passe plus inaperçue.
 */

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');
const IVOIRE = '#faf6ee';
const BLANC = '#ffffff';

function jeton(nom) {
  const m = css.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`--${nom} introuvable ou pas en hexadécimal`);
  return m[1];
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

describe('couleurs d’action', () => {
  it.each(['action', 'cta-orange', 'cta-red'])('--%s porte du texte blanc à 4,5:1 au moins', (nom) => {
    expect(contraste(jeton(nom), BLANC)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['cta-orange-deep', 'cta-red-deep'])('--%s se lit en texte sur l’ivoire à 4,5:1 au moins', (nom) => {
    expect(contraste(jeton(nom), IVOIRE)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['jauge-serein', 'jauge-proche', 'jauge-urgent'])('--%s se voit sur l’ivoire à 3:1 au moins', (nom) => {
    expect(contraste(jeton(nom), IVOIRE)).toBeGreaterThanOrEqual(3);
  });
});
