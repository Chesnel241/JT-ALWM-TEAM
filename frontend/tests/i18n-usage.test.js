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
