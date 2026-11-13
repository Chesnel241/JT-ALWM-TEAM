import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { existsSync, mkdirSync, writeFileSync, statSync, utimesSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { WEEKS } from '../src/data/constants.js';
import { nettoyerSommaire, lireSommaireTexte, MAX_CHAPITRES, TITRE_MAX } from '../src/lib/sommaire.js';
import { nomLeger, nomTelechargementLeger } from '../src/lib/leger.js';
import { fabriquerVersionLegere, planifierVersionLegere } from '../src/services/versionLegere.js';
import { addDelivery, deleteDelivery, getDelivery, getFileMetadata, cleanupExpiredUploads } from '../src/data/store.js';
import { finishJob, registerJobWeek, registerJobSommaire, setProgress } from '../src/services/editorProgress.js';
import { nomDuMaster } from '../src/routes/deliveries.js';

// LE BESOIN : le master du JT pèse plusieurs centaines de Mo, et beaucoup de
// correspondants le regardent sur un téléphone, en données mobiles. Une
// version légère se fabrique à la publication ; le master reste en qualité TV.
// Le sommaire (où commence chaque reportage) suit le master jusqu'au lecteur.

const SEMAINE = WEEKS.find((w) => w.status === 'active').id;
let app;
beforeAll(() => {
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});

const ecrire = (nom, octets) => {
  const chemin = join(TEST_UPLOADS_DIR, nom);
  writeFileSync(chemin, Buffer.alloc(octets, 1));
  return chemin;
};

describe('le sommaire du JT — nettoyé avant d’être montré à tous', () => {
  it('garde des instants bornés et des titres en texte simple, dans l’ordre', () => {
    const propre = nettoyerSommaire([
      { t: 252.04, titre: '  Le marché\u202e de <b>Mont-Bouët</b>  ' },
      { t: 0, titre: 'Générique' },
      { t: -3, titre: 'avant le début' },
      { t: 99999, titre: 'après la fin' },
      { t: 'abc', titre: 'pas un instant' },
      { t: 40, titre: '   ' },
      { t: 0, titre: 'doublon du même instant' },
    ]);
    expect(propre).toEqual([
      { t: 0, titre: 'Générique' },
      { t: 252, titre: 'Le marché de bMont-Bouët/b' },
    ]);
  });

  it('borne la longueur des titres et le nombre de chapitres', () => {
    const long = nettoyerSommaire([{ t: 1, titre: 'x'.repeat(500) }]);
    expect(long[0].titre).toHaveLength(TITRE_MAX);
    const beaucoup = nettoyerSommaire(Array.from({ length: 200 }, (_, i) => ({ t: i * 10, titre: `Partie ${i}` })));
    expect(beaucoup).toHaveLength(MAX_CHAPITRES);
  });

  it('ignore un champ multipart illisible plutôt que d’échouer la publication', () => {
    expect(lireSommaireTexte('{pas du json')).toEqual([]);
    expect(lireSommaireTexte(undefined)).toEqual([]);
    expect(lireSommaireTexte(JSON.stringify([{ t: 3, titre: 'Les titres' }]))).toEqual([{ t: 3, titre: 'Les titres' }]);
  });
});

describe('la version légère — fabrication', () => {
  it('pose la copie à côté du master quand elle fait vraiment gagner de la place', async () => {
    const master = ecrire('leger-gain.mp4', 10_000);
    const r = await fabriquerVersionLegere(master, { encoder: async (_e, sortie) => writeFileSync(sortie, Buffer.alloc(2_000)) });
    expect(r).toEqual({ statut: 'pret', filename: 'leger-gain.leger.mp4', octets: 2_000 });
    expect(existsSync(join(TEST_UPLOADS_DIR, 'leger-gain.leger.mp4'))).toBe(true);
    expect(existsSync(join(TEST_UPLOADS_DIR, 'leger-gain.leger.mp4.tmp'))).toBe(false);
  });

  it('jette une copie qui ne gagne pas 20 % : le master est déjà léger', async () => {
    const master = ecrire('leger-inutile.mp4', 10_000);
    const r = await fabriquerVersionLegere(master, { encoder: async (_e, sortie) => writeFileSync(sortie, Buffer.alloc(9_000)) });
    expect(r).toEqual({ statut: 'inutile' });
    expect(existsSync(join(TEST_UPLOADS_DIR, 'leger-inutile.leger.mp4'))).toBe(false);
    expect(existsSync(join(TEST_UPLOADS_DIR, 'leger-inutile.leger.mp4.tmp'))).toBe(false);
  });

  it('ne laisse rien derrière un encodage raté', async () => {
    const master = ecrire('leger-rate.mp4', 10_000);
    const r = await fabriquerVersionLegere(master, {
      encoder: async (_e, sortie) => { writeFileSync(sortie, 'à moitié'); throw new Error('flux illisible'); },
    });
    expect(r).toEqual({ statut: 'echec' });
    expect(existsSync(join(TEST_UPLOADS_DIR, 'leger-rate.leger.mp4.tmp'))).toBe(false);
  });

  it('encode réellement en 480p avec ffmpeg, sans agrandir', async () => {
    const master = join(TEST_UPLOADS_DIR, 'leger-reel.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libx264', '-b:v', '12M', '-c:a', 'aac', '-shortest', master]);
    const r = await fabriquerVersionLegere(master);
    expect(r.statut).toBe('pret');
    const sonde = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', join(TEST_UPLOADS_DIR, r.filename)]).toString());
    expect(sonde.streams[0]).toEqual({ width: 854, height: 480 });
    expect(r.octets).toBeLessThan(statSync(master).size * 0.8);
  }, 30_000);
});

