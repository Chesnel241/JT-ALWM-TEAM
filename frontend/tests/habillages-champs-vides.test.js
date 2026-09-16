import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Un champ laissé vide ne doit rien afficher, ni dans l'aperçu ni dans le
 * master.
 *
 * Les gabarits retombaient sur un texte d'exemple quand le monteur ne
 * remplissait pas un champ. Un rendu réel l'a montré : un titre de reportage
 * sans sous-titre est sorti avec « UN SOUS-TITRE OU PRÉCISION » incrusté sous
 * le titre. Les habillages importés faisaient pire, avec les noms de la
 * maquette d'origine (« MARINA FORESTER », « MICHAEL SCOTT », « CALIFORNIA »).
 *
 * L'exemple a sa place dans le placeholder du champ, côté inspecteur, pas
 * dans l'image. Ces tests lisent la source, comme ceux des habillages
 * importés : les hooks de Remotion ne se montent pas dans la suite.
 */

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), '../../remotion/src/overlays');
const fichiers = readdirSync(DOSSIER).filter((n) => n.endsWith('.jsx'));
const lire = (n) => readFileSync(join(DOSSIER, n), 'utf8');

// Textes d'exemple déjà sortis, ou prêts à sortir, à l'antenne.
const EXEMPLES = [
  'UN SOUS-TITRE OU PRÉCISION',
  'LE TITRE DU REPORTAGE',
  'PRÉNOM NOM',
  'Titre de l’information',
  'POLITIQUE',
  'TITRE DU JOURNAL',
  'TONY NIGHT SHOW',
  'MARINA FORESTER',
  'ADMINISTRATOR',
  'ENVATO',
  'EMIL KOWALSKI',
  'MICHAEL SCOTT',
  'REGIONAL MANAGER',
  'JANE DOE',
  'JOHN SMITH',
  'PARIS, FRANCE',
  'STEVE JOBS',
  'CALIFORNIA',
  'NEW YORK',
];

// Champs de contenu : un nom, une fonction, un lieu, un titre.
const CHAMPS_DE_CONTENU = [
  'nom', 'name', 'title', 'fonction', 'context', 'headline', 'location',
  'quote', 'author', 'leftName', 'leftRole', 'rightName', 'rightRole',
  'leftLocation', 'leftSub', 'rightLocation', 'rightSub', 'subtitle',
  'sous_titre', 'signature', 'sujet', 'line1',
];

// Les libellés génériques de la chaîne restent des valeurs par défaut
// légitimes : un grand titre sans texte dit « LE JOURNAL », pas un nom inventé.
const LIBELLES_DE_LA_CHAINE = ['LE JOURNAL', 'SPÉCIALE', 'REPORTAGE'];

describe('un champ vide n’affiche aucun texte d’exemple', () => {
  it('ne contient plus aucun exemple de maquette', () => {
    const trouves = [];
    fichiers.forEach((nom) => {
      const source = lire(nom);
      EXEMPLES.forEach((exemple) => {
        // Visé en repli (`|| 'EXEMPLE'`) : « POLITIQUE » reste permis dans la
        // liste des rubriques du générique, où c'est un vrai mot du JT.
        if (new RegExp(`\\|\\|\\s*'${exemple}`).test(source)) trouves.push(`${nom} : ${exemple}`);
      });
    });
    expect(trouves).toEqual([]);
  });

  it('ne retombe sur aucun texte pour un champ de contenu', () => {
    const motif = new RegExp(`(?:fields|f)\\.(?:${CHAMPS_DE_CONTENU.join('|')})\\s*\\|\\|\\s*'([^']+)'`, 'g');
    const fautifs = [];
    fichiers.forEach((nom) => {
      lire(nom).split('\n').forEach((ligne, i) => {
        for (const [, texte] of ligne.matchAll(motif)) {
          if (!LIBELLES_DE_LA_CHAINE.includes(texte)) fautifs.push(`${nom}:${i + 1} ${ligne.trim()}`);
        }
      });
    });
    expect(fautifs).toEqual([]);
  });

  it('retire le bandeau de sous-titre quand il est vide', () => {
    // Un bandeau blanc vide sous le titre se verrait autant qu'un exemple.
    const source = lire('index.jsx');
    const debut = source.indexOf('function TitreReportage');
    const corps = source.slice(debut, source.indexOf('\nfunction ', debut + 1));
    expect(corps).toMatch(/\{sousTitre && \(/);
  });

  it('n’affiche ni guillemets ni tiret quand la citation est vide', () => {
    const source = lire('envato_mega_lower_thirds.jsx');
    expect(source).toMatch(/\{quote && \(/);
    expect(source).toMatch(/\{author && \(/);
  });
});
