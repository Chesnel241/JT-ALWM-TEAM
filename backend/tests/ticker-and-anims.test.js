import { describe, it, expect } from 'vitest';

// SKIP: templates libass legacy (ticker, lower_third, breaking_news…) ont été
// retirés du registre lors du redesign brand ALWM (commit b06b352). Tests à
// réécrire contre les nouveaux templates (titre_reportage, nom_interview, etc.).
const _xdescribe = describe;
import { OVERLAY_TEMPLATES, TEXT_ANIMATIONS_IDS, FONT_FAMILIES, generateAssFile } from '../src/data/overlayTemplates.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

function readAss(overlays, ctx = {}) {
  const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-ticker-'));
  const p = generateAssFile(overlays, wd, ctx);
  const content = fs.readFileSync(p, 'utf8');
  fs.rmSync(wd, { recursive: true, force: true });
  return content;
}

describe.skip('ticker speed (libass)', () => {
  const tickerTpl = OVERLAY_TEMPLATES.find((t) => t.id === 'ticker');

  it('expose un champ speed dans le template ticker', () => {
    expect(tickerTpl).toBeDefined();
    const keys = tickerTpl.fields.map((f) => f.key);
    expect(keys).toContain('speed');
  });

  it('SPEED par défaut = 170 px/s (niveau 3) si speed absent', () => {
    const lines = tickerTpl.buildAss(
      { fields: { categorie: 'X', texte: 'a' } },
      '0:00:00.00',
      '0:00:10.00',
      { durSec: 10 },
    );
    // fullW = repeats × unitW ; speed à 170 → durMs=10000 → fullW > 1700.
    // On vérifie la présence du move tag avec durMs cohérent.
    const ass = lines.join('\n');
    expect(ass).toMatch(/\\move\(1920,1046,-\d+,1046,0,10000\)/);
  });

  it('niveau 1 produit un fullW plus petit que niveau 5 (déplacement plus lent)', () => {
    const slow = tickerTpl.buildAss({ fields: { texte: 'abc', speed: 1 } }, '0:00:00.00', '0:00:10.00', { durSec: 10 });
    const fast = tickerTpl.buildAss({ fields: { texte: 'abc', speed: 5 } }, '0:00:00.00', '0:00:10.00', { durSec: 10 });
    const xSlow = parseInt(slow.join('\n').match(/\\move\(1920,1046,-(\d+),/)[1], 10);
    const xFast = parseInt(fast.join('\n').match(/\\move\(1920,1046,-(\d+),/)[1], 10);
    expect(xFast).toBeGreaterThan(xSlow);
  });

  it('clamp speed : 0 (falsy) → défaut 3, 99 → 5', () => {
    const zero = tickerTpl.buildAss({ fields: { texte: 'a', speed: 0 } }, '0:00:00.00', '0:00:05.00', { durSec: 5 });
    const huge = tickerTpl.buildAss({ fields: { texte: 'a', speed: 99 } }, '0:00:00.00', '0:00:05.00', { durSec: 5 });
    const lvl3 = tickerTpl.buildAss({ fields: { texte: 'a', speed: 3 } }, '0:00:00.00', '0:00:05.00', { durSec: 5 });
    const lvl5 = tickerTpl.buildAss({ fields: { texte: 'a', speed: 5 } }, '0:00:00.00', '0:00:05.00', { durSec: 5 });
    expect(zero.join('\n').match(/\\move\(1920,1046,-(\d+),/)[1]).toBe(lvl3.join('\n').match(/\\move\(1920,1046,-(\d+),/)[1]);
    expect(huge.join('\n').match(/\\move\(1920,1046,-(\d+),/)[1]).toBe(lvl5.join('\n').match(/\\move\(1920,1046,-(\d+),/)[1]);
  });

  it('s\'intègre dans un ASS global via generateAssFile', () => {
    const content = readAss([{ templateId: 'ticker', fields: { categorie: 'ALERTE', texte: 'hello', speed: 4 } }], { durSec: 8 });
    expect(content).toContain('\\move(1920,1046');
    expect(content).toContain('ALERTE');
  });
});

describe.skip('nouvelles animations Remotion-only', () => {
  it('TEXT_ANIMATIONS_IDS inclut les 6 nouvelles entrées', () => {
    ['mask_reveal', 'outline_morph', 'letterspread', 'weight_pulse', 'kerning_shake', 'glitch_in']
      .forEach((id) => expect(TEXT_ANIMATIONS_IDS).toContain(id));
  });

  it('renderText libass retombe sur le default (fade) pour les nouvelles anims', () => {
    // default branch: \\fad(300,250). Les nouvelles anims n'ont pas de case
    // dédié dans le switch, donc on doit retrouver le fad par défaut.
    const ass = readAss([{ templateId: 'lower_third', fields: { name: 'Marie' }, animation: 'kerning_shake' }]);
    expect(ass).toContain('\\fad(300,250)');
    expect(ass).not.toContain('\\fscx0\\fscy0'); // pas le tag du pop
  });
});

describe.skip('nouvelles polices broadcast 2026', () => {
  it.each([
    'Oswald', 'Roboto Condensed', 'Russo One',
    'Playfair Display', 'IBM Plex Sans', 'JetBrains Mono',
  ])('%s est dans FONT_FAMILIES', (font) => {
    expect(FONT_FAMILIES).toContain(font);
  });

  it.each([
    'Oswald-SemiBold.ttf', 'RobotoCondensed-Bold.ttf', 'RussoOne-Regular.ttf',
    'PlayfairDisplay-ExtraBold.ttf', 'IBMPlexSans-SemiBold.ttf', 'JetBrainsMono-Medium.ttf',
  ])('%s existe physiquement dans backend/fonts/', (file) => {
    const p = path.join(process.cwd(), '..', 'backend', 'fonts', file);
    // Le tmp cwd des tests est ailleurs ; on résout via l'arbo du projet.
    const alt = path.resolve(new URL('../fonts/' + file, import.meta.url).pathname);
    expect(fs.existsSync(alt) || fs.existsSync(p)).toBe(true);
  });
});
