import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegStatic from 'ffmpeg-static';
import { generateAssFile, OVERLAY_TEMPLATES, FONT_FAMILIES } from '../src/data/overlayTemplates.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '../fonts');

// Familles déclarées dans les \fn des templates → préfixe du fichier TTF
// attendu. Si libass substitue (ex: DejaVu) le texte est invisible sur
// Render (conteneur sans polices système).
const EXPECTED = {
  Inter: 'Inter',
  Anton: 'Anton',
  'Bebas Neue': 'BebasNeue',
};

const SAMPLE_FIELDS = {
  name: 'Marie Dupont', title: 'JOURNAL TELEVISE',
  date: 'Semaine du 26 Mai', pays: 'CONGO',
  sujet: 'Elections au Benin', texte: 'EDITION SPECIALE',
};

describe('overlay animations & templates', () => {
  const read = (overlays) => {
    const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-anim-'));
    const p = generateAssFile(overlays, wd);
    const content = fs.readFileSync(p, 'utf8');
    fs.rmSync(wd, { recursive: true, force: true });
    return content;
  };

  it('expose les nouveaux modèles JT', () => {
    const ids = OVERLAY_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['titre_karaoke', 'sous_titre', 'score_resultat', 'horloge_date']));
  });

  it('génère les tags d\'animation attendus', () => {
    const scale = read([{ templateId: 'lower_third', fields: { name: 'Marie' }, animation: 'scale' }]);
    expect(scale).toContain('\\fscx40');
    expect(scale).toContain('\\t(0,400');

    const tw = read([{ templateId: 'sous_titre', fields: { texte: 'AB' }, animation: 'typewriter' }]);
    expect(tw).toContain('\\k3'); // karaoké par caractère
    expect(tw).toContain('\\2a&HFF&'); // secondaire invisible

    const sweep = read([{ templateId: 'titre_reportage', fields: { sujet: 'X' }, animation: 'sweep' }]);
    expect(sweep).toMatch(/\\t\(0,600,\\1c/);
  });

  it('échappe les caractères de contrôle ASS dans le texte', () => {
    // 'a{b}\\c' (= a{b}\c) → \ devient /, accolades supprimées → 'ab/c'.
    const c = read([{ templateId: 'flash_info', fields: { texte: 'a{b}\\c' }, animation: 'fade' }]);
    expect(c).toContain('ab/c');
    expect(c).not.toContain('{b}');
  });
});

describe('editor overlay fonts', () => {
  it('bundles the broadcast TTF fonts used by the templates', () => {
    const files = fs.readdirSync(FONTS_DIR);
    expect(files).toContain('Inter.ttf');
    expect(files).toContain('Anton-Regular.ttf');
    expect(files).toContain('BebasNeue-Regular.ttf');
    // Pas de woff2 : libass ne sait pas les lire → erreurs au render.
    expect(files.some((f) => f.endsWith('.woff2'))).toBe(false);
  });

  it('resolves every overlay font to a bundled TTF (no substitution)', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-ass-test-'));
    const overlays = OVERLAY_TEMPLATES.map((t, i) => ({
      id: `o${i}`, templateId: t.id, fields: SAMPLE_FIELDS,
      startTime: 0, duration: 5,
    }));
    const assPath = generateAssFile(overlays, workDir);
    const outPng = path.join(workDir, 'frame.png');

    // libass logue "fontselect: (Family, ...) -> File" sur stderr en verbose.
    const { stderr } = await execFileAsync(ffmpegStatic, [
      '-hide_banner', '-loglevel', 'verbose',
      '-f', 'lavfi', '-i', 'color=c=navy:s=1920x1080:d=1',
      '-vf', `ass=filename=${assPath}:fontsdir=${FONTS_DIR}`,
      '-frames:v', '1', '-y', outPng,
    ]);

    const lines = stderr.split('\n').filter((l) => l.includes('fontselect'));
    expect(lines.length).toBeGreaterThan(0);

    for (const [family, ttfPrefix] of Object.entries(EXPECTED)) {
      const line = lines.find((l) => l.includes(`(${family},`));
      expect(line, `font ${family} should be requested`).toBeTruthy();
      expect(line, `font ${family} substituted (${line})`).toContain(ttfPrefix);
      expect(line.toLowerCase(), `font ${family} fell back to DejaVu`).not.toContain('dejavu');
    }
    expect(fs.existsSync(outPng)).toBe(true);

    fs.rmSync(workDir, { recursive: true, force: true });
  }, 30000);

  // Préfixes TTF attendus par famille (override \fn) — pas de substitution.
  const FAMILY_TTF = {
    Inter: 'Inter', Anton: 'Anton', 'Bebas Neue': 'BebasNeue', 'Archivo Black': 'ArchivoBlack',
    Barlow: 'Barlow', 'Fjalla One': 'FjallaOne', 'PT Serif': 'PTSerif', 'PT Sans': 'PTSans',
    'Titillium Web': 'TitilliumWeb',
  };

  it('résout chaque police bundlée via l\'override font (aucune substitution)', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-font-'));
    const overlays = FONT_FAMILIES.map((f, i) => ({
      id: `f${i}`, templateId: 'lower_third', font: f,
      fields: { name: `Test ${f}`, title: 'x' }, startTime: 0, duration: 3,
    }));
    const assPath = generateAssFile(overlays, workDir);
    const outPng = path.join(workDir, 'frame.png');
    const { stderr } = await execFileAsync(ffmpegStatic, [
      '-hide_banner', '-loglevel', 'verbose',
      '-f', 'lavfi', '-i', 'color=c=navy:s=1920x1080:d=1',
      '-vf', `ass=filename=${assPath}:fontsdir=${FONTS_DIR}`,
      '-frames:v', '1', '-y', outPng,
    ]);
    const lines = stderr.split('\n').filter((l) => l.includes('fontselect'));
    for (const [family, ttf] of Object.entries(FAMILY_TTF)) {
      const line = lines.find((l) => l.includes(`(${family},`));
      expect(line, `${family} demandée`).toBeTruthy();
      expect(line, `${family} substituée (${line})`).toContain(ttf);
    }
    fs.rmSync(workDir, { recursive: true, force: true });
  }, 30000);
});
