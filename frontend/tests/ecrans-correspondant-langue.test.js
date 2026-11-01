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
  'ReporterHomeView.jsx',
  'CountdownTimer.jsx',
  'VoyageEnvoi.jsx',
  'ChampScript.jsx',
  'ChampWhatsApp.jsx',
  'JTPretJournaliste.jsx',
  'StudioVoixJournaliste.jsx',
  'RubriqueView.jsx',
  'GrillePays.jsx',
  'RedactionJournal.jsx',
  'ParcoursPays.jsx',
];

const LETTRES = /[A-Za-zÀ-ÿ]{2,}/;
const ATTRIBUTS_LUS = new Set(['title', 'placeholder', 'aria-label', 'alt']);
// Une liste de classes, une URL ou un identifiant ne sont pas du texte lu.
//
// L'INCIDENT DU DÉTECTEUR : il écartait toute chaîne commençant comme une
// classe (`p`, `m`, `w`, `h`…), si bien que « pays disponibles » passait pour
// `p-4`. Une chaîne n'est désormais une liste de classes que si CHACUN de ses
// mots en a la forme (un tiret, deux-points, ou un nom de classe connu).
const CLASSES_SEULES = new Set([
  'flex', 'grid', 'hidden', 'block', 'inline', 'relative', 'absolute', 'fixed', 'sticky',
  'truncate', 'uppercase', 'lowercase', 'capitalize', 'italic', 'underline', 'rounded',
  'shadow', 'border', 'transition', 'group', 'peer', 'contents', 'container', 'btn', 'panel',
  'badge', 'grow', 'shrink', 'isolate',
]);
const estUneClasse = (mot) => /^[a-zA-Z0-9:!\[\]\/._%(),#=>&*+-]+$/.test(mot)
  && (mot.includes('-') || mot.includes(':') || CLASSES_SEULES.has(mot));

function estDuTexte(valeur) {
  const v = valeur.trim();
  if (!LETTRES.test(v)) return false;
  if (/var\(--|^https?:|^\/|^#|^\.|\.\w{2,4}$/.test(v)) return false;
  // Un identifiant seul (« video », « warning », « sn ») n'est pas lu.
  if (/^[a-z0-9_-]+$/.test(v)) return false;
  return !v.split(/\s+/).every(estUneClasse);
}

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
      if (estDuTexte(v)) noter(n, v);
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
        const n = 2;
        return <div title="Lire le script" className={ok ? 'px-4 py-2 rounded-xl flex' : 'hidden'}>
          Délai dépassé {t.ok} {ok ? 'Validé' : t.non} {n > 1 ? 'pays disponibles' : 'pays'}
        </div>;
      }`);
    // Envoi terminé, Lire le script, Délai dépassé, Validé, pays disponibles —
    // et pas la liste de classes.
    expect(trouves).toHaveLength(5);
  });
});
