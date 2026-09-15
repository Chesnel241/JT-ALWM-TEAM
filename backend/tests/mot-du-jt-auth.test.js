import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { TEST_UPLOADS_DIR } from './setup.js';
import { semaineActive } from './semaine.js';
import * as store from '../src/data/store.js';
import { generateDownloadToken } from '../src/lib/downloadTokens.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';

const ADMIN = 'test-admin-password';
// La semaine active, et non une semaine figée : une suite qui ne passe que la
// semaine de son écriture annonce une panne tous les lundis.
const SEMAINE = semaineActive();

let app;
let prevAdmin;
let prevReporterAccess;

beforeAll(() => {
  prevAdmin = process.env.ADMIN_PASSWORD;
  prevReporterAccess = process.env.REPORTER_ACCESS;
  process.env.ADMIN_PASSWORD = ADMIN;
  process.env.REPORTER_ACCESS = 'strict'; // En mode strict pour vérifier que la portée n'exige pas de lien

  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

afterAll(() => {
  if (prevAdmin === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = prevAdmin;
  if (prevReporterAccess === undefined) delete process.env.REPORTER_ACCESS;
  else process.env.REPORTER_ACCESS = prevReporterAccess;
});

describe('Mot du JT — téléversement et consultation libres, téléchargement protégé', () => {
  it('téléverser / compléter les champs est en libre accès (sans mot de passe ni token)', async () => {
    const res = await request(app)
      .put(`/api/rubriques/${SEMAINE}/motDuJt`)
      .send({ orateur: 'Journaliste Libre', theme: 'Reportage terrain' });
    expect(res.status).toBe(200);
    expect(res.body.orateur).toBe('Journaliste Libre');
  });

  it('consulter les rubriques et la liste des uploads est en libre accès', async () => {
    const resRubrique = await request(app).get(`/api/rubriques/${SEMAINE}/motDuJt`);
    expect(resRubrique.status).toBe(200);
    expect(resRubrique.body.champs.orateur).toBe('Journaliste Libre');

    const resUploads = await request(app).get(`/api/uploads/${SEMAINE}/mj`);
    expect(resUploads.status).toBe(200);
  });

  it('consulter en ligne (sans ?dl=1) un fichier mj est en libre accès', async () => {
    const filename = 'test-consultation-mj.mp4';
    const filePath = path.join(TEST_UPLOADS_DIR, filename);
    writeFileSync(filePath, 'fake mp4 content');

    vi.spyOn(store, 'getFileMetadata').mockImplementation((fname) => {
      if (fname === filename) return { countryId: 'mj', name: 'video.mp4', filename };
      return null;
    });

    try {
      // Consultation en ligne : pas de query ?dl=1
      const res = await request(app).get(`/uploads/${filename}`);
      expect(res.status).toBe(200);
      expect((res.text || res.body.toString())).toBe('fake mp4 content');
    } finally {
      store.getFileMetadata.mockRestore?.();
      if (existsSync(filePath)) unlinkSync(filePath);
    }
  });

  it('télécharger un fichier mj (?dl=1) est refusé sans authentification admin', async () => {
    const filename = 'test-download-mj.mp4';
    const filePath = path.join(TEST_UPLOADS_DIR, filename);
    writeFileSync(filePath, 'fake mp4 content');

    vi.spyOn(store, 'getFileMetadata').mockImplementation((fname) => {
      if (fname === filename) return { countryId: 'mj', name: 'video.mp4', filename };
      return null;
    });

    try {
      // Téléchargement sans auth : refusé 403
      const resRefuse = await request(app).get(`/uploads/${filename}?dl=1`);
      expect(resRefuse.status).toBe(403);
      expect(resRefuse.text).toMatch(/authentification requise/i);

      // Téléchargement avec X-Admin-Password : admis 200
      const resAdmin = await request(app)
        .get(`/uploads/${filename}?dl=1`)
        .set('X-Admin-Password', ADMIN);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.header['content-disposition']).toMatch(/attachment/i);

      // Téléchargement avec dl_token signé : admis 200
      const token = generateDownloadToken(filename);
      const resToken = await request(app).get(`/uploads/${filename}?dl=1&dl_token=${encodeURIComponent(token)}`);
      expect(resToken.status).toBe(200);
      expect(resToken.header['content-disposition']).toMatch(/attachment/i);
    } finally {
      store.getFileMetadata.mockRestore?.();
      if (existsSync(filePath)) unlinkSync(filePath);
    }
  });

  it('télécharger l\'archive zip mj est refusé sans admin, et autorisé avec admin ou token', async () => {
    const filename = 'video-archive.mp4';
    const filePath = path.join(TEST_UPLOADS_DIR, filename);
    writeFileSync(filePath, 'rush content');

    vi.spyOn(store, 'getCountryUploads').mockImplementation((w, c) => {
      if (c === 'mj') return [{ id: '1', filename, name: 'video.mp4' }];
      return [];
    });

    try {
      // Sans auth admin : 403
      const resRefuse = await request(app).get(`/api/uploads/${SEMAINE}/mj/archive`);
      expect(resRefuse.status).toBe(403);
      expect(resRefuse.body.message).toMatch(/authentification requise/i);

      // Avec X-Admin-Password : 200 (archive créée)
      const resAdmin = await request(app)
        .get(`/api/uploads/${SEMAINE}/mj/archive`)
        .set('X-Admin-Password', ADMIN);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.header['content-type']).toBe('application/zip');

      // Avec dl_token d'archive signé : 200
      const archiveToken = generateDownloadToken(`archive/${SEMAINE}/mj`);
      const resToken = await request(app)
        .get(`/api/uploads/${SEMAINE}/mj/archive?dl_token=${encodeURIComponent(archiveToken)}`);
      expect(resToken.status).toBe(200);
      expect(resToken.header['content-type']).toBe('application/zip');
    } finally {
      store.getCountryUploads.mockRestore?.();
      if (existsSync(filePath)) unlinkSync(filePath);
    }
  });
});
