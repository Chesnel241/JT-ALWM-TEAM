import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fileKey,
  rememberUpload,
  forgetUpload,
  listPendingUploads,
  matchesEntry,
} from '../src/lib/pendingUploads.js';

const FILE = { name: 'reportage.mp4', size: 12345 };

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('envois interrompus', () => {
  it('ne retient rien tant qu\'aucun envoi n\'a démarré', () => {
    expect(listPendingUploads('2026-W34', 'ga')).toEqual([]);
  });

  it('retient un envoi démarré, puis l\'oublie une fois terminé', () => {
    rememberUpload({ weekId: '2026-W34', countryId: 'ga', reportage: 'Reportage 1', file: FILE });
    const pending = listPendingUploads('2026-W34', 'ga');
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe('reportage.mp4');
    expect(pending[0].reportage).toBe('Reportage 1');

    forgetUpload(fileKey(FILE));
    expect(listPendingUploads('2026-W34', 'ga')).toEqual([]);
  });

  it('cloisonne par semaine et par pays', () => {
    rememberUpload({ weekId: '2026-W34', countryId: 'ga', file: FILE });
    expect(listPendingUploads('2026-W35', 'ga')).toEqual([]);
    expect(listPendingUploads('2026-W34', 'ci')).toEqual([]);
  });

  it('ne duplique pas un même fichier relancé', () => {
    rememberUpload({ weekId: '2026-W34', countryId: 'ga', file: FILE });
    rememberUpload({ weekId: '2026-W34', countryId: 'ga', file: FILE });
    expect(listPendingUploads('2026-W34', 'ga')).toHaveLength(1);
  });

  it('oublie un envoi vieux de plus d\'une semaine', () => {
    rememberUpload({ weekId: '2026-W34', countryId: 'ga', file: FILE });
    // Huit jours plus tard : reproposer cet envoi embrouillerait plus qu'il
    // n'aiderait, la semaine de travail a changé.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    expect(listPendingUploads('2026-W34', 'ga')).toEqual([]);
  });

  it('vérifie que le fichier reproposé est bien le bon', () => {
    rememberUpload({ weekId: '2026-W34', countryId: 'ga', file: FILE });
    const [entry] = listPendingUploads('2026-W34', 'ga');
    expect(matchesEntry(entry, FILE)).toBe(true);
    expect(matchesEntry(entry, { name: 'reportage.mp4', size: 999 })).toBe(false);
    expect(matchesEntry(entry, { name: 'autre.mp4', size: 12345 })).toBe(false);
  });

  it('survit à un stockage corrompu', () => {
    localStorage.setItem('pending_uploads_v1', 'ceci-n-est-pas-du-json');
    expect(listPendingUploads('2026-W34', 'ga')).toEqual([]);
    expect(() => rememberUpload({ weekId: '2026-W34', countryId: 'ga', file: FILE })).not.toThrow();
  });
});
