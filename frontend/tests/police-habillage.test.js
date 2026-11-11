import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CARACTERES, POLICE_HABILLAGE, varPolice } from '../../remotion/src/identite.js';

/**
 * La police des quinze habillages importés.
 *
 * L'incident : la valeur de `--ov-font` se terminait par une virgule, et les
 * gabarits écrivent `font-family: var(--ov-font, …), "Montserrat ExtraBold",
 * …`. Une fois substituée, la déclaration contenait une **famille vide** entre
 * deux virgules — ce qui l'invalide entièrement. Le navigateur la jetait et
 * retombait sur sa police par défaut : les quinze habillages importés
 * sortaient en serif pendant que les huit natifs étaient en Montserrat.
 *
 * Rien ne pouvait l'attraper. Les tests ne regardent pas une image, et une
 * déclaration invalide ne lève pas : elle est silencieusement ignorée. Le
 * défaut s'est vu sur un rendu réel, à l'œil.
 */

const RACINE = path.resolve(__dirname, '..', '..');

/** Substitue la variable comme le ferait le navigateur, puis découpe la liste. */
function familles(declaration, variables) {
  const resolue = declaration.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
    (_, nom, repli) => (variables[nom] != null ? variables[nom] : (repli || ''))
  );
  return resolue.split(',').map((f) => f.trim());
}

describe('la déclaration de police reste valide', () => {
  it('ne contient aucune famille vide, avec ou sans police choisie', () => {
    const cas = [
      ['aucun choix', {}],
      ['police choisie', { font: 'Bebas Neue' }],
      ['habillage absent', undefined],
      ['police vide', { font: '' }],
    ];

    cas.forEach(([quoi, overlay]) => {
      const liste = familles(POLICE_HABILLAGE, varPolice(overlay));
      expect(liste.filter((f) => f === ''), `${quoi} : ${liste.join(' | ')}`).toEqual([]);
      expect(liste.length, quoi).toBeGreaterThan(1);
    });
  });

  it('place la police choisie en premier, et la police du JT juste derrière', () => {
    const liste = familles(POLICE_HABILLAGE, varPolice({ font: 'Bebas Neue' }));
    expect(liste[0]).toBe("'Bebas Neue'");
    expect(liste[1]).toBe(`"${CARACTERES.titrage}"`);
  });

  it('retombe sur la police du JT quand le monteur n’a rien choisi', () => {
    expect(varPolice({})['--ov-font']).toBe(`'${CARACTERES.titrage}'`);
  });
});

describe('le paquet d’antenne lit la même déclaration', () => {
  it('ne réécrit pas sa propre font-family', () => {
    const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../remotion/src/overlays/paquet.jsx'), 'utf8');
    expect(source).toContain('fontFamily: POLICE_HABILLAGE');
    expect(source, 'le paquet réécrit la déclaration au lieu de la lire').not.toMatch(/fontFamily:\s*'var\(--ov-font/);
  });
});
