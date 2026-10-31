import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isoDrapeau, urlDrapeau, urlDrapeauIso, DRAPEAUX_DISPONIBLES } from '../src/lib/drapeaux.js';

/**
 * Chaque pays retrouve son drapeau, servi par l'application.
 *
 * L'INCIDENT : le drapeau était demandé à un CDN externe par l'identifiant
 * du pays. Les pays ajoutés à la main — « cameroun », « bdi » — n'ont pas
 * d'identifiant ISO : la console de la rédaction affichait « Failed to load
 * flag for cameroun », et la carte trois lettres au lieu d'un drapeau.
 */

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), '../public/flags');

describe('isoDrapeau', () => {
  it.each([
    [{ id: 'cm', name: 'Cameroun', code: 'CM' }, 'cm'],
    [{ id: 'cameroun', name: 'Cameroun', code: 'CAM' }, 'cm'],
    [{ id: 'bdi', name: 'BDI', code: 'BDI' }, 'bi'],
    [{ id: 'burundi', name: 'Burundi', code: 'BU' }, 'bi'],
    [{ id: 'cg', name: 'Congo Brazzaville', code: 'CB' }, 'cg'],
    [{ id: 'cd', name: 'Rép. Dém. du Congo', code: 'CD' }, 'cd'],
    [{ id: 'ci', name: "Côte d'Ivoire", code: 'CI' }, 'ci'],
    [{ id: 'gb', name: 'Gabon', code: 'GB' }, 'ga'],
    [{ id: 'ng', name: 'Nigeria', code: 'NG' }, 'ng'],
    [{ id: 'gh', name: 'Ghana', code: 'GHA' }, 'gh'],
    [{ id: 'cameroun', name: 'Cameroun Nord', code: 'CMN' }, 'cm'],
  ])('%o → %s', (pays, attendu) => {
    expect(isoDrapeau(pays)).toBe(attendu);
  });

  it('ne devine pas un drapeau qu’il n’a pas', () => {
    expect(isoDrapeau({ id: 'xx', name: 'Atlantide', code: 'ATL' })).toBeNull();
    expect(urlDrapeau({ id: 'xx', name: 'Atlantide', code: 'ATL' })).toBeNull();
    expect(isoDrapeau(null)).toBeNull();
  });

  it('sert le drapeau depuis l’application, jamais depuis un CDN', () => {
    expect(urlDrapeau({ id: 'cameroun', name: 'Cameroun', code: 'CAM' })).toBe('/flags/cm.svg');
  });
});

describe('les fichiers de drapeaux', () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.svg')).map((f) => f.replace('.svg', ''));

  it('chaque drapeau déclaré existe, et chaque fichier est déclaré', () => {
    expect([...DRAPEAUX_DISPONIBLES].sort()).toEqual(fichiers.sort());
  });

  it('aucun ne contient de script ni de lien externe', () => {
    // Un SVG est un document : servi depuis notre domaine, un script y
    // tournerait avec nos droits.
    const suspects = fichiers.filter((code) => /<script|javascript:|\son[a-z]+=|href="https?:/i
      .test(readFileSync(join(DOSSIER, `${code}.svg`), 'utf8')));
    expect(suspects).toEqual([]);
  });

  it('la licence accompagne les fichiers', () => {
    expect(readFileSync(join(DOSSIER, 'LICENSE-flag-icons.txt'), 'utf8')).toMatch(/MIT License/);
  });
});

describe('urlDrapeauIso — le champ téléphone', () => {
  // Le champ téléphone parle ISO : « GB » y est le Royaume-Uni. Passer par
  // les codes maison de la rédaction y aurait mis le drapeau du Gabon.
  it('lit les codes ISO à deux lettres, sans les codes maison', () => {
    expect(urlDrapeauIso('CM')).toBe('/flags/cm.svg');
    expect(urlDrapeauIso('GB')).toBe('/flags/gb.svg');
    expect(urlDrapeauIso('GA')).toBe('/flags/ga.svg');
  });

  it('ne montre rien pour un pays sans drapeau local', () => {
    expect(urlDrapeauIso('KY')).toBeNull();
    expect(urlDrapeauIso('')).toBeNull();
    expect(urlDrapeauIso(undefined)).toBeNull();
    expect(urlDrapeauIso('CMR')).toBeNull();
  });
});
