import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { concatenateVideos } from '../src/services/editorService.js';

/**
 * Régression : en mode libass (défaut), concatenateVideos résout les clips
 * sous uploadsDir(). Un bug historique référençait `uploadsDir` (la fonction
 * importée de paths.js) sans l'appeler → ReferenceError silencieux qui
 * faisait échouer TOUT montage local. Ce test garantit qu'on atteint bien la
 * résolution de fichier (erreur métier "n'existe pas") et non un ReferenceError.
 */
describe('concatenateVideos — mode libass, résolution uploadsDir', () => {
  let tmpUploads;
  let prevRenderer;
  let prevUploads;

  beforeEach(() => {
    prevRenderer = process.env.RENDERER;
    prevUploads = process.env.UPLOADS_DIR;
    tmpUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-uploads-test-'));
    process.env.RENDERER = 'libass';
    process.env.UPLOADS_DIR = tmpUploads;
  });

  afterEach(() => {
    if (prevRenderer === undefined) delete process.env.RENDERER;
    else process.env.RENDERER = prevRenderer;
    if (prevUploads === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = prevUploads;
    try { fs.rmSync(tmpUploads, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('lève une erreur métier (et non un ReferenceError) pour un clip absent', async () => {
    await expect(
      concatenateVideos([{ filename: 'inexistant.mp4' }])
    ).rejects.toThrowError(/n'existe pas/);
  });

  it('ne lève jamais "uploadsDir is not defined"', async () => {
    let caught;
    try {
      await concatenateVideos([{ filename: 'inexistant.mp4' }]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught).not.toBeInstanceOf(ReferenceError);
    expect(caught.message).not.toMatch(/uploadsDir is not defined/);
  });
});
