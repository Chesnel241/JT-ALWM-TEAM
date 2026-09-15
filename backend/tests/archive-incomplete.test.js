import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { writeFileSync } from 'fs';
import path from 'path';
import { TEST_UPLOADS_DIR } from './setup.js';
import { semaineActive } from './semaine.js';

/**
 * Le zip d'un chutier doit dire ce qu'il ne contient pas.
 *
 * Un fichier référencé au store mais absent du disque — purge passée, envoi
 * interrompu — était silencieusement écarté. La rédaction recevait une
 * archive incomplète sans l'apprendre, et cherchait un rush qui n'arriverait
 * jamais.
 */

// La semaine active, et non une semaine figée : une suite qui ne passe que la
// semaine de son écriture annonce une panne tous les lundis.
const SEMAINE = semaineActive();
const PAYS = 'ci';

let app;

beforeAll(async () => {
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });

  const { addUpload } = await import('../src/data/store.js');

  // Une pièce bien présente sur le disque…
  const present = 'present-dans-le-zip.mp4';
  writeFileSync(path.join(TEST_UPLOADS_DIR, present), Buffer.alloc(64, 0x20));
  addUpload(SEMAINE, PAYS, {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Sujet marché.mp4', filename: present, type: 'video',
    size: '0.1 MB', status: 'pending', uploadedAt: new Date().toISOString(),
  });

  // …et une pièce que le store connaît mais que le disque n'a plus.
  addUpload(SEMAINE, PAYS, {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Interview préfet.mp4', filename: 'disparu-du-disque.mp4', type: 'video',
    size: '0.1 MB', status: 'pending', uploadedAt: new Date().toISOString(),
  });
});

afterAll(() => { vi.resetModules(); });

describe('archive d’un chutier', () => {
  it('signale par un fichier joint ce qui n’a pas pu être inclus', async () => {
    const res = await request(app)
      .get(`/api/uploads/${SEMAINE}/${PAYS}/archive`)
      .buffer(true)
      .parse((r, cb) => {
        const morceaux = [];
        r.on('data', (c) => morceaux.push(c));
        r.on('end', () => cb(null, Buffer.concat(morceaux)));
      });

    expect(res.status).toBe(200);
    // Le zip est en mode « stockage » (niveau 0) : noms et contenus y
    // apparaissent en clair, ce qui suffit à vérifier sans le décompresser.
    // Lecture en UTF-8, puisque c'est ainsi que noms et note sont écrits.
    const brut = res.body.toString('utf-8');
    expect(brut).toContain('FICHIERS-MANQUANTS.txt');
    expect(brut).toContain('Interview préfet.mp4');
    // La pièce présente, elle, est bien dans l'archive.
    expect(brut).toContain('Sujet marché.mp4');
  });
});
