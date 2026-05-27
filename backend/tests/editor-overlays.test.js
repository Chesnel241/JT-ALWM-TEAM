import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { generateAssFile, OVERLAY_TEMPLATES } from '../src/data/overlayTemplates.js';

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
    const { stderr } = await execFileAsync(ffmpegInstaller.path, [
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
});
