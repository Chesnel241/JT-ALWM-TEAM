import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { TEST_UPLOADS_DIR } from './setup.js';
import { semaineActive } from './semaine.js';

/**
 * Le parcours réel d'un fichier, du protocole TUS jusqu'au store.
 *
 * Ces cas viennent tous de terrain : un correspondant filme avec le
 * téléphone qu'il a, partage avec l'application qu'il a, et le nom comme le
 * type annoncé arrivent abîmés. Chacun de ces envois échouait, ou était mal
 * rangé, avant ce lot. Un format refusé, c'est un reportage perdu pour la
 * semaine — donc chaque ligne ici vaut un reportage.
 */

// La semaine active, et non une semaine figée : une suite qui ne passe que la
// semaine de son écriture annonce une panne tous les lundis.
const SEMAINE = semaineActive();
const PAYS = 'cm';

let app;

beforeAll(async () => {
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

afterAll(() => { vi.resetModules(); });

/** En-têtes réels de conteneurs, complétés de remplissage. */
function corps(entete, taille = 512) {
  const buf = Buffer.alloc(taille, 0x20);
  Buffer.from(entete).copy(buf, 0);
  return buf;
}

const iso = (marque) => corps([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
  ...Buffer.from(marque, 'latin1'),
]);

const ECHANTILLONS = {
  mp4: iso('isom'),
  mov_ftyp: iso('qt  '),
  // Un .mov de caméscope : pas de `ftyp`, une boîte `wide` en tête.
  mov_wide: corps([0x00, 0x00, 0x00, 0x08, 0x77, 0x69, 0x64, 0x65]),
  m4a: iso('M4A '),
  heic: iso('heic'),
  troisgp: iso('3gp4'),
  webm: corps([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01,
    0x42, 0xf7, 0x81, 0x01, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]),
  mkv: corps([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x88, 0x6d,
    0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b, 0x61]),
  wav: corps([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]),
  avi: corps([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20]),
  mp3: corps([0xff, 0xfb, 0x90, 0x00]),
  // Le cas iPhone : Safari annonce « audio/aac », les octets sont de l'ADTS.
  aac: corps([0xff, 0xf1, 0x50, 0x80]),
  ogg: corps([0x4f, 0x67, 0x67, 0x53]),
  amr: corps([0x23, 0x21, 0x41, 0x4d, 0x52, 0x0a]),
  jpg: corps([0xff, 0xd8, 0xff, 0xe0]),
  png: corps([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

const b64 = (v) => Buffer.from(String(v), 'utf-8').toString('base64');

/** Envoie réellement le fichier par le protocole TUS et renvoie sa fiche. */
async function televerser({ nom, type, octets }) {
  const meta = [
    `filename ${b64(nom)}`,
    `name ${b64(nom)}`,
    `filetype ${b64(type)}`,
    `weekId ${b64(SEMAINE)}`,
    `countryId ${b64(PAYS)}`,
  ].join(',');

  const creation = await request(app)
    .post('/api/tus/')
    .set('Tus-Resumable', '1.0.0')
    .set('Upload-Length', String(octets.length))
    .set('Upload-Metadata', meta);

  if (creation.status !== 201) {
    return { statut: creation.status, corps: creation.text };
  }

  const emplacement = creation.headers.location;
  const id = emplacement.split('/').filter(Boolean).pop();

  const envoi = await request(app)
    .patch(`/api/tus/${id}`)
    .set('Tus-Resumable', '1.0.0')
    .set('Upload-Offset', '0')
    .set('Content-Type', 'application/offset+octet-stream')
    .send(octets);

  const { getCountryUploads } = await import('../src/data/store.js');
  const fiche = getCountryUploads(SEMAINE, PAYS).find((f) => f.filename?.startsWith(id));
  return { statut: envoi.status, id, fiche };
}

describe('tout format part, quel que soit le téléphone', () => {
  const cas = [
    ['un mp4 ordinaire', 'rush.mp4', 'video/mp4', ECHANTILLONS.mp4, 'video', '.mp4'],
    ['un mov QuickTime', 'rush.mov', 'video/quicktime', ECHANTILLONS.mov_ftyp, 'video', '.mov'],
    ['un mkv', 'rush.mkv', 'video/x-matroska', ECHANTILLONS.mkv, 'video', '.mkv'],
    ['un 3gp de téléphone d’entrée de gamme', 'rush.3gp', 'video/3gpp', ECHANTILLONS.troisgp, 'video', '.3gp'],
    ['une photo HEIC d’iPhone', 'photo.heic', 'image/heic', ECHANTILLONS.heic, 'image', '.heic'],
    ['un mémo vocal AMR', 'note.amr', 'audio/amr', ECHANTILLONS.amr, 'audio', '.amr'],
    ['un wav', 'son.wav', 'audio/wav', ECHANTILLONS.wav, 'audio', '.wav'],
  ];

  it.each(cas)('%s', async (_titre, nom, type, octets, familleAttendue, extAttendue) => {
    const { statut, fiche } = await televerser({ nom, type, octets });
    expect(statut).toBe(204);
    expect(fiche).toBeDefined();
    expect(fiche.type).toBe(familleAttendue);
    expect(path.extname(fiche.filename)).toBe(extAttendue);
  });
});

describe('les envois qui échouaient', () => {
  it('accepte un nom SANS extension, en reconnaissant les octets', async () => {
    const { statut, fiche } = await televerser({
      nom: 'reportage',
      type: 'application/octet-stream',
      octets: ECHANTILLONS.mp4,
    });
    expect(statut).toBe(204);
    expect(fiche.type).toBe('video');
    // Le fichier a été renommé d'après ce que ses octets disaient.
    expect(path.extname(fiche.filename)).toBe('.mp4');
    expect(existsSync(path.join(TEST_UPLOADS_DIR, fiche.filename))).toBe(true);
  });

  it('accepte un nom nu avec un type annoncé utilisable', async () => {
    const { statut, fiche } = await televerser({
      nom: 'video',
      type: 'video/webm',
      octets: ECHANTILLONS.webm,
    });
    expect(statut).toBe(204);
    expect(fiche.type).toBe('video');
    expect(path.extname(fiche.filename)).toBe('.webm');
  });

  it('accepte un .mov de caméscope qui ne commence pas par « ftyp »', async () => {
    const { statut, fiche } = await televerser({
      nom: 'camescope.mov',
      type: 'video/quicktime',
      octets: ECHANTILLONS.mov_wide,
    });
    expect(statut).toBe(204);
    expect(fiche.type).toBe('video');
  });

  it('accepte l’enregistrement iPhone annoncé « audio/aac »', async () => {
    const { statut, fiche } = await televerser({
      nom: 'voix.aac',
      type: 'audio/aac',
      octets: ECHANTILLONS.aac,
    });
    expect(statut).toBe(204);
    expect(fiche.type).toBe('audio');
  });

  it('accepte un nom contenant deux-points, comme les enregistrements iOS', async () => {
    const { statut, fiche } = await televerser({
      nom: 'Enregistrement 2026-09-11 à 14:32:05.m4a',
      type: 'audio/mp4',
      octets: ECHANTILLONS.m4a,
    });
    expect(statut).toBe(204);
    expect(fiche.type).toBe('audio');
  });

  it('range une voix off WebM dans l’audio, pas dans les rushes vidéo', async () => {
    const { fiche } = await televerser({
      nom: 'voix-off.webm',
      type: 'audio/webm',
      octets: ECHANTILLONS.webm,
    });
    expect(fiche.type).toBe('audio');
  });
});

describe('ce qui doit encore être refusé', () => {
  it('refuse une extension explicitement dangereuse', async () => {
    for (const nom of ['page.html', 'payload.svg', 'script.js', 'binaire.exe']) {
      const { statut } = await televerser({
        nom,
        type: 'application/octet-stream',
        octets: ECHANTILLONS.mp4,
      });
      expect(statut, nom).toBe(415);
    }
  });

  it('garde sans extension ce qu’il ne reconnaît pas, plutôt que de le refuser', async () => {
    // Un script de reportage en texte brut : aucune signature binaire. Il ne
    // doit pas être perdu pour autant. Sans extension, le serveur statique le
    // sert en pièce jointe — donc sans risque.
    const { statut, fiche } = await televerser({
      nom: 'conducteur',
      type: 'application/octet-stream',
      octets: Buffer.from('Lancement plateau, puis sujet Pikine.\n'),
    });
    expect(statut).toBe(204);
    expect(fiche).toBeDefined();
    expect(path.extname(fiche.filename)).toBe('');
  });
});

describe('aucun secret ne reste sur le disque', () => {
  it('ne laisse ni mot de passe ni lien personnel dans les métadonnées écrites', async () => {
    const meta = [
      `filename ${b64('rush.mp4')}`,
      `name ${b64('rush.mp4')}`,
      `filetype ${b64('video/mp4')}`,
      `weekId ${b64(SEMAINE)}`,
      `countryId ${b64(PAYS)}`,
      `adminPassword ${b64('mot-de-passe-tres-secret')}`,
      `reporterToken ${b64('jeton-personnel-tres-secret')}`,
    ].join(',');

    const creation = await request(app)
      .post('/api/tus/')
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', String(ECHANTILLONS.mp4.length))
      .set('Upload-Metadata', meta);
    expect(creation.status).toBe(201);

    const { readFileSync } = await import('fs');
    const sidecars = readdirSync(TEST_UPLOADS_DIR).filter((f) => f.endsWith('.json'));
    for (const f of sidecars) {
      const contenu = readFileSync(path.join(TEST_UPLOADS_DIR, f), 'utf-8');
      expect(contenu).not.toContain('tres-secret');
    }
  });
});
