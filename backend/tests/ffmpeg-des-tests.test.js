import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Aucun test n'appelle « ffmpeg » par son seul nom.
 *
 * L'INCIDENT : un test fabriquait sa vidéo d'essai avec
 * `execFileSync('ffmpeg', …)`. Le programme existe sur un poste de
 * développement, pas sur les machines de vérification de GitHub : la suite y
 * échouait (« spawnSync ffmpeg ENOENT »), et comme les images de déploiement
 * ne sont construites qu'après une suite verte, plusieurs livraisons de suite
 * n'ont jamais été déployées — sans que rien ne le signale sur le poste où
 * tout passait.
 *
 * Les tests passent par `FFMPEG_PATH` / `FFPROBE_PATH` (src/lib/ffmpeg.js),
 * c'est-à-dire par le programme que le serveur utilise lui-même, ou par
 * `ffmpeg-static` / `@ffprobe-installer/ffprobe`.
 */

const ICI = dirname(fileURLToPath(import.meta.url));
const APPEL_PAR_NOM = /\b(?:execFileSync|execFile|spawnSync|spawn|execSync|exec)\(\s*['"`](?:ffmpeg|ffprobe)\b/;

describe('les tests et ffmpeg', () => {
  it('ne l’appellent jamais par son seul nom', () => {
    const fautifs = readdirSync(ICI)
      .filter((f) => f.endsWith('.test.js') && f !== 'ffmpeg-des-tests.test.js')
      .flatMap((f) => readFileSync(join(ICI, f), 'utf8').split('\n')
        .map((ligne, i) => (APPEL_PAR_NOM.test(ligne) ? `${f}:${i + 1}` : null))
        .filter(Boolean));
    expect(fautifs).toEqual([]);
  });
});
