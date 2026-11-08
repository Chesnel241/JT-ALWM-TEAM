import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../tailwind.config.js';

/**
 * L'INCIDENT : Tailwind 3 n'écrit aucune règle pour `bg-[var(--accent)]/10`.
 * 181 classes de ce type ne faisaient rien — encadrés sans fond, voiles de
 * fenêtres transparents. On passe par les couleurs `v-…` du thème.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src');
const fichiers = readdirSync(SRC, { recursive: true }).map(String).filter((f) => /\.(js|jsx)$/.test(f));

describe('les teintes en variable', () => {
  it('aucune classe « -[var(--x)]/NN », que Tailwind ignorerait', () => {
    const fautifs = fichiers.filter((f) => /-\[(color:)?var\(--[a-z0-9-]+\)\]\/\d+/.test(readFileSync(join(SRC, f), 'utf8')));
    expect(fautifs).toEqual([]);
  });

  it('chaque couleur « v-… » employée existe dans le thème', () => {
    const connues = new Set(Object.keys(config.theme.extend.colors));
    const employees = new Set();
    for (const f of fichiers) {
      for (const m of readFileSync(join(SRC, f), 'utf8').matchAll(/-(v-[a-z0-9-]+?)\/\d+/g)) employees.add(m[1]);
    }
    expect([...employees].filter((c) => !connues.has(c))).toEqual([]);
  });
});
