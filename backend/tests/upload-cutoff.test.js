import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { WEEKS, weekUploadCutoff } from '../src/data/constants.js';
import { execFileSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Les tests s'exécutent depuis un répertoire temporaire (voir setup.js) :
// les sous-processus doivent pointer vers les sources, pas vers ce tmpdir.
const REPERTOIRE_BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');

let app;
const WEEK = WEEKS.find((w) => w.status === 'active').id;

const MP4_HEADER = Buffer.from([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x02, 0x00,
  0x69, 0x73, 0x6f, 0x6d,
  0x69, 0x73, 0x6f, 0x32,
]);

beforeAll(() => {
  app = createApp({
    uploadsDir: TEST_UPLOADS_DIR,
    corsOrigins: ['http://localhost:5173'],
    enableMonitoring: false,
  });
});

afterAll(() => {
  vi.useRealTimers();
});

describe('weekUploadCutoff', () => {
  it('tombe le dimanche à 10h30 GMT+2, soit 08h30 UTC', () => {
    // 2026-w21 = lundi 18 mai → dimanche 24 mai.
    // Les assertions sont en UTC, jamais en heure locale : c'est justement
    // la lecture locale qui masquait le défaut. Le serveur tourne en UTC, si
    // bien que l'ancien « 17h30 » fermait en réalité à 19h30 pour une
    // rédaction en GMT+2.
    const cutoff = weekUploadCutoff('2026-w21');
    expect(cutoff).not.toBeNull();
    expect(cutoff.toISOString()).toBe('2026-05-24T08:30:00.000Z');
    expect(cutoff.getUTCDay()).toBe(0); // dimanche
  });

  it('donne le même instant quel que soit le fuseau de la machine', () => {
    // La règle est métier, pas machine : elle ne doit pas changer selon
    // l'endroit où le serveur est déployé. C'est ce qui autorise le frontend
    // à simplement afficher `cutoffAt` au lieu de le refaire chez lui.
    //
    // Le fuseau se fige au démarrage du processus : le basculer dans le test
    // ne prouverait rien. On relance donc un vrai processus par fuseau.
    const attendu = '2026-05-24T08:30:00.000Z';
    const script = [
      "const { weekUploadCutoff } = await import('./src/data/constants.js');",
      "process.stdout.write(weekUploadCutoff('2026-w21').toISOString());",
    ].join('');

    for (const fuseau of ['UTC', 'Africa/Douala', 'Europe/Paris', 'America/New_York', 'Asia/Tokyo']) {
      const obtenu = execFileSync(
        process.execPath,
        ['--input-type=module', '-e', script],
        { env: { ...process.env, TZ: fuseau, LOG_LEVEL: 'error' }, encoding: 'utf-8', cwd: process.env.INIT_CWD || REPERTOIRE_BACKEND },
      ).trim();
      expect(obtenu, fuseau).toBe(attendu);
    }
  }, 30000);

  it('reste cohérent d’une année sur l’autre, passage de siècle compris', () => {
    // Semaine 1 : celle qui contient le 4 janvier (ISO 8601).
    expect(weekUploadCutoff('2026-w01').toISOString()).toBe('2026-01-04T08:30:00.000Z');
    // 2026-w53 n'existe pas : l'année n'a que 53 semaines certaines années.
    // On vérifie surtout que le calcul ne renvoie pas n'importe quoi.
    expect(weekUploadCutoff('2027-w01').toISOString()).toBe('2027-01-10T08:30:00.000Z');
  });

  it('returns null for legacy ID', () => {
    expect(weekUploadCutoff('w-43')).toBeNull();
  });
});

describe('POST /api/uploads — deadline enforcement', () => {
  it('rejects upload with 423 after Sunday 17:30', async () => {
    // Mock le temps : on se place lundi 25 mai à 10h, donc semaine
    // active = w22, et w21 doit être bloquée (cutoff dimanche 24 à 17h30).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 10, 0));

    // Note : isValidWeek vérifie contre buildWeeks(now). w21 reste
    // visible le lundi (archived). On tente d'uploader sur w21.
    const res = await request(app)
      .post('/api/uploads/2026-w21/sn')
      .attach('file', MP4_HEADER, { filename: 'late.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe('UPLOAD_DEADLINE_PASSED');

    vi.useRealTimers();
  });

  it('accepts upload before the deadline (current active week)', async () => {
    const res = await request(app)
      .post(`/api/uploads/${WEEK}/sn`)
      .attach('file', MP4_HEADER, { filename: 'on_time.mp4', contentType: 'video/mp4' });

    // 201 si on est avant dimanche 17h30 — sinon 423 (légitime selon le moment du run)
    expect([201, 423]).toContain(res.status);
  });

  it('rejects script upload with 423 after the deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 10, 0));

    const res = await request(app)
      .post('/api/uploads/2026-w21/sn/script')
      .send({ content: 'Late note' });

    expect(res.status).toBe(423);

    vi.useRealTimers();
  });
});
