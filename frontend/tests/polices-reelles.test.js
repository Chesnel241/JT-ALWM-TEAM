import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_FILES } from '../../remotion/src/theme.js';
import { FONT_FAMILIES } from '../src/data/overlayTemplates.js';

/**
 * Les polices existent-elles vraiment ?
 *
 * L'incident
 * ----------
 * `Montserrat-Bold.ttf` et `Montserrat-Medium.ttf` n'étaient pas des polices.
 * C'étaient deux **pages d'erreur GitHub de 307 Ko**, enregistrées avec une
 * extension `.ttf` — et présentes dans les trois dossiers à la fois :
 * `backend/fonts/`, `remotion/public/fonts/`, `frontend/public/fonts/`.
 *
 * Ces deux familles ne se sont donc jamais chargées, ni à l'antenne ni dans le
 * studio, alors que le catalogue les proposait au monteur et que le serveur
 * validait son choix. C'est le défaut du lot 1 — « le studio promet ce qui
 * n'existe pas » — dans sa forme la plus difficile à voir : le fichier est
 * là, au bon nom, à la bonne place. Le plan du lot 5 notait même que
 * « `backend/fonts/` est complet ». Présentes, oui. Valides, non.
 *
 * Aucun test ne pouvait le voir tant qu'on se contentait de vérifier qu'un
 * fichier existe. Celui-ci ouvre chacun et lit sa signature.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '../..');

const DOSSIERS = [
  // Trois runtimes, trois copies : libass côté serveur, le worker Remotion,
  // et l'aperçu du studio dans le navigateur.
  'backend/fonts',
  'remotion/public/fonts',
  'frontend/public/fonts',
];

/**
 * Les quatre en-têtes qu'un fichier de police peut porter.
 *
 * `0x00010000` pour une TrueType, `OTTO` pour une OpenType à courbes de Bézier
 * cubiques, `true` pour l'ancienne variante Apple, `ttcf` pour une collection.
 * Tout le reste — une page HTML, une redirection, un fichier tronqué — se
 * reconnaît à la première ligne.
 */
function estUneVraiePolice(chemin) {
  const tete = readFileSync(chemin).subarray(0, 4);
  const marque = tete.toString('latin1');
  return tete.readUInt32BE(0) === 0x00010000
    || marque === 'OTTO' || marque === 'true' || marque === 'ttcf'
    // `wOF2` pour les deux dossiers servis au navigateur, passés au woff2 :
    // 6,2 Mo de TTF y sont devenus 2,2 Mo. `backend/fonts/` garde le TTF,
    // libass ne lisant pas le woff2.
    || marque === 'wOF2' || marque === 'wOFF';
}

describe('les fichiers de police', () => {
  it('en sont vraiment', () => {
    const imposteurs = [];
    DOSSIERS.forEach((dossier) => {
      const chemin = join(RACINE, dossier);
      if (!existsSync(chemin)) return;
      readdirSync(chemin)
        .filter((n) => /\.(ttf|otf|ttc|woff2?)$/i.test(n))
        .forEach((n) => {
          const f = join(chemin, n);
          if (!estUneVraiePolice(f)) {
            imposteurs.push(`${dossier}/${n} (${Math.round(readFileSync(f).length / 1024)} Ko)`);
          }
        });
    });
    expect(imposteurs, 'ces fichiers portent un nom de police sans en être une').toEqual([]);
  });

  it('sont là, tous, pour chacune des familles que le moteur déclare', () => {
    // L'autre moitié : une famille déclarée sans fichier ne se charge pas non
    // plus, et le navigateur ne dit rien.
    //
    // Les deux côtés divergent, et c'est voulu : `FONT_FILES` nomme les woff2
    // servis au navigateur, tandis que `backend/fonts/` garde les TTF que
    // libass sait lire. La correspondance se vérifie donc par le nom de base,
    // pas par l'extension.
    const manquants = [];
    Object.entries(FONT_FILES).forEach(([famille, fichier]) => {
      ['remotion/public/fonts', 'frontend/public/fonts'].forEach((dossier) => {
        if (!existsSync(join(RACINE, dossier, fichier))) manquants.push(`${famille} → ${dossier}/${fichier}`);
      });
      const ttf = fichier.replace(/\.woff2?$/, '.ttf');
      if (!existsSync(join(RACINE, 'backend/fonts', ttf))) manquants.push(`${famille} → backend/fonts/${ttf}`);
    });
    expect(manquants, 'ces familles sont déclarées sans fichier').toEqual([]);
  });
});

describe('ce que le studio propose au monteur', () => {
  it('ne contient que des familles que le moteur sait charger', () => {
    // Choisir une police que le rendu ignore donne un JT dans une autre
    // police que celle affichée à l'écran de montage, sans un mot.
    const inconnues = FONT_FAMILIES.filter((f) => !Object.keys(FONT_FILES).includes(f));
    expect(inconnues, 'ces polices sont au menu mais pas au moteur').toEqual([]);
  });

  it('propose bien tout ce que le moteur sait charger', () => {
    // Et l'inverse : une police livrée mais jamais proposée est du poids mort
    // dans trois images de conteneur.
    const oubliees = Object.keys(FONT_FILES).filter((f) => !FONT_FAMILIES.includes(f));
    expect(oubliees, 'ces polices sont livrées mais jamais proposées').toEqual([]);
  });
});

describe('le poids servi au navigateur', () => {
  it('reste en woff2 des deux côtés', () => {
    // Ces polices voyagent jusqu'à des monteurs qui n'ont pas tous la fibre.
    // Un retour au TTF quadruplerait la charge sans que rien ne le signale.
    ['remotion/public/fonts', 'frontend/public/fonts'].forEach((dossier) => {
      const restes = readdirSync(join(RACINE, dossier)).filter((n) => /\.(ttf|otf)$/i.test(n));
      expect(restes, `${dossier} sert encore du TTF`).toEqual([]);
    });
  });

  it('garde le TTF là où libass en a besoin', () => {
    // L'inverse est aussi un défaut : le moteur de repli ne lit pas le woff2,
    // et le chargement échouerait sans un mot — les titres disparaîtraient.
    const ttf = readdirSync(join(RACINE, 'backend/fonts')).filter((n) => /\.ttf$/i.test(n));
    expect(ttf.length, 'backend/fonts n’a plus de TTF pour libass').toBeGreaterThan(10);
  });
});
