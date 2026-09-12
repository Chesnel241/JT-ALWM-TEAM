import { describe, it, expect, beforeEach, vi } from 'vitest';

const sent = [];

vi.mock('../src/routes/webpush.js', () => ({
  AUDIENCES: { EDITOR: 'editor', REPORTER: 'reporter', UNKNOWN: 'unknown' },
  broadcastNotification: vi.fn(async (payload, filter) => {
    sent.push({ payload, filter });
  }),
}));

let uploadsByWeek = {};
let reminders = new Set();

vi.mock('../src/data/store.js', () => ({
  getWeekUploads: (weekId) => uploadsByWeek[weekId] || {},
  getCustomCountries: () => [],
  wasReminderSent: (weekId, countryId) => reminders.has(`${weekId}:${countryId}`),
  markReminderSent: (weekId, countryId) => reminders.add(`${weekId}:${countryId}`),
}));

const { runReminderPass } = await import('../src/services/deadlineReminders.js');
const { buildWeeks, weekUploadCutoff } = await import('../src/data/constants.js');

// Un instant situé 22 h avant la clôture de la semaine active.
function dayBefore(now = new Date()) {
  const week = buildWeeks(now).find((w) => w.status === 'active');
  const cutoff = weekUploadCutoff(week.id);
  return { week, when: new Date(cutoff.getTime() - 22 * 60 * 60 * 1000) };
}

beforeEach(() => {
  sent.length = 0;
  uploadsByWeek = {};
  reminders = new Set();
});

describe('rappel d\'échéance', () => {
  it('ne prévient personne loin de la clôture', async () => {
    const { week } = dayBefore();
    const cutoff = weekUploadCutoff(week.id);
    const notified = await runReminderPass(new Date(cutoff.getTime() - 5 * 24 * 60 * 60 * 1000));
    expect(notified).toEqual([]);
    expect(sent).toHaveLength(0);
  });

  it('ne prévient plus une fois la clôture passée', async () => {
    const { week } = dayBefore();
    const cutoff = weekUploadCutoff(week.id);
    const notified = await runReminderPass(new Date(cutoff.getTime() + 60 * 1000));
    expect(notified).toEqual([]);
  });

  it('prévient la veille les pays au chutier vide', async () => {
    const { when } = dayBefore();
    const notified = await runReminderPass(when);
    expect(notified.length).toBeGreaterThan(0);
    // Chaque envoi vise un seul pays, jamais tout le monde.
    for (const entry of sent) {
      expect(entry.filter.audiences).toEqual(['reporter']);
      expect(entry.filter.countryId).toBeTruthy();
      expect(entry.payload.url).toBe(`/journalistes/${entry.filter.countryId}`);
    }
  });

  it('laisse tranquille un pays qui a envoyé sa vidéo', async () => {
    const { week, when } = dayBefore();
    uploadsByWeek[week.id] = { cm: [{ id: 'f1', type: 'video' }] };
    const notified = await runReminderPass(when);
    expect(notified).not.toContain('cm');
  });

  it('relance quand même un pays qui a envoyé sans aucune vidéo', async () => {
    // Le rappel ne visait que les chutiers COMPLÈTEMENT vides. Un pays ayant
    // déposé une photo ou un script sans vidéo passait pour servi et n'était
    // jamais relancé — alors qu'aucun de ces envois ne se monte.
    const { week, when } = dayBefore();
    uploadsByWeek[week.id] = {
      cm: [{ id: 'f1', type: 'image' }, { id: 'f2', type: 'script' }],
    };
    const notified = await runReminderPass(when);
    expect(notified).toContain('cm');
  });

  it('dit ce qui manque vraiment, plutôt qu’un message unique', async () => {
    // « Rien reçu » et « reçu mais pas de vidéo » n'appellent pas le même
    // geste du correspondant.
    const { week, when } = dayBefore();
    uploadsByWeek[week.id] = { cm: [{ id: 'f1', type: 'image' }] };
    await runReminderPass(when);

    const cameroun = sent.find((e) => e.filter.countryId === 'cm');
    expect(cameroun.payload.body).toMatch(/aucune vidéo/i);

    const autre = sent.find((e) => e.filter.countryId === 'sn');
    expect(autre.payload.body).not.toMatch(/aucune vidéo/i);
    expect(autre.payload.body).toMatch(/moins de 24 h/i);
  });

  it('annonce toujours l’heure de clôture en vigueur', async () => {
    // Le message portait l'heure en dur : elle a déjà été fausse une fois,
    // après le passage de 17h30 à 10h30.
    const { when } = dayBefore();
    await runReminderPass(when);
    expect(sent[0].payload.body).toContain('dimanche 10h30 (GMT+2)');
  });

  it('n\'inclut jamais les rubriques de montage', async () => {
    const { when } = dayBefore();
    const notified = await runReminderPass(when);
    expect(notified).not.toContain('tj');
    expect(notified).not.toContain('mj');
  });

  it('ne prévient qu\'une fois, même après un redémarrage', async () => {
    const { when } = dayBefore();
    const first = await runReminderPass(when);
    expect(first.length).toBeGreaterThan(0);
    sent.length = 0;
    const second = await runReminderPass(when);
    expect(second).toEqual([]);
    expect(sent).toHaveLength(0);
  });
});
