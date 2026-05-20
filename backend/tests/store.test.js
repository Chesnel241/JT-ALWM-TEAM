import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';

// On a besoin de pouvoir réimporter le module pour réinitialiser `db`.
// vitest gère cela via vi.resetModules().
import { vi } from 'vitest';

const STORE_PATH = process.env.JT_STORE_PATH;

function freshStore() {
  if (STORE_PATH && existsSync(STORE_PATH)) rmSync(STORE_PATH);
  vi.resetModules();
  return import('../src/data/store.js');
}

afterAll(() => {
  if (STORE_PATH && existsSync(STORE_PATH)) {
    try { rmSync(STORE_PATH); } catch { /* ignore */ }
  }
});

describe('store: addUpload / getCountryUploads', () => {
  it('persists an upload and returns it', async () => {
    const { addUpload, getCountryUploads } = await freshStore();
    const data = { id: 'test-1', name: 'a.mp4', type: 'video' };
    addUpload('w-43', 'sn', data);
    const list = getCountryUploads('w-43', 'sn');
    const found = list.find((u) => u.id === 'test-1');
    expect(found).toBeDefined();
    expect(found.name).toBe('a.mp4');
  });

  it('writes the JSON file atomically (no leftover .tmp)', async () => {
    const { addUpload } = await freshStore();
    addUpload('w-43', 'sn', { id: 'atomic-1', name: 'x.mp4', type: 'video' });
    expect(existsSync(STORE_PATH)).toBe(true);
    expect(existsSync(`${STORE_PATH}.${process.pid}.tmp`)).toBe(false);
  });
});

describe('store: deleteUpload', () => {
  it('removes an existing upload', async () => {
    const { addUpload, deleteUpload, getCountryUploads } = await freshStore();
    addUpload('w-43', 'sn', { id: 'todel', name: 'z.mp4', type: 'video' });
    const removed = deleteUpload('w-43', 'sn', 'todel');
    expect(removed).toBeTruthy();
    const after = getCountryUploads('w-43', 'sn');
    expect(after.find((u) => u.id === 'todel')).toBeUndefined();
  });

  it('returns false when the upload does not exist', async () => {
    const { deleteUpload } = await freshStore();
    const removed = deleteUpload('w-43', 'sn', 'nonexistent');
    expect(removed).toBe(false);
  });
});

describe('store: recovery from corrupted JSON', () => {
  it('falls back to empty seed if store.json is unreadable', async () => {
    writeFileSync(STORE_PATH, '{ not valid json');
    vi.resetModules();
    const { getWeekUploads, getCustomCountries } = await import('../src/data/store.js');
    // Pas de crash, l'API store reste utilisable
    expect(getWeekUploads('w-43')).toEqual({});
    expect(getCustomCountries()).toEqual([]);
  });
});
