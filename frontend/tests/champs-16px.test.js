import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// L'INCIDENT : sur iPhone, un champ en dessous de 16 px fait zoomer toute la
// page au toucher ; le correspondant se retrouvait sur un écran agrandi,
// sans savoir comment revenir. Les sélecteurs de semaine des écrans
// journalistes étaient en `text-sm` sur téléphone.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src/components');
describe('les champs des écrans journalistes', () => {
  it.each(['StudioVoixJournaliste.jsx', 'JTPretJournaliste.jsx', 'MobileUploaderView.jsx'])('%s : aucun <select> sous 16 px', (f) => {
    const source = readFileSync(join(SRC, f), 'utf8');
    const selects = [...source.matchAll(/<select[\s\S]*?className="([^"]*)"/g)].map((m) => m[1]);
    for (const classes of selects) expect(classes.split(/\s+/)).not.toContain('text-sm');
  });
});
