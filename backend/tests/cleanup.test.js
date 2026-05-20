import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { existsSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const STORE_PATH = process.env.JT_STORE_PATH;
const CLEANUP_TMP = join(tmpdir(), `jt-alwm-cleanup-${Date.now()}`);

beforeEach(async () => {
  if (existsSync(STORE_PATH)) rmSync(STORE_PATH);
  if (existsSync(CLEANUP_TMP)) rmSync(CLEANUP_TMP, { recursive: true, force: true });
  mkdirSync(CLEANUP_TMP, { recursive: true });
  vi.resetModules();
});

afterAll(() => {
  if (existsSync(CLEANUP_TMP)) {
    try { rmSync(CLEANUP_TMP, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

async function freshStore() {
  vi.resetModules();
  return import('../src/data/store.js');
}

describe('cleanupExpiredUploads — purge mercredi 00:00', () => {
  it('purge une semaine expirée et ses fichiers physiques', async () => {
    const { addUpload, cleanupExpiredUploads, getWeekUploads } = await freshStore();

    // Crée un fichier physique pour la semaine 2026-w18 (déjà ancienne)
    const filename = 'oldfile.mp4';
    writeFileSync(join(CLEANUP_TMP, filename), 'fake');
    addUpload('2026-w18', 'sn', { id: 'x', name: 'old.mp4', filename, type: 'video' });

    expect(existsSync(join(CLEANUP_TMP, filename))).toBe(true);
    const removed = await cleanupExpiredUploads(null, CLEANUP_TMP);

    expect(removed).toBeGreaterThan(0);
    expect(existsSync(join(CLEANUP_TMP, filename))).toBe(false);
    expect(getWeekUploads('2026-w18')).toEqual({});
  });

  it('ne purge pas une semaine non encore expirée', async () => {
    const { addUpload, cleanupExpiredUploads, getCountryUploads } = await freshStore();

    // Construit un ID de semaine future à coup sûr non expiré.
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const { weekIdFor } = await import('../src/data/constants.js');
    const futureWeek = weekIdFor(future);

    const filename = 'future.mp4';
    writeFileSync(join(CLEANUP_TMP, filename), 'data');
    addUpload(futureWeek, 'sn', { id: 'y', name: 'fut.mp4', filename, type: 'video' });

    await cleanupExpiredUploads(null, CLEANUP_TMP);

    expect(existsSync(join(CLEANUP_TMP, filename))).toBe(true);
    expect(getCountryUploads(futureWeek, 'sn')).toHaveLength(1);
  });

  it('ignore les IDs legacy (w-43) — ils restent sans crasher', async () => {
    const { addUpload, cleanupExpiredUploads, getCountryUploads } = await freshStore();
    addUpload('w-43', 'sn', { id: 'l', name: 'legacy.mp4', filename: 'legacy.mp4', type: 'video' });
    writeFileSync(join(CLEANUP_TMP, 'legacy.mp4'), 'old');

    await cleanupExpiredUploads(null, CLEANUP_TMP);

    // Le fichier physique est nettoyé comme orphelin (il est dans la DB
    // sous w-43 mais l'algorithme ne reconnaît pas ce format). En fait
    // si: on l'a référencé. Donc il reste.
    expect(getCountryUploads('w-43', 'sn')).toHaveLength(1);
  });

  it('ne touche pas à la clé _countries', async () => {
    const { addCustomCountry, cleanupExpiredUploads, getCustomCountries } = await freshStore();
    addCustomCountry({ id: 'bj', name: 'Bénin', code: 'BJ' });
    await cleanupExpiredUploads(null, CLEANUP_TMP);
    expect(getCustomCountries()).toHaveLength(1);
  });

  it('purge les fichiers orphelins (sur disque mais pas en DB)', async () => {
    const { cleanupExpiredUploads } = await freshStore();
    const orphan = join(CLEANUP_TMP, 'orphan.mp4');
    writeFileSync(orphan, 'unknown');
    await cleanupExpiredUploads(null, CLEANUP_TMP);
    expect(existsSync(orphan)).toBe(false);
  });
});
