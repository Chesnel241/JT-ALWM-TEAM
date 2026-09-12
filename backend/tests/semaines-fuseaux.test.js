import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildWeeks } from '../src/data/constants.js';

/**
 * La semaine active est une règle de rédaction, pas une règle de machine.
 *
 * Elle se calculait avec `getDay()` / `setHours()`, donc dans le fuseau du
 * serveur : déployé en UTC, celui-ci faisait basculer la semaine le dimanche
 * à 22h heure de Libreville — deux heures pendant lesquelles un correspondant
 * envoyait ses rushes dans la semaine suivante sans le savoir. C'est le
 * défaut déjà corrigé sur la clôture ; il est ici corrigé de la même façon,
 * en ancrant tout sur `CLOTURE.offsetUTC`.
 */

// Les tests s'exécutent depuis un répertoire temporaire (voir setup.js) :
// les sous-processus doivent pointer vers les sources, pas vers ce tmpdir.
const REPERTOIRE_BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');

const FUSEAUX = ['UTC', 'Africa/Douala', 'Europe/Paris', 'America/New_York', 'Asia/Tokyo'];

// Deux instants choisis pour tomber un jour différent selon l'endroit où on
// les lit : mardi 23h30 à Libreville (déjà mercredi à Tokyo) et lundi 00h30
// à Libreville (encore dimanche en UTC).
const INSTANTS = ['2026-05-19T21:30:00.000Z', '2026-05-24T22:30:00.000Z'];

function semainesSousFuseau(fuseau) {
  const script = [
    "const { buildWeeks } = await import('./src/data/constants.js');",
    `const instants = ${JSON.stringify(INSTANTS)};`,
    'const vues = instants.map((i) => buildWeeks(new Date(i)).map((s) => ({',
    '  id: s.id, status: s.status, name: s.name, dates: s.dates,',
    '  startDate: s.startDate, endDate: s.endDate,',
    '  cutoffAt: s.cutoffAt, expiresAt: s.expiresAt,',
    '})));',
    'process.stdout.write(JSON.stringify(vues));',
  ].join('');

  return execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { env: { ...process.env, TZ: fuseau, LOG_LEVEL: 'error' }, encoding: 'utf-8', cwd: REPERTOIRE_BACKEND },
  ).trim();
}

describe('buildWeeks — ancrée sur le fuseau de la rédaction', () => {
  it('rend exactement les mêmes semaines quel que soit le fuseau de la machine', () => {
    // Le fuseau se fige au démarrage du processus : le basculer dans le test
    // ne prouverait rien. On relance donc un vrai processus par fuseau.
    const reference = semainesSousFuseau('UTC');
    for (const fuseau of FUSEAUX) {
      expect(semainesSousFuseau(fuseau), fuseau).toBe(reference);
    }
  }, 60000);

  it('la semaine commence lundi 00h00 à Libreville, pas à minuit UTC', () => {
    // Dimanche 23h59 là-bas : la semaine 21 est encore la bonne.
    const dimancheTard = buildWeeks(new Date('2026-05-24T21:59:59.000Z'));
    expect(dimancheTard.find((s) => s.status === 'active').id).toBe('2026-w21');

    // Une seconde plus tard, il est lundi à Libreville : on bascule.
    const lundiZero = buildWeeks(new Date('2026-05-24T22:00:00.000Z'));
    expect(lundiZero.find((s) => s.status === 'active').id).toBe('2026-w22');
  });

  it('borne la semaine sur les instants réels du lundi et du dimanche locaux', () => {
    const semaine = buildWeeks(new Date('2026-05-20T12:00:00.000Z')).find((s) => s.id === '2026-w21');
    expect(semaine.startDate).toBe('2026-05-17T22:00:00.000Z'); // lundi 00:00 GMT+2
    expect(semaine.endDate).toBe('2026-05-24T21:59:59.999Z');   // dimanche 23:59:59.999 GMT+2
    // Les jours annoncés sont ceux du calendrier de la rédaction.
    expect(semaine.dates).toBe('18 mai - 24 mai');
  });

  it('fait disparaître la semaine précédente le mercredi de la rédaction', () => {
    // Mardi 23h59 à Libreville : elle est encore là pour rattraper un rush.
    expect(buildWeeks(new Date('2026-05-19T21:59:00.000Z'))).toHaveLength(3);
    // Mercredi 00h01 à Libreville : elle est partie.
    expect(buildWeeks(new Date('2026-05-19T22:01:00.000Z'))).toHaveLength(2);
  });
});
