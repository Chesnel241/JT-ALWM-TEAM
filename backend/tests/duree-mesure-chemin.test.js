import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import logger from '../src/logger/index.js';
import { mesurerDuree, planifierMesure } from '../src/services/mediaDuration.js';

/**
 * Les durées des rushes n'étaient jamais mesurées.
 *
 * `planifierMesure` faisait `path.join(uploadsDir, nomFichier)` alors que
 * `uploadsDir` est une fonction. Chaque mesure levait « The "path" argument
 * must be of type string. Received function uploadsDir », l'erreur était
 * avalée par le `catch` du planificateur, et les monteurs lisaient « durée
 * inconnue » sur chaque fichier sans qu'aucune alerte ne remonte.
 *
 * Même famille d'erreur que celle gardée par `editor-libass-paths.test.js` :
 * une fonction référencée au lieu d'être appelée. Elle est passée deux fois,
 * dans deux services différents — d'où ce second garde-fou.
 */

let dossier;
let clip;

beforeAll(() => {
  dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-duree-'));
  clip = path.join(dossier, 'rush.mp4');
  // Un vrai fichier lisible par ffprobe : sans lui, on ne vérifierait que
  // l'absence d'erreur, pas qu'une durée sort effectivement.
  execFileSync(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', 'testsrc=size=64x64:rate=10:duration=2',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', clip,
  ], { stdio: 'ignore' });
});

afterAll(() => {
  fs.rmSync(dossier, { recursive: true, force: true });
});

describe('mesurerDuree', () => {
  it('rend la durée d’un vrai fichier', async () => {
    await expect(mesurerDuree(clip)).resolves.toBe(2);
  });

  it('rend null plutôt que de lever sur un fichier absent', async () => {
    await expect(mesurerDuree(path.join(dossier, 'nexiste-pas.mp4'))).resolves.toBeNull();
  });
});

describe('planifierMesure résout le chemin sous le dossier des envois', () => {
  let ancien;
  let avertissements;

  beforeEach(() => {
    ancien = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = dossier;
    avertissements = [];
    vi.spyOn(logger, 'warn').mockImplementation((message) => { avertissements.push(message); });
  });

  afterEach(() => {
    if (ancien === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = ancien;
    vi.restoreAllMocks();
  });

  /** La file est asynchrone : on lui laisse le temps de vider sa tâche. */
  const laisserTourner = () => new Promise((r) => setTimeout(r, 400));

  it('n’échoue plus en tentant de joindre une fonction à un nom de fichier', async () => {
    // C'est le test qui manquait. Avec le défaut, l'unique trace était un
    // avertissement dans les journaux, que personne ne lisait.
    planifierMesure('2026-w38', 'cm', 'id-1', 'rush.mp4', () => {});
    await laisserTourner();

    const coupable = avertissements.find((m) => /Mesure de durée en échec/.test(m));
    expect(coupable, `avertissements : ${avertissements.join(' | ')}`).toBeUndefined();
  });

  it('ne se plaint pas non plus pour un fichier introuvable', async () => {
    // Un rush supprimé entre l'envoi et la mesure est un cas normal : la
    // durée reste inconnue, sans bruit dans les journaux.
    planifierMesure('2026-w38', 'cm', 'id-2', 'disparu.mp4', () => {});
    await laisserTourner();

    expect(avertissements.filter((m) => /Mesure de durée en échec/.test(m))).toEqual([]);
  });

  it('ignore un appel auquel il manque un argument', () => {
    expect(() => planifierMesure(null, 'cm', 'id-3', 'rush.mp4', () => {})).not.toThrow();
    expect(() => planifierMesure('2026-w38', 'cm', 'id-3', '', () => {})).not.toThrow();
  });
});
