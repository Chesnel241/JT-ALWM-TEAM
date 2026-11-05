import { describe, it, expect } from 'vitest';
import { tailleLisible } from '../src/lib/taille.js';

// L'INCIDENT : « NaN MB » dans la Livraison — la taille arrivait déjà en
// chaîne (« 412.3 MB ») et l'écran la redivisait.
describe('la taille d’un fichier', () => {
  it('laisse telle quelle une taille déjà écrite par le serveur', () => {
    expect(tailleLisible('412.3 MB')).toBe('412.3 MB');
    expect(tailleLisible('812 octets')).toBe('812 octets');
  });

  it('écrit un nombre d’octets en Ko, Mo ou Go', () => {
    expect(tailleLisible(2048)).toBe('2 Ko');
    expect(tailleLisible(5 * 1024 * 1024)).toBe('5.0 Mo');
    expect(tailleLisible(3 * 1024 * 1024 * 1024)).toBe('3.00 Go');
  });

  it('n’affiche jamais « NaN »', () => {
    expect(tailleLisible(undefined)).toBe('');
    expect(tailleLisible(NaN)).toBe('');
    expect(tailleLisible('NaN MB')).toBe('');
  });
});
