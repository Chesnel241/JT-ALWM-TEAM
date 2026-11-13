import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { WEEKS } from '../src/data/constants.js';
import { bilanDeSemaine, historique, octetsDe } from '../src/services/bilanSemaine.js';
import { addDelivery, addUpload, archiverBilan, bilansDesSemaines, cleanupExpiredUploads, getWeekUploads } from '../src/data/store.js';

// LE BESOIN : les statistiques ne savaient que cumuler depuis toujours, sans
// dire si cela allait mieux ou moins bien ; et une semaine s'efface du serveur
// deux jours après sa fin. Le bilan de chaque semaine est mis de côté avant
// l'effacement : c'est lui qui fait l'historique.

const SEMAINE = WEEKS.find((w) => w.status === 'active').id;
let app;
beforeAll(() => {
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});

describe('le bilan d’une semaine', () => {
  const bilan = bilanDeSemaine({
    weekId: '2026-w40',
    cutoffAt: '2026-10-04T08:30:00.000Z',
    paysAttendus: ['cm', 'sn', 'ga'],
    fichiersParPays: {
      cm: [
        { size: '30.0 MB', uploadedAt: '2026-10-02T10:00:00Z', status: 'approved' },
        { size: '10.0 MB', uploadedAt: '2026-10-01T10:00:00Z', status: 'rejected', feedback: '  Son   inaudible, merci de renvoyer  ', allege: { avant: 300, apres: 100 } },
      ],
      sn: [{ size: '5.0 MB', uploadedAt: '2026-10-04T12:00:00Z', isLate: true, status: 'rejected', feedback: 'Son inaudible, merci de renvoyer' }],
    },
    extensions: { requests: { sn: { status: 'approved' }, ga: { status: 'pending' } } },
    sujets: [{ id: 's1', countryId: 'cm' }, { id: 's2', countryId: 'cm' }],
    livraisons: [{
      type: 'video', uploadedAt: '2026-10-04T20:30:00Z', dureeSec: 1803.4,
      sommaire: [{ t: 0, titre: 'Générique' }, { t: 44, titre: 'A', sujetId: 's1' }],
      vues: { cm: { lectures: 4, telechargements: 2 }, sn: { lectures: 1 } },
    }],
  });

  it('compte la participation, l’heure et les retards', () => {
    expect(bilan.total).toMatchObject({ paysAttendus: 3, paysActifs: 2, aLHeure: 1, enRetard: 1, fichiers: 3 });
    expect(bilan.pays.cm).toMatchObject({ fichiers: 2, enRetard: 0, refuses: 1, premierEnvoi: '2026-10-01T10:00:00Z', sujets: 2, diffuses: 1 });
    expect(bilan.pays.ga.fichiers).toBe(0);
  });

  it('dit les délais demandés et accordés, le poids et le gain de l’allègement', () => {
    expect(bilan.pays.sn.delai).toBe('accorde');
    expect(bilan.pays.ga.delai).toBe('demande');
    expect(bilan.total).toMatchObject({ delaisDemandes: 2, delaisAccordes: 1, gainOctets: 200 });
    expect(bilan.total.octets).toBe(octetsDe('45 MB'));
  });

  it('regroupe les motifs de refus, sans les doublons d’écriture', () => {
    expect(bilan.motifs).toEqual([{ texte: 'Son inaudible, merci de renvoyer', n: 2 }]);
  });

  it('mesure le JT : publié douze heures après la clôture, trente minutes, vu par pays', () => {
    expect(bilan.jt).toEqual({ publieLe: '2026-10-04T20:30:00.000Z', apresClotureMin: 720, dureeSec: 1803 });
    expect(bilan.pays.cm).toMatchObject({ vues: 4, telechargements: 2 });
    expect(bilan.total).toMatchObject({ vues: 5, telechargements: 2 });
  });

  it('ne garde ni nom de fichier ni numéro', () => {
    const texte = JSON.stringify(bilan);
    expect(texte).not.toMatch(/filename|phone|\.mp4/);
  });

  it('lit les tailles telles que le serveur les écrit', () => {
    expect(octetsDe('30.1 MB')).toBe(Math.round(30.1 * 1024 * 1024));
    expect(octetsDe('812 octets')).toBe(812);
    expect(octetsDe('1,5 Go')).toBe(Math.round(1.5 * 1024 ** 3));
    expect(octetsDe('NaN MB')).toBe(0);
    expect(octetsDe(undefined)).toBe(0);
  });
});

