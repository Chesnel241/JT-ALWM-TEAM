import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { TEST_UPLOADS_DIR } from './setup.js';

// LE BESOIN : générique et virgules sont montés à part, une fois, et
// resservent chaque semaine. Déposés comme des rushes, ils disparaissaient
// avec leur semaine. Ils sont rangés par catégorie et gardés jusqu'à
// suppression manuelle.
const ADMIN = 'montage-jingles';
// L'en-tête d'un vrai MP4 : la taille de la boîte, puis « ftypisom ».
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
let app; let avant; let estFichierDeJingle; let getJingles; let uploadsDir;

// La garde « équipe montage » laisse tout passer sous NODE_ENV=test (figé à
// l'import) : on remonte l'application hors mode test, comme admin-guards,
// pour vérifier la vraie protection.
beforeAll(async () => {
  avant = process.env.ADMIN_PASSWORD;
  vi.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_PASSWORD = ADMIN;
  const { createApp } = await import('../src/app.js');
  ({ estFichierDeJingle, getJingles } = await import('../src/data/store.js'));
  ({ uploadsDir } = await import('../src/lib/upload.js'));
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});
afterAll(() => {
  process.env.NODE_ENV = 'test';
  if (avant === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = avant;
});

const deposer = (categorie, nom = 'generique.mp4', contenu = MP4) => request(app)
  .post('/api/jingles').set('X-Admin-Password', ADMIN)
  .field('categorie', categorie).attach('file', contenu, nom);

describe('les jingles du JT', () => {
  it('sont réservés à l’équipe montage', async () => {
    expect((await request(app).get('/api/jingles')).status).toBe(403);
    expect((await request(app).post('/api/jingles').field('categorie', 'generique').attach('file', MP4, 'a.mp4')).status).toBe(403);
  });

  it('annoncent leurs cinq catégories, dans l’ordre du JT', async () => {
    const res = await request(app).get('/api/jingles').set('X-Admin-Password', ADMIN);
    expect(res.body.categories).toEqual(['generique', 'reportages', 'annonces', 'seminaires', 'mot']);
  });

  it('un jingle déposé est rangé dans sa catégorie et son fichier est gardé', async () => {
    const res = await deposer('reportages', 'Virgule reportages.mp4');
    expect(res.status).toBe(201);
    expect(res.body.jingle).toMatchObject({ categorie: 'reportages', name: 'Virgule reportages', type: 'video' });
    expect(fs.existsSync(path.join(uploadsDir, res.body.jingle.filename))).toBe(true);
    const liste = await request(app).get('/api/jingles').set('X-Admin-Password', ADMIN);
    expect(liste.body.jingles.map((j) => j.id)).toContain(res.body.jingle.id);
  });

  // Sans cette protection, la balayeuse des fichiers orphelins l'aurait
  // effacé au bout de 24 h : il n'appartient à aucune semaine.
  it('n’est jamais pris pour un fichier orphelin', async () => {
    const { body } = await deposer('generique');
    expect(estFichierDeJingle(body.jingle.filename)).toBe(true);
    expect(estFichierDeJingle('un-rush-quelconque.mp4')).toBe(false);
  });

  it('refuse une catégorie inconnue, sans laisser de fichier derrière', async () => {
    const avantDepot = fs.readdirSync(uploadsDir).filter((f) => f.startsWith('jingle-')).length;
    const res = await deposer('meteo');
    expect(res.status).toBe(400);
    expect(fs.readdirSync(uploadsDir).filter((f) => f.startsWith('jingle-')).length).toBe(avantDepot);
  });

  it('refuse ce qui n’est pas une vidéo', async () => {
    expect((await deposer('generique', 'notes.txt', Buffer.from('bonjour'))).status).toBe(400);
  });

  it('ne disparaît que sur suppression, et son fichier part avec lui', async () => {
    const { body } = await deposer('mot', 'Mot du JT.mp4');
    const chemin = path.join(uploadsDir, body.jingle.filename);
    expect((await request(app).delete(`/api/jingles/${body.jingle.id}`)).status).toBe(403);
    expect(fs.existsSync(chemin)).toBe(true);
    const res = await request(app).delete(`/api/jingles/${body.jingle.id}`).set('X-Admin-Password', ADMIN);
    expect(res.status).toBe(200);
    expect(fs.existsSync(chemin)).toBe(false);
    expect(getJingles().some((j) => j.id === body.jingle.id)).toBe(false);
    expect((await request(app).delete(`/api/jingles/${body.jingle.id}`).set('X-Admin-Password', ADMIN)).status).toBe(404);
  });
});
