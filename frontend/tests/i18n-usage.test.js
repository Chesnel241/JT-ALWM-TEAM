import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { translations } from '../src/i18n/translations.js';

/**
 * Chaque texte du dictionnaire est lu par un écran.
 *
 * L'INCIDENT : 25 clés, en français et en anglais, n'étaient plus lues par
 * rien — la section entière de l'écran de connexion au mot de passe global,
 * retiré depuis, et des textes écrits pour des gestes jamais branchés. Le
 * test de parité les exigeait même. Un traducteur relisait donc des phrases
 * que personne ne verrait, et la prochaine personne à chercher « où
 * s'affiche ce message ? » ne trouvait rien.
 *
 * Seule exception : les textes de l'aide 5W1H, lus par un nom composé
 * (`t.tutorial[`${id}Desc`]`, Tutorial5W1H.jsx).
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src');
const LUS_PAR_NOM_COMPOSE = /^tutorial\.(who|what|where|when|why|how)(Desc|Ex)$/;

const sources = readdirSync(SRC, { recursive: true })
  .map(String)
  .filter((f) => /\.(js|jsx)$/.test(f) && !f.endsWith('translations.js'))
  .map((f) => readFileSync(join(SRC, f), 'utf8'))
  .join('\n');

describe('le dictionnaire', () => {
  it('ne contient aucun texte qu’aucun écran ne lit', () => {
    const orphelines = [];
    for (const [bloc, contenu] of Object.entries(translations.fr)) {
      if (!contenu || typeof contenu !== 'object') continue;
      for (const cle of Object.keys(contenu)) {
        const chemin = `${bloc}.${cle}`;
        if (LUS_PAR_NOM_COMPOSE.test(chemin)) continue;
        if (!new RegExp(`\\b${cle}\\b`).test(sources)) orphelines.push(chemin);
      }
    }
    expect(orphelines, `Clés sans lecteur :\n  ${orphelines.join('\n  ')}`).toEqual([]);
  });
});

describe('chaque texte demandé par un écran existe', () => {
  // L'INCIDENT : un écran demandait `u.phoneOk` avant que la clé n'existe.
  // Rien ne casse dans ce cas — le texte s'affiche vide, et le bouton reste
  // sans explication. Les tests ne le voyaient pas : aucun ne montait le
  // formulaire concerné. On lit donc les sources, alias compris
  // (`const u = t.uploader;` puis `u.phoneOk`).
  //
  // Ce test a trouvé, dès son premier passage, trois clés absentes dans
  // l'espace montage. Deux étaient des fonctions : la suppression d'un
  // fichier ou d'un montage réussissait sur le serveur, puis l'appel du
  // texte de confirmation levait une TypeError, rattrapée comme un échec —
  // l'élément supprimé réapparaissait à l'écran, avec un message d'erreur.
  const fichiers = readdirSync(SRC, { recursive: true })
    .map(String)
    .filter((f) => /\.(js|jsx)$/.test(f) && !f.endsWith('translations.js'));

  it.each(['fr', 'en'])('en %s', (lang) => {
    const absents = [];
    for (const f of fichiers) {
      const code = readFileSync(join(SRC, f), 'utf8');
      const alias = { t: null };
      for (const m of code.matchAll(/const\s+(\w+)\s*=\s*t\.(\w+)\s*;/g)) alias[m[1]] = m[2];
      // `t.x.y?.z || '…'` : une lecture volontairement facultative, avec son
      // repli écrit à côté. Elle n'est pas comptée ici.
      for (const m of code.matchAll(/\bt\.(\w+)\.(\w+)\b(?!\?\.)/g)) {
        const [, bloc, cle] = m;
        if (translations[lang][bloc] && typeof translations[lang][bloc] === 'object' && !(cle in translations[lang][bloc])) {
          absents.push(`${f} → t.${bloc}.${cle}`);
        }
      }
      for (const [nom, bloc] of Object.entries(alias)) {
        if (!bloc || !translations[lang][bloc]) continue;
        for (const m of code.matchAll(new RegExp(`(?<![\\w.])${nom}\\.(\\w+)\\b`, 'g'))) {
          if (!(m[1] in translations[lang][bloc])) absents.push(`${f} → ${nom}.${m[1]} (t.${bloc})`);
        }
      }
    }
    expect([...new Set(absents)], `Textes demandés mais absents du dictionnaire :\n  ${absents.join('\n  ')}`).toEqual([]);
  });
});