describe('la version légère — suivi de la livraison', () => {
  it('passe de « en préparation » à « prête », avec sa taille', async () => {
    ecrire('suivi.mp4', 10_000);
    const livraison = addDelivery(SEMAINE, { id: 'f0e1d2c3-0000-4000-8000-000000000001', name: 'JT.mp4', filename: 'suivi.mp4', type: 'video', size: '0.0 MB' });
    const signaux = [];
    const fin = planifierVersionLegere(SEMAINE, livraison, {
      dossier: TEST_UPLOADS_DIR,
      signaler: () => signaux.push(getDelivery(SEMAINE).find((d) => d.id === livraison.id)?.leger?.statut),
      encoder: async (_e, sortie) => writeFileSync(sortie, Buffer.alloc(3 * 1024 * 1024 / 1000)),
    });
    expect(getDelivery(SEMAINE).find((d) => d.id === livraison.id).leger).toEqual({ statut: 'en_cours' });
    await fin;
    const apres = getDelivery(SEMAINE).find((d) => d.id === livraison.id).leger;
    expect(apres).toMatchObject({ statut: 'pret', filename: 'suivi.leger.mp4', size: '0.0 MB' });
    expect(signaux).toEqual(['en_cours', 'pret']);
    // Le téléchargement porte un nom qui dit ce qu'on enregistre.
    expect(getFileMetadata('suivi.leger.mp4').name).toBe('JT (version légère).mp4');
  });

  it('ne fabrique rien pour un JT retiré avant son tour', async () => {
    ecrire('retire.mp4', 10_000);
    const livraison = addDelivery(SEMAINE, { id: 'f0e1d2c3-0000-4000-8000-000000000002', name: 'JT.mp4', filename: 'retire.mp4', type: 'video' });
    let encode = false;
    const fin = planifierVersionLegere(SEMAINE, livraison, { dossier: TEST_UPLOADS_DIR, encoder: async () => { encode = true; } });
    deleteDelivery(SEMAINE, livraison.id);
    await fin;
    expect(encode).toBe(false);
  });

  it('ignore ce qui n’est pas une vidéo', () => {
    expect(planifierVersionLegere(SEMAINE, { id: 'x', type: 'document', filename: 'conducteur.pdf' }, { dossier: TEST_UPLOADS_DIR })).toBe(false);
  });

  // L'INCIDENT évité : la balayeuse des orphelins ne connaissait que
  // `filename` et `proxyFilename` ; la copie légère, référencée par
  // `leger.filename`, aurait été effacée 24 h après sa fabrication.
  it('n’est pas prise pour un orphelin par le nettoyage horaire', async () => {
    const chemin = ecrire('balayage.leger.mp4', 100);
    ecrire('balayage.mp4', 100);
    addDelivery(SEMAINE, { id: 'f0e1d2c3-0000-4000-8000-000000000003', name: 'JT.mp4', filename: 'balayage.mp4', type: 'video', leger: { statut: 'pret', filename: 'balayage.leger.mp4' } });
    const ancien = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    utimesSync(chemin, ancien, ancien);
    await cleanupExpiredUploads(null, TEST_UPLOADS_DIR);
    expect(existsSync(chemin)).toBe(true);
  });

  it('nomme les fichiers sans ambiguïté', () => {
    expect(nomLeger('3f2a.mp4')).toBe('3f2a.leger.mp4');
    expect(nomTelechargementLeger('JT ALWM - Semaine 46 (2026).mp4')).toBe('JT ALWM - Semaine 46 (2026) (version légère).mp4');
    // Les semaines s'écrivent « 2026-w46 » sur le serveur.
    expect(nomDuMaster('2026-w46')).toBe('JT ALWM - Semaine 46 (2026).mp4');
    expect(nomDuMaster('2026-W07')).toBe('JT ALWM - Semaine 7 (2026).mp4');
  });
});

