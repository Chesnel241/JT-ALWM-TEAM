import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { concatenateVideos } from '../src/services/editorService.js';

/**
 * Régressions : durcissements anti-écran-noir / anti-master-corrompu
 * (1) isRendering ne doit jamais leaker si le setup synchrone (mkdtempSync, etc.)
 *     jette → sinon l'éditeur reste verrouillé sur 429 jusqu'au redémarrage.
 * (2) finalPath manquant ou < 1 ko = throw, jamais de "success" mensonger.
 *     Ces deux garde-fous protègent contre les bouton « Télécharger » qui
 *     pointent sur un MP4 de 0 octet.
 */
describe('editorService — durcissements pipeline Master', () => {
  let tmpUploads;
  let prevRenderer;
  let prevUploads;
  const origMkdtemp = fs.mkdtempSync;

  beforeEach(() => {
    prevRenderer = process.env.RENDERER;
    prevUploads = process.env.UPLOADS_DIR;
    tmpUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-master-tests-'));
    process.env.RENDERER = 'libass';
    process.env.UPLOADS_DIR = tmpUploads;
  });

  afterEach(() => {
    fs.mkdtempSync = origMkdtemp;
    if (prevRenderer === undefined) delete process.env.RENDERER;
    else process.env.RENDERER = prevRenderer;
    if (prevUploads === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = prevUploads;
    try { fs.rmSync(tmpUploads, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('libère isRendering si le setup synchrone (mkdtempSync) jette', async () => {
    // 1er appel : sabote mkdtempSync APRÈS l'avoir laissé passer côté setProgress (qui n'en a pas besoin).
    fs.mkdtempSync = vi.fn(() => { throw new Error('disk full (test)'); });

    await expect(
      concatenateVideos([{ filename: 'a.mp4' }])
    ).rejects.toThrowError(/disk full/);

    // Restaure mkdtempSync et vérifie qu'un 2e appel n'est PAS bloqué par
    // un isRendering=true fantôme (sinon → "déjà en train de monter").
    fs.mkdtempSync = origMkdtemp;
    await expect(
      concatenateVideos([{ filename: 'inexistant.mp4' }])
    ).rejects.not.toThrowError(/déjà en train de monter/);
  });

  it('rejette une demande vide sans verrouiller le service', async () => {
    await expect(concatenateVideos([])).rejects.toThrowError(/Aucune vidéo/);
    // 2e appel doit pouvoir démarrer.
    await expect(concatenateVideos([])).rejects.toThrowError(/Aucune vidéo/);
  });
});
