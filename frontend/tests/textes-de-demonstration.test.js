import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { aDuTexte } from '../../remotion/src/overlays/index.jsx';

const DOSSIER = resolve(__dirname, '../../remotion/src/overlays');

// L'INCIDENT : un champ laissé vide affichait un texte de démonstration —
// « MARINA FORESTER — ADMINISTRATOR », « MICHAEL SCOTT », « STEVE JOBS »,
// « ENVATO - THE WORLD'S LEADING MARKETPLACE » — dans l'aperçu ET dans le JT
// diffusé. Un monteur qui oubliait la fonction d'un invité l'envoyait à
// l'antenne sous le titre « REGIONAL MANAGER ».
describe('aucun texte de démonstration ne part à l’antenne', () => {
  const sources = readdirSync(DOSSIER).filter((f) => f.endsWith('.jsx'))
    .map((f) => [f, readFileSync(resolve(DOSSIER, f), 'utf8')]);

  it('aucun faux nom, faux lieu ni fausse citation ne reste dans les habillages', () => {
    const interdits = /MARINA FORESTER|ADMINISTRATOR|MICHAEL SCOTT|REGIONAL MANAGER|EMIL KOWALSKI|JANE DOE|JOHN SMITH|STEVE JOBS|ENVATO - |PARIS, FRANCE|CALIFORNIA|NEW YORK|INVESTIGATIVE REPORT|WITH THE PRESIDENT|INSIDE THE CARTEL|TONY NIGHT SHOW|LE TITRE DU REPORTAGE|UN SOUS-TITRE OU PRÉCISION/;
    for (const [fichier, texte] of sources) {
      expect(texte.match(interdits)?.[0], fichier).toBeUndefined();
    }
  });

  it('dans les habillages importés, un champ de texte vide reste vide', () => {
    const repli = /\bfields\.(?!color|bg)[A-Za-z_0-9]+(?: \|\| fields\.[A-Za-z_0-9]+)* \|\| (['"])(?!#|rgb)[^'"]+\1/;
    for (const [fichier, texte] of sources.filter(([f]) => f.startsWith('envato_'))) {
      expect(texte.match(repli)?.[0], fichier).toBeUndefined();
    }
  });

  it('un habillage sans aucun texte saisi ne compte pas comme écrit', () => {
    expect(aDuTexte({ fields: {} })).toBe(false);
    expect(aDuTexte({ fields: { nom: '   ', fonction: '' } })).toBe(false);
    expect(aDuTexte({ fields: { colorBg: '#003366' } })).toBe(false); // une couleur n'est pas un texte
    expect(aDuTexte({ fields: { nom: 'Aminata Diallo' } })).toBe(true);
  });
});
