import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateFile, validateMagicNumber } from '../src/middleware/fileValidator.js';

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

  it('rejects a filename with control chars', () => {
    const res = validateFile({
      originalname: 'bad\x00name.mp4',
      size: 1024,
      mimetype: 'video/mp4',
    });
    expect(res.valid).toBe(false);
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
  it('detects mismatched MP4 content', () => {
    const path = join(TMP, 'fake.mp4');
    writeFileSync(path, 'plain text not a video');
    const res = validateMagicNumber(path, '.mp4');
    expect(res.valid).toBe(false);
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

  it('accepts a WAV header (RIFF)', () => {
    const path = join(TMP, 'sound.wav');
    writeFileSync(path, Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]));
    const res = validateMagicNumber(path, '.wav');
    expect(res.valid).toBe(true);
  });
});
