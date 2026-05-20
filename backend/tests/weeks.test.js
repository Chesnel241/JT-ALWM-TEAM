import { describe, it, expect } from 'vitest';
import { buildWeeks } from '../src/data/constants.js';

describe('buildWeeks', () => {
  it('produces past + active + future weeks in order', () => {
    const now = new Date('2026-05-20T10:00:00Z'); // mercredi
    const weeks = buildWeeks(now, { past: 4, future: 2 });
    expect(weeks).toHaveLength(7);

    const statuses = weeks.map((w) => w.status);
    expect(statuses.slice(0, 4).every((s) => s === 'archived')).toBe(true);
    expect(statuses[4]).toBe('active');
    expect(statuses.slice(5).every((s) => s === 'upcoming')).toBe(true);
  });

  it('places the current week as active', () => {
    const now = new Date('2026-05-20T10:00:00Z');
    const weeks = buildWeeks(now);
    const active = weeks.find((w) => w.status === 'active');
    expect(active).toBeDefined();
    const start = new Date(active.startDate);
    const end = new Date(active.endDate);
    expect(now >= start && now <= end).toBe(true);
  });

  it('uses Monday as week start (ISO 8601)', () => {
    const sunday = new Date('2026-05-24T12:00:00Z');
    const weeks = buildWeeks(sunday);
    const active = weeks.find((w) => w.status === 'active');
    expect(new Date(active.startDate).getDay()).toBe(1); // 1 = Monday
  });

  it('generates stable week IDs in format YYYY-wWW', () => {
    const now = new Date('2026-05-20T10:00:00Z');
    const weeks = buildWeeks(now);
    weeks.forEach((w) => {
      expect(w.id).toMatch(/^\d{4}-w\d{2}$/);
    });
  });

  it('returns unique IDs', () => {
    const weeks = buildWeeks(new Date('2026-05-20'), { past: 10, future: 10 });
    const ids = weeks.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('handles year transitions (week 1 of next year)', () => {
    const dec30 = new Date('2026-12-30T10:00:00Z');
    const weeks = buildWeeks(dec30, { past: 0, future: 2 });
    expect(weeks).toHaveLength(3);
    // Au moins une semaine doit être étiquetée 2027
    expect(weeks.some((w) => w.id.startsWith('2027-'))).toBe(true);
  });

  it('respects past/future overrides', () => {
    const weeks = buildWeeks(new Date('2026-05-20'), { past: 1, future: 1 });
    expect(weeks).toHaveLength(3);
    expect(weeks.map((w) => w.status)).toEqual(['archived', 'active', 'upcoming']);
  });
});
