import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Le récapitulatif du dimanche 10h30.
 *
 * L'équipe montage devait aller vérifier elle-même, pays par pays, ce qui
 * était arrivé. Le bilan part désormais tout seul à la clôture.
 */

const envoyes = [];

vi.mock('../src/routes/webpush.js', () => ({
  AUDIENCES: { EDITOR: 'editor', REPORTER: 'reporter', UNKNOWN: 'unknown' },
  broadcastNotification: vi.fn(async (payload, filtre) => {
    envoyes.push({ payload, filtre });
  }),
}));

let envoisParSemaine = {};
let marqueurs = new Set();

vi.mock('../src/data/store.js', () => ({
  getWeekUploads: (weekId) => envoisParSemaine[weekId] || {},
  getCustomCountries: () => [],
  wasReminderSent: (weekId, cle) => marqueurs.has(`${weekId}:${cle}`),
  markReminderSent: (weekId, cle) => marqueurs.add(`${weekId}:${cle}`),
}));

const { runRecapPass, bilanSemaine, texteBilan } = await import('../src/services/recapCloture.js');
const { buildWeeks, weekUploadCutoff } = await import('../src/data/constants.js');

function semaineActive(now = new Date()) {
  return buildWeeks(now).find((w) => w.status === 'active');
}

/** Un instant situé `minutes` après la clôture de la semaine active. */
function apresCloture(minutes) {
  const semaine = semaineActive();
  const cloture = weekUploadCutoff(semaine.id);
  return { semaine, quand: new Date(cloture.getTime() + minutes * 60 * 1000) };
}

beforeEach(() => {
  envoyes.length = 0;
  envoisParSemaine = {};
  marqueurs = new Set();
});

describe('quand le bilan part', () => {
  it('ne part pas avant la clôture', async () => {
    const { quand } = apresCloture(-30);
    expect(await runRecapPass(quand)).toBeNull();
    expect(envoyes).toHaveLength(0);
  });

  it('part dans la demi-heure qui suit', async () => {
    const { quand } = apresCloture(5);
    const bilan = await runRecapPass(quand);
    expect(bilan).not.toBeNull();
    expect(envoyes).toHaveLength(1);
    expect(envoyes[0].filtre.audiences).toEqual(['editor']);
  });

  it('ne part plus trois heures après : il n’aiderait plus personne', async () => {
    const { quand } = apresCloture(180);
    expect(await runRecapPass(quand)).toBeNull();
  });

  it('ne part qu’une fois, même après un redémarrage du serveur', async () => {
    const { quand } = apresCloture(5);
    await runRecapPass(quand);
    await runRecapPass(new Date(quand.getTime() + 10 * 60 * 1000));
    expect(envoyes).toHaveLength(1);
  });

  it('réessaie au passage suivant si l’envoi a échoué', async () => {
    const { broadcastNotification } = await import('../src/routes/webpush.js');
    broadcastNotification.mockRejectedValueOnce(new Error('push coupé'));

    const { quand } = apresCloture(2);
    expect(await runRecapPass(quand)).toBeNull();
    // Le marqueur n'a pas été posé : le passage suivant repart.
    expect(await runRecapPass(new Date(quand.getTime() + 10 * 60 * 1000))).not.toBeNull();
  });
});

describe('ce que le bilan dit', () => {
  it('compte les pays prêts, ceux sans vidéo et ceux sans rien', () => {
    const semaine = semaineActive();
    envoisParSemaine[semaine.id] = {
      cm: [{ id: 'a', type: 'video' }],
      sn: [{ id: 'b', type: 'image' }],
      // les autres pays n'ont rien envoyé
    };

    const bilan = bilanSemaine(semaine.id);
    expect(bilan.complets).toEqual(['cm']);
    expect(bilan.sansVideo).toEqual(['sn']);
    expect(bilan.rienRecu.length).toBe(bilan.total - 2);
    expect(bilan.nbFichiers).toBe(2);
  });

  it('tient dans une notification, en nommant les pays à voir', () => {
    const texte = texteBilan({
      total: 7, complets: ['cm', 'ci'], sansVideo: ['sn'], rienRecu: ['tg'], nbFichiers: 4,
    });
    expect(texte).toContain('2/7 pays prêts');
    expect(texte).toContain('SN');
    expect(texte).toContain('TG');
  });

  it('le dit franchement quand tout le monde a envoyé', () => {
    const texte = texteBilan({
      total: 7, complets: ['a', 'b'], sansVideo: [], rienRecu: [], nbFichiers: 9,
    });
    expect(texte).toMatch(/tout le monde a envoyé/i);
  });

  it('n’inclut jamais les tiroirs du journal parmi les pays', () => {
    const semaine = semaineActive();
    envoisParSemaine[semaine.id] = { tj: [{ id: 'x', type: 'audio' }], mj: [{ id: 'y', type: 'video' }] };
    const bilan = bilanSemaine(semaine.id);
    expect(bilan.complets).not.toContain('tj');
    expect(bilan.rienRecu).not.toContain('mj');
  });
});
