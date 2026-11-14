import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from '@ffprobe-installer/ffprobe';
import {
  sorteApercu,
  nomApercu,
  fabriquerApercu,
  SONS_SANS_LECTEUR,
  IMAGES_SANS_LECTEUR,
} from '../src/services/apercus.js';
import { sourceLisible } from '../src/services/editorService.js';
import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS } from '../src/lib/upload.js';

/**
 * Les aperçus des sons et des photos que les navigateurs ne savent pas lire.
 *
 * L'INCIDENT (tests de bout en bout, frontend/e2e/formats.spec.js) : le WMA,
 * l'AMR, l'AIFF, le CAF, l'AC3, le TIFF et le HEIC étaient acceptés à l'envoi,
 * mais le montage ne pouvait ni les écouter ni les voir dans Chromium, et une
 * photo HEIC placée dans le JT faisait échouer le rendu.
 * LE BESOIN : une copie lisible à côté de l'original, jamais à sa place.
 */

let dir;
const lire = (fichier) => JSON.parse(execFileSync(ffprobe.path, ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', fichier]));

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-apercus-'));
  const son = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2'];
  execFileSync(ffmpegPath, ['-y', ...son, '-c:a', 'wmav2', '-f', 'asf', path.join(dir, 'windows.wma')], { stdio: 'ignore' });
  execFileSync(ffmpegPath, ['-y', ...son, '-c:a', 'pcm_s16be', '-f', 'aiff', path.join(dir, 'mac.aiff')], { stdio: 'ignore' });
  execFileSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=3000x1000', '-frames:v', '1', '-c:v', 'tiff', '-f', 'image2', path.join(dir, 'scan.tif')], { stdio: 'ignore' });
});

afterAll(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* rien */ } });

describe('ce qui a besoin d’un aperçu', () => {
  it('les sons et photos que Chromium ne lit pas, et eux seuls', () => {
    expect(sorteApercu('.wma')).toBe('son');
    expect(sorteApercu('.AMR')).toBe('son');
    expect(sorteApercu('.heic')).toBe('image');
    expect(sorteApercu('.tiff')).toBe('image');
    // Lus tels quels : pas de copie inutile.
    for (const ext of ['.mp3', '.m4a', '.wav', '.ogg', '.jpg', '.png', '.webp', '.avif', '.mp4']) {
      expect(sorteApercu(ext), ext).toBeNull();
    }
  });

  it('ne vise que des formats que la plateforme accepte', () => {
    for (const ext of SONS_SANS_LECTEUR) expect(AUDIO_EXTENSIONS, ext).toContain(ext);
    for (const ext of IMAGES_SANS_LECTEUR) expect(IMAGE_EXTENSIONS, ext).toContain(ext);
  });

  it('nomme la copie d’après l’original, à côté de lui', () => {
    expect(nomApercu('abc.wma', 'son')).toBe('abc.proxy.m4a');
    expect(nomApercu('/x/y/abc.HEIC', 'image')).toBe('abc.proxy.jpg');
  });
});

describe('fabrication', () => {
  it.each(['windows.wma', 'mac.aiff'])('fait de %s un son AAC lisible, sans toucher l’original', async (nom) => {
    const original = path.join(dir, nom);
    const avant = fs.statSync(original).size;
    const r = await fabriquerApercu(original, path.extname(nom), { binaires: [ffmpegPath] });
    expect(r.nom).toBe(nomApercu(nom, 'son'));
    expect(fs.statSync(original).size).toBe(avant);
    const info = lire(path.join(dir, r.nom));
    expect(info.streams[0].codec_name).toBe('aac');
    expect(Number(info.format.duration)).toBeGreaterThan(1.5);
  });

  it('fait d’un TIFF de 3000 px un JPEG de 2048 px au plus', async () => {
    const r = await fabriquerApercu(path.join(dir, 'scan.tif'), '.tif', { binaires: [ffmpegPath] });
    const v = lire(path.join(dir, r.nom)).streams[0];
    expect(v.codec_name).toBe('mjpeg');
    expect(v.width).toBe(2048);
  });

  it('essaie le ffmpeg suivant quand le premier ne sait pas lire le fichier', async () => {
    // Le cas du HEIC des iPhone : le ffmpeg du système échoue, celui que le
    // serveur embarque réussit.
    const r = await fabriquerApercu(path.join(dir, 'scan.tif'), '.tif', { binaires: ['/bin/false', ffmpegPath] });
    expect(r?.nom).toBe('scan.proxy.jpg');
  });

  it('n’échoue jamais bruyamment : sans lecteur, pas d’aperçu ni de fichier à moitié écrit', async () => {
    const faux = path.join(dir, 'abime.wma');
    fs.writeFileSync(faux, Buffer.from('ceci n’est pas du son, juste du texte'));
    const r = await fabriquerApercu(faux, '.wma', { binaires: [ffmpegPath] });
    expect(r).toBeNull();
    expect(fs.readdirSync(dir).filter((f) => f.startsWith('abime.proxy'))).toEqual([]);
  });

  it('ne fabrique rien pour un format déjà lisible', async () => {
    expect(await fabriquerApercu(path.join(dir, 'inutile.mp3'), '.mp3')).toBeNull();
  });
});

describe('le rendu du JT', () => {
  it('prend l’aperçu d’une photo ou d’un son illisible quand il existe, l’original sinon', async () => {
    await fabriquerApercu(path.join(dir, 'scan.tif'), '.tif', { binaires: [ffmpegPath] });
    expect(sourceLisible('scan.tif', { dossier: dir })).toBe('scan.proxy.jpg');
    // Pas encore d'aperçu : l'original, plutôt que rien.
    expect(sourceLisible('autre.heic', { dossier: dir })).toBe('autre.heic');
    // Une vidéo, un son lisible, une adresse : inchangés.
    expect(sourceLisible('rush.mp4', { dossier: dir })).toBe('rush.mp4');
    expect(sourceLisible('voix.mp3', { dossier: dir })).toBe('voix.mp3');
    expect(sourceLisible('https://exemple.org/photo.heic', { dossier: dir })).toBe('https://exemple.org/photo.heic');
  });
});
