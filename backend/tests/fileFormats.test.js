import { describe, it, expect } from 'vitest';
import { validateFile } from '../src/middleware/fileValidator.js';
import { ALLOWED_EXTENSIONS } from '../src/lib/upload.js';

function file(originalname, mimetype, size = 1024) {
  return { originalname, mimetype, size };
}

describe('formats acceptés', () => {
  it('accepte les vidéos des téléphones et caméscopes courants', () => {
    const cases = [
      ['sujet.mp4', 'video/mp4'],
      ['sujet.mov', 'video/quicktime'],
      ['sujet.mkv', 'video/x-matroska'],
      ['sujet.3gp', 'video/3gpp'],
      ['sujet.MTS', 'video/mp2t'],
      ['sujet.avi', 'video/x-msvideo'],
      ['sujet.webm', 'video/webm'],
    ];
    for (const [name, mime] of cases) {
      expect(validateFile(file(name, mime), { allowImages: true }), name).toMatchObject({ valid: true });
    }
  });

  it('accepte les audios, y compris AMR et Opus', () => {
    for (const [name, mime] of [
      ['voix.mp3', 'audio/mpeg'],
      ['voix.m4a', 'audio/mp4'],
      ['voix.amr', 'audio/amr'],
      ['voix.opus', 'audio/opus'],
      ['voix.flac', 'audio/flac'],
      ['voix.wav', 'audio/wav'],
    ]) {
      expect(validateFile(file(name, mime), { allowImages: true }), name).toMatchObject({ valid: true });
    }
  });

  it('accepte les images, y compris le HEIC des iPhone', () => {
    for (const [name, mime] of [
      ['photo.jpg', 'image/jpeg'],
      ['photo.heic', 'image/heic'],
      ['photo.png', 'image/png'],
      ['photo.tiff', 'image/tiff'],
      ['photo.avif', 'image/avif'],
    ]) {
      expect(validateFile(file(name, mime), { allowImages: true }), name).toMatchObject({ valid: true });
    }
  });

  it('accepte un envoi mobile qui ne sait pas nommer son type', () => {
    expect(validateFile(file('sujet.mp4', 'application/octet-stream'), { allowImages: true }))
      .toMatchObject({ valid: true });
  });

  it('accepte les textes et documents du monteur', () => {
    for (const [name, mime] of [
      ['script.txt', 'text/plain'],
      ['script.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['script.pdf', 'application/pdf'],
    ]) {
      expect(validateFile(file(name, mime), { allowImages: true }), name).toMatchObject({ valid: true });
    }
  });

  it('refuse toujours ce qui n\'est pas un média ou un document', () => {
    for (const [name, mime] of [
      ['virus.exe', 'application/octet-stream'],
      ['script.sh', 'text/x-shellscript'],
      ['page.html', 'text/html'],
    ]) {
      expect(validateFile(file(name, mime), { allowImages: true }).valid, name).toBe(false);
    }
  });

  it('partage la même liste d\'extensions que multer et TUS', () => {
    for (const ext of ['.mkv', '.amr', '.heic', '.3gp', '.opus', '.tiff']) {
      expect(ALLOWED_EXTENSIONS.has(ext), ext).toBe(true);
    }
  });
});

describe('classement du fichier reçu', () => {
  it('se fie à l\'extension, pas au type annoncé par le téléphone', async () => {
    const { classifyUpload } = await import('../src/lib/upload.js');
    // Cas réel : un client d'upload annonce application/octet-stream pour tout.
    expect(classifyUpload('voix_off.wav', 'application/octet-stream')).toBe('audio');
    expect(classifyUpload('ambiance.mp3', 'application/octet-stream')).toBe('audio');
    expect(classifyUpload('photo.heic', 'application/octet-stream')).toBe('image');
    expect(classifyUpload('sujet.mkv', 'application/octet-stream')).toBe('video');
    expect(classifyUpload('script.docx', 'application/octet-stream')).toBe('script');
  });

  it('retombe sur le MIME quand le nom ne dit rien', async () => {
    const { classifyUpload } = await import('../src/lib/upload.js');
    expect(classifyUpload('sansextension', 'audio/mpeg')).toBe('audio');
    expect(classifyUpload('sansextension', 'image/png')).toBe('image');
  });

  it('ne range plus un fichier inconnu dans les rushes vidéo', async () => {
    const { classifyUpload } = await import('../src/lib/upload.js');
    expect(classifyUpload('mystere.xyz', 'application/octet-stream')).toBe('script');
  });
});
