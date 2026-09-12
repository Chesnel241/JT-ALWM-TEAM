import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateFile, validateMagicNumber } from '../src/middleware/fileValidator.js';
import { nomLisible } from '../src/middleware/sanitizer.js';

const TMP = join(tmpdir(), `jt-alwm-validator-${Date.now()}`);

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('validateFile', () => {
  it('rejects missing file', () => {
    const res = validateFile(null);
    expect(res.valid).toBe(false);
  });

  it('rejects a file with disallowed extension', () => {
    const res = validateFile({
      originalname: 'evil.exe',
      size: 1024,
      mimetype: 'application/octet-stream',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Extension/);
  });

  it('accepte un nom exotique — c’est l’étiquette qu’on nettoie, pas l’envoi qu’on refuse', () => {
    // Le fichier est écrit sous un UUID : le nom d'origine n'est qu'une
    // étiquette. Refuser l'envoi pour un deux-points ou un caractère de
    // contrôle coûtait un reportage, alors que nomLisible() suffit.
    for (const nom of ['bad\x00name.mp4', 'Enregistrement 2026-09-11 à 14:32:05.m4a', 'quoi?.mp4']) {
      const res = validateFile({ originalname: nom, size: 1024, mimetype: 'video/mp4' });
      expect(res.valid, nom).toBe(true);
    }
  });

  it('nettoie l’étiquette de ce qui pourrait nuire, sans la défigurer', () => {
    expect(nomLisible('bad\x00name.mp4')).toBe('badname.mp4');
    expect(nomLisible('../../etc/passwd')).not.toContain('/');
    // Accents, espaces et deux-points restent : le monteur doit pouvoir lire.
    expect(nomLisible('Enregistrement à 14:32.m4a')).toBe('Enregistrement à 14:32.m4a');
  });

  it('rejects a file too large', () => {
    const res = validateFile({
      originalname: 'big.mp4',
      size: 999 * 1024 * 1024 * 1024,
      mimetype: 'video/mp4',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/volumineux/);
  });

  it('accepts a clean MP4 metadata', () => {
    const res = validateFile({
      originalname: 'reportage.mp4',
      size: 1024,
      mimetype: 'video/mp4',
    });
    expect(res.valid).toBe(true);
  });
});

describe('validateMagicNumber', () => {
  it('laisse passer un contenu qu’il ne reconnaît pas, sans prétendre savoir', () => {
    // Ni signature connue, ni balisage : aucun avis, donc aucun refus. Un
    // « je ne sais pas » ne doit jamais coûter un reportage.
    const path = join(TMP, 'fake.mp4');
    writeFileSync(path, 'plain text not a video');
    const res = validateMagicNumber(path, '.mp4');
    expect(res.valid).toBe(true);
    expect(res.extensionReelle).toBe('');
  });

  it('refuse du balisage déguisé en média — le seul désaccord qui reste bloquant', () => {
    for (const [nom, contenu] of [
      ['piege.mp4', '<!DOCTYPE html><html><script>alert(1)</script></html>'],
      ['piege.jpg', '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'],
    ]) {
      const path = join(TMP, nom);
      writeFileSync(path, contenu);
      const res = validateMagicNumber(path, nom.slice(nom.lastIndexOf('.')));
      expect(res.valid, nom).toBe(false);
    }
  });

  it('accepts a valid MP4 header', () => {
    const path = join(TMP, 'real.mp4');
    const header = Buffer.from([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x69, 0x73, 0x6f, 0x6d,
      0x00, 0x00, 0x02, 0x00,
    ]);
    writeFileSync(path, header);
    const res = validateMagicNumber(path, '.mp4');
    expect(res.valid).toBe(true);
  });

  it('skips check for .txt (no signature)', () => {
    const path = join(TMP, 'note.txt');
    writeFileSync(path, 'hello');
    const res = validateMagicNumber(path, '.txt');
    expect(res.valid).toBe(true);
  });

  it('accepts a WAV header (RIFF + WAVE fourCC)', () => {
    const path = join(TMP, 'sound.wav');
    // RIFF à 0, taille (4 octets), 'WAVE' à l'offset 8.
    writeFileSync(path, Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0, 0, 0, 0,
    ]));
    const res = validateMagicNumber(path, '.wav');
    expect(res.valid).toBe(true);
  });

  it('distingue toujours un RIFF/WEBP d’un RIFF/WAVE, et dit lequel c’est', () => {
    const path = join(TMP, 'fake.wav');
    // RIFF mais 'WEBP' à l'offset 8. On ne le refuse plus — le serveur fixe
    // le type d'après l'extension et pose nosniff, donc le navigateur ne
    // réinterprétera jamais ces octets — mais on le RECONNAÎT, et c'est le
    // contenu réel qui est rapporté à l'appelant.
    writeFileSync(path, Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0,
    ]));
    const res = validateMagicNumber(path, '.wav');
    expect(res.valid).toBe(true);
    expect(res.extensionReelle).toBe('.webp');
  });
});
