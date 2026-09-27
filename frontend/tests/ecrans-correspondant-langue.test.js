import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSync } from '@babel/core';

/**
 * Les écrans des correspondants parlent la langue choisie, et elle seule.
 *
 * L'INCIDENT : un correspondant anglophone (Ghana, Nigeria) lisait « Délai
 * d'envoi dépassé », « Clôturé », « Envoi en cours... », « Fichiers de … »,
 * « Annonces » ou « J'ai compris » au milieu d'un écran anglais — une
 * cinquantaine de textes écrits en dur dans ces fichiers, hors du
 * dictionnaire. Le test de parité ne pouvait pas les voir : il ne regarde que
 * le dictionnaire.
 *
 * Ce test lit le code comme le fait le compilateur (arbre JSX) et refuse tout
 * texte visible qui n'en vient pas : texte entre balises, `title`,
 * `placeholder`, `aria-label`, `alt`, message de `addToast`, chaîne affichée
 * par une condition.
 */

const COMPOSANTS = join(dirname(fileURLToPath(import.meta.url)), '../src/components');
const ECRANS = [
  'MobileUploaderView.jsx',
  'UploaderView.jsx',
  'NombreReportages.jsx',
  'ReportagesSheet.jsx',
  'HomeView.jsx',
  'Tutorial5W1H.jsx',
  'DeliveryView.jsx',
  'ConfirmDialog.jsx',
];

const LETTRES = /[A-Za-zÀ-ÿ]{2,}/;
const ATTRIBUTS_LUS = new Set(['title', 'placeholder', 'aria-label', 'alt']);
// Une liste de classes, une URL ou un identifiant ne sont pas du texte lu.
const PAS_DU_TEXTE = /^[a-z0-9_-]+$|var\(--|^(bg|text|border|p[xytblr]?|m[xytblr]?|w|h|flex|grid|rounded|shadow|font|md:|sm:|lg:|opacity|scale|inline|block|hidden|animate|motion|min|max|space|gap|rotate|transition|items|justify|cursor|relative|absolute|btn|col|row|overflow|truncate|shrink|leading|tracking|uppercase|sr-only|app-|panel|uploader-)|^https?:|^\/|^#|^\.|\.\w{2,4}$/;

function textesEnDur(source) {
  const ast = parseSync(source, {
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    parserOpts: { plugins: ['jsx'] },
  });
  const trouves = [];
  const noter = (n, v) => trouves.push(`ligne ${n.loc.start.line} : ${v.trim().replace(/\s+/g, ' ').slice(0, 80)}`);

  const visiter = (n, parent) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'JSXText' && LETTRES.test(n.value)) noter(n, n.value);
    if (n.type === 'JSXAttribute' && ATTRIBUTS_LUS.has(n.name?.name) && n.value?.type === 'StringLiteral' && LETTRES.test(n.value.value)) {
      noter(n, n.value.value);
    }
    const affiche = parent && (
      parent.type === 'ConditionalExpression'
      || parent.type === 'LogicalExpression'
      || parent.type === 'JSXExpressionContainer'
      || (parent.type === 'CallExpression' && parent.callee?.name === 'addToast')
    );
    if (affiche && (n.type === 'StringLiteral' || n.type === 'TemplateLiteral')) {
      const v = n.type === 'StringLiteral' ? n.value : n.quasis.map((q) => q.value.cooked).join('');
      if (LETTRES.test(v) && !PAS_DU_TEXTE.test(v.trim())) noter(n, v);
    }
    for (const [cle, valeur] of Object.entries(n)) {
      if (cle === 'loc' || cle.endsWith('Comments')) continue;
      if (Array.isArray(valeur)) valeur.forEach((x) => visiter(x, n));
      else if (valeur && typeof valeur.type === 'string') visiter(valeur, n);
    }
  };
  visiter(ast.program, null);
  return trouves;
}

describe('les écrans des correspondants n’ont aucun texte en dur', () => {
  it.each(ECRANS)('%s', (fichier) => {
    const trouves = textesEnDur(readFileSync(join(COMPOSANTS, fichier), 'utf8'));
    expect(trouves, `Textes hors dictionnaire :\n  ${trouves.join('\n  ')}`).toEqual([]);
  });

  it('le détecteur voit bien un texte en dur', () => {
    // Sans ce témoin, un détecteur cassé laisserait tout passer en silence.
    const trouves = textesEnDur(`
      export default function X({ t, addToast }) {
        addToast('Envoi terminé', 'success');
        return <div title="Lire le script">Délai dépassé {t.ok} {ok ? 'Validé' : t.non}</div>;
      }`);
    expect(trouves).toHaveLength(4);
  });
});
