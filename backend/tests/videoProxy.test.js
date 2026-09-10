import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { compressTo720, proxyNameFor } from '../src/services/videoCompress.js';

import ffprobe from '@ffprobe-installer/ffprobe';

const probe = ffprobe.path;
let dir;

function dimensions(file) {
  const out = JSON.parse(
    execFileSync(probe, ['-v', 'quiet', '-print_format', 'json', '-show_streams', file])
  );
  const v = out.streams.find((s) => s.codec_type === 'video');
  return `${v.width}x${v.height}`;
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-proxy-'));
  execFileSync(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=25', '-t', '1',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    path.join(dir, 'master.mp4'),
  ], { stdio: 'ignore' });
});

afterAll(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

describe('nom du proxy', () => {
  it('dérive du master, toujours en .mp4', () => {
    expect(proxyNameFor('abc.mov')).toBe('abc.proxy.mp4');
    expect(proxyNameFor('abc.MKV')).toBe('abc.proxy.mp4');
    expect(proxyNameFor('/tmp/dossier/abc.mp4')).toBe('abc.proxy.mp4');
    expect(proxyNameFor('sans-extension')).toBe('sans-extension.proxy.mp4');
  });
});

describe('fabrication du proxy', () => {
  it('garde le master intact et écrit une copie 720p à côté', () => {
    // Régression : la version précédente renommait le réencodage par-dessus
    // l'original. Un rush 1080p devenait définitivement 720p, et l'export —
    // qui rend en 1080p — repartait de ce 720p, donc l'agrandissait.
    const master = path.join(dir, 'master.mp4');
    const tailleAvant = fs.statSync(master).size;

    return compressTo720(master, '.mp4').then((res) => {
      expect(res.compressed).toBe(true);
      expect(res.proxyName).toBe('master.proxy.mp4');

      expect(fs.existsSync(master)).toBe(true);
      expect(fs.statSync(master).size).toBe(tailleAvant);
      expect(dimensions(master)).toBe('1920x1080');

      const proxy = path.join(dir, res.proxyName);
      expect(fs.existsSync(proxy)).toBe(true);
      expect(dimensions(proxy)).toBe('1280x720');
      expect(fs.statSync(proxy).size).toBeLessThan(tailleAvant);
    });
  }, 60000);

  it('ne touche pas à un format qui n\'est pas une vidéo', async () => {
    const texte = path.join(dir, 'script.txt');
    fs.writeFileSync(texte, 'bonjour');
    const res = await compressTo720(texte, '.txt');
    expect(res.compressed).toBe(false);
    expect(res.proxyName).toBe('');
    expect(fs.readFileSync(texte, 'utf-8')).toBe('bonjour');
  });

  it('accepte les extensions que le téléphone produit vraiment', async () => {
    // .mkv et .mts étaient acceptés à l'envoi mais ignorés à la fabrication du
    // proxy : le monteur travaillait alors sur le master selon l'appareil du
    // correspondant, sans que rien ne le signale.
    const mkv = path.join(dir, 'camescope.mkv');
    execFileSync(ffmpegPath, [
      '-y', '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=25', '-t', '1',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', mkv,
    ], { stdio: 'ignore' });

    const res = await compressTo720(mkv, '.mkv');
    expect(res.compressed).toBe(true);
    expect(dimensions(path.join(dir, res.proxyName))).toBe('1280x720');
    expect(dimensions(mkv)).toBe('1920x1080');
  }, 60000);
});