describe('l’historique', () => {
  it('préfère le bilan à neuf d’une semaine encore présente, et range du plus récent au plus ancien', () => {
    const h = historique(
      [{ weekId: '2026-w46', v: 'vivant' }, { weekId: '2026-w45', v: 'vivant' }],
      { '2026-w45': { weekId: '2026-w45', v: 'conservé' }, '2026-w44': { weekId: '2026-w44', v: 'conservé' }, '2025-w52': { weekId: '2025-w52' } },
      3,
    );
    expect(h.map((b) => `${b.weekId}:${b.v || ''}`)).toEqual(['2026-w46:vivant', '2026-w45:vivant', '2026-w44:conservé']);
  });

  // L'INCIDENT évité : sans bilan mis de côté, l'effacement d'une semaine
  // (48 h après sa fin) emportait aussi ses statistiques.
  it('garde le bilan d’une semaine que le nettoyage efface', async () => {
    const ancienne = '2026-w10';
    mkdirSync(TEST_UPLOADS_DIR, { recursive: true });
    writeFileSync(join(TEST_UPLOADS_DIR, 'w10.mp4'), 'x');
    addUpload(ancienne, 'cm', { id: 'w10', name: 'w10.mp4', filename: 'w10.mp4', type: 'video', size: '12.0 MB', uploadedAt: '2026-03-05T10:00:00Z' });
    await cleanupExpiredUploads(null, TEST_UPLOADS_DIR);
    expect(getWeekUploads(ancienne)).toEqual({});
    expect(existsSync(join(TEST_UPLOADS_DIR, 'w10.mp4'))).toBe(false);
    const conserve = bilansDesSemaines(52).find((b) => b.weekId === ancienne);
    expect(conserve.pays.cm).toMatchObject({ fichiers: 1, octets: octetsDe('12.0 MB') });
  });

  it('ne garde pas plus de vingt-six semaines', async () => {
    for (let i = 1; i <= 30; i += 1) {
      addUpload(`2024-w${String(i).padStart(2, '0')}`, 'sn', { id: `x${i}`, name: 'a', filename: `a${i}`, type: 'video' });
    }
    // Toutes expirées : le nettoyage les efface, et met chaque bilan de côté.
    await cleanupExpiredUploads(null, TEST_UPLOADS_DIR);
    const ids = bilansDesSemaines(100).map((b) => b.weekId);
    expect(ids).toContain('2024-w30');
    expect(ids).not.toContain('2024-w01');
    expect(ids.length).toBeLessThanOrEqual(26 + 2);
    expect(archiverBilan('2024-w01')).toBeNull();
  });
});

describe('les vues du JT, pays par pays — anonymes', () => {
  const JT = 'a0a0a0a0-0000-4000-8000-0000000000aa';
  beforeAll(() => {
    addDelivery(SEMAINE, { id: JT, name: 'JT.mp4', filename: 'jt-vues.mp4', type: 'video', uploadedAt: new Date().toISOString() });
  });

  it('compte une lecture et un téléchargement par pays', async () => {
    expect((await request(app).post(`/api/deliveries/${SEMAINE}/${JT}/vue`).send({ countryId: 'cm', type: 'lecture' })).status).toBe(204);
    await request(app).post(`/api/deliveries/${SEMAINE}/${JT}/vue`).send({ countryId: 'cm', type: 'telechargement' });
    await request(app).post(`/api/deliveries/${SEMAINE}/${JT}/vue`).send({ countryId: 'sn' });
    // Un pays inventé n'ouvre pas de case : il compte comme « inconnu ».
    await request(app).post(`/api/deliveries/${SEMAINE}/${JT}/vue`).send({ countryId: '<script>' });
    const liste = (await request(app).get(`/api/deliveries/${SEMAINE}`)).body;
    expect(liste.find((d) => d.id === JT).vues).toEqual({
      cm: { lectures: 1, telechargements: 1 },
      sn: { lectures: 1, telechargements: 0 },
      inconnu: { lectures: 1, telechargements: 0 },
    });
  });

  it('refuse un JT qui n’existe pas', async () => {
    const res = await request(app).post(`/api/deliveries/${SEMAINE}/b0b0b0b0-0000-4000-8000-0000000000bb/vue`).send({ countryId: 'cm' });
    expect(res.status).toBe(404);
  });

  it('remonte dans les statistiques de la semaine', async () => {
    const res = await request(app).get('/api/delays/stats');
    expect(res.status).toBe(200);
    const semaine = res.body.semaines.find((b) => b.weekId === SEMAINE);
    expect(semaine.pays.cm.vues).toBeGreaterThanOrEqual(1);
    expect(res.body.paysAttendus).toContain('cm');
    expect(res.body.paysAttendus).not.toContain('mj');
  });
});
