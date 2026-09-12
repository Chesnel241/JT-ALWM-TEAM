import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FFMPEG_PATH } from '../src/lib/ffmpeg.js';
import { mesurerDuree } from '../src/services/mediaDuration.js';

/**
 * La durée est mesurée sur de VRAIS fichiers fabriqués par ffmpeg, et non sur
 * une réponse simulée : c'est la lecture de l'en-tête par ffprobe qu'on veut
 * vérifier, pas notre propre code de simulation.
 */

let dossier;
const fichiers = {};

function fabriquer(nom, args) {
  const chemin = join(dossier, nom);
  execFileSync(FFMPEG_PATH, ['-y', '-loglevel', 'error', ...args, chemin], { stdio: 'pipe' });
  return chemin;
}

beforeAll(() => {
  dossier = mkdtempSync(join(tmpdir(), 'jt-duree-'));

  fichiers.audio = fabriquer('voix.mp3', [
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
  ]);
  fichiers.video = fabriquer('rush.mp4', [
    '-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=25',
    '-pix_fmt', 'yuv420p',
  ]);
  fichiers.image = fabriquer('photo.jpg', [
    '-f', 'lavfi', '-i', 'testsrc=duration=1:size=160x120:rate=1', '-frames:v', '1',
  ]);

  fichiers.texte = join(dossier, 'script.txt');
  writeFileSync(fichiers.texte, 'Le marché de Douala, ouverture sur le plan large.', 'utf8');

  fichiers.tronque = join(dossier, 'casse.mp4');
  writeFileSync(fichiers.tronque, Buffer.from('pas du tout un conteneur mp4'), 'binary');
}, 120000);

afterAll(() => {
  if (dossier) rmSync(dossier, { recursive: true, force: true });
});

describe('mesure de la durée des rushes', () => {
  it('lit la durée d’un audio', async () => {
    const duree = await mesurerDuree(fichiers.audio);
    expect(duree).toBeGreaterThan(2.8);
    expect(duree).toBeLessThan(3.3);
  });

  it('lit la durée d’une vidéo', async () => {
    const duree = await mesurerDuree(fichiers.video);
    expect(duree).toBeGreaterThan(1.8);
    expect(duree).toBeLessThan(2.3);
  });

  it('rend null pour une image, plutôt que « 0 s »', async () => {
    // Une photo n'a pas de durée. Afficher « 0 s » ferait croire à un
    // fichier vide au monteur qui parcourt la liste.
    expect(await mesurerDuree(fichiers.image)).toBeNull();
  });

  it('rend null pour un script', async () => {
    expect(await mesurerDuree(fichiers.texte)).toBeNull();
  });

  it('rend null pour un fichier illisible, sans lever', async () => {
    // Le fichier est arrivé et il est conservé : une sonde qui échoue ne doit
    // jamais remonter en erreur d'envoi.
    expect(await mesurerDuree(fichiers.tronque)).toBeNull();
  });

  it('rend null pour un fichier absent', async () => {
    expect(await mesurerDuree(join(dossier, 'jamais-vu.mp4'))).toBeNull();
  });
});
