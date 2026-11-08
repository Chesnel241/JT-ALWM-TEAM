import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// L'INCIDENT : « EN RETARD », blanc sur `--signal` (orangé clair), restait
// sous le seuil de lisibilité, là même où il comptait.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src');
describe('contrastes', () => {
  it('pas de texte blanc sur --signal', () => {
    const fautifs = readdirSync(SRC, { recursive: true }).map(String).filter((f) => f.endsWith('.jsx'))
      .filter((f) => /bg-\[var\(--signal\)\] text-white/.test(readFileSync(join(SRC, f), 'utf8')));
    expect(fautifs).toEqual([]);
  });
});