describe('POST /api/deliveries/:weekId/depuis-export — publier le master du studio', () => {
  const exporte = (nom) => {
    mkdirSync(join(TEST_UPLOADS_DIR, 'exports'), { recursive: true });
    writeFileSync(join(TEST_UPLOADS_DIR, 'exports', nom), Buffer.alloc(4096, 7));
  };
  const rendu = (jobId, url, semaine = SEMAINE, sommaire = []) => {
    registerJobWeek(jobId, semaine);
    registerJobSommaire(jobId, sommaire);
    setProgress(jobId, 90, 'encoding');
    finishJob(jobId, 'done', url);
  };

  it('publie le master sans aller-retour, avec son sommaire et un nom lisible', async () => {
    exporte('export_studio-1.mp4');
    rendu('job-studio-1', '/uploads/exports/export_studio-1.mp4', SEMAINE, [{ t: 0, titre: 'Générique' }, { t: 41.3, titre: 'Les titres' }]);
    const res = await request(app).post(`/api/deliveries/${SEMAINE}/depuis-export`).send({ jobId: 'job-studio-1' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(nomDuMaster(SEMAINE));
    expect(res.body.sommaire).toEqual([{ t: 0, titre: 'Générique' }, { t: 41.3, titre: 'Les titres' }]);
    expect(res.body.type).toBe('video');
    // Le fichier de la livraison existe sous son propre nom.
    expect(existsSync(join(TEST_UPLOADS_DIR, res.body.filename))).toBe(true);
    expect(res.body.filename).not.toMatch(/export_/);

    // Une seconde fois : déjà publié.
    const encore = await request(app).post(`/api/deliveries/${SEMAINE}/depuis-export`).send({ jobId: 'job-studio-1' });
    expect(encore.status).toBe(409);
  });

  it('refuse un rendu inconnu, d’une autre semaine, ou dont le master a disparu', async () => {
    const inconnu = await request(app).post(`/api/deliveries/${SEMAINE}/depuis-export`).send({ jobId: 'job-qui-n-existe-pas' });
    expect(inconnu.status).toBe(404);

    exporte('export_autre.mp4');
    const autre = WEEKS.find((w) => w.id !== SEMAINE).id;
    rendu('job-autre-semaine', '/uploads/exports/export_autre.mp4', autre);
    const ailleurs = await request(app).post(`/api/deliveries/${SEMAINE}/depuis-export`).send({ jobId: 'job-autre-semaine' });
    expect(ailleurs.status).toBe(400);

    rendu('job-disparu', '/uploads/exports/export_efface.mp4');
    const disparu = await request(app).post(`/api/deliveries/${SEMAINE}/depuis-export`).send({ jobId: 'job-disparu' });
    expect(disparu.status).toBe(410);
  });

  // Le chemin du master vient du suivi du rendu ; même là, rien hors du
  // dossier des exports n'est publiable.
  it('ne publie jamais un fichier hors du dossier des exports', async () => {
    ecrire('store-secret.mp4', 10);
    rendu('job-chemin', '/uploads/exports/../store-secret.mp4');
    const res = await request(app).post(`/api/deliveries/${SEMAINE}/depuis-export`).send({ jobId: 'job-chemin' });
    expect(res.status).toBe(410);
  });

  it('retire la version légère avec le JT', async () => {
    exporte('export_retrait.mp4');
    rendu('job-retrait', '/uploads/exports/export_retrait.mp4');
    const pub = await request(app).post(`/api/deliveries/${SEMAINE}/depuis-export`).send({ jobId: 'job-retrait' });
    const leger = join(TEST_UPLOADS_DIR, nomLeger(pub.body.filename));
    writeFileSync(leger, 'copie');
    const res = await request(app).delete(`/api/deliveries/${SEMAINE}/${pub.body.id}`);
    expect(res.status).toBe(204);
    expect(existsSync(leger)).toBe(false);
  });
});

describe('POST /api/deliveries/:weekId — un dépôt manuel peut joindre le sommaire', () => {
  it('garde le sommaire envoyé avec le fichier', async () => {
    const MP4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32]);
    const res = await request(app)
      .post(`/api/deliveries/${SEMAINE}`)
      .field('sommaire', JSON.stringify([{ t: 0, titre: 'Générique' }, { t: 95, titre: 'La pêche reprend à Kribi' }]))
      .attach('file', MP4, { filename: 'jt.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);
    expect(res.body.sommaire).toEqual([{ t: 0, titre: 'Générique' }, { t: 95, titre: 'La pêche reprend à Kribi' }]);
    expect(res.body.leger).toEqual({ statut: 'en_cours' });
  });
});
