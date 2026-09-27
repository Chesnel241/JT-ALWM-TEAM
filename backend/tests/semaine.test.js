import { describe, it, expect } from 'vitest';
import { semaineActive, semaineOuverte, semaineSuivante } from './semaine.js';

/**
 * La semaine sur laquelle les tests d'envoi travaillent.
 *
 * L'INCIDENT : le dimanche 27 septembre 2026 à 16:39 UTC, `tus-formats` et
 * `portee-acces` échouaient sur 17 tests — 423 au lieu de 201 — sans qu'une
 * ligne de code ait changé. La semaine active clôt ses envois le dimanche à
 * 10h30 (GMT+2) mais ne bascule que le lundi à 00:00 (GMT+2) : pendant treize
 * heures et demie chaque semaine, elle est active et déjà close.
 *
 * L'aide prend l'instant en argument : on la vérifie donc à des moments
 * fixés, sans dépendre du jour où la suite tourne.
 */

// Semaine ISO 2026-w39 : du lundi 21 au dimanche 27 septembre 2026.
const MERCREDI = new Date('2026-09-23T12:00:00Z');
// Clôture : dimanche 10h30 GMT+2, soit 08:30 UTC. Bascule de semaine :
// lundi 00:00 GMT+2, soit dimanche 22:00 UTC.
const DIMANCHE_AVANT = new Date('2026-09-27T08:29:00Z');
const DIMANCHE_APRES = new Date('2026-09-27T08:31:00Z');
const DIMANCHE_SOIR = new Date('2026-09-27T21:59:00Z');
const LUNDI_MINUIT = new Date('2026-09-27T22:01:00Z');

describe('la semaine ouverte aux envois', () => {
  it('est la semaine active en cours de semaine', () => {
    expect(semaineOuverte(MERCREDI)).toBe(semaineActive(MERCREDI));
  });

  it('reste la semaine active jusqu’à la clôture du dimanche', () => {
    expect(semaineOuverte(DIMANCHE_AVANT)).toBe(semaineActive(DIMANCHE_AVANT));
  });

  it('passe à la semaine suivante dès la clôture', () => {
    // LE cas de l'incident. Ici la semaine active est encore w39, mais on ne
    // peut plus rien y envoyer.
    expect(semaineActive(DIMANCHE_APRES)).toBe('2026-w39');
    expect(semaineOuverte(DIMANCHE_APRES)).toBe(semaineSuivante(DIMANCHE_APRES));
    expect(semaineOuverte(DIMANCHE_APRES)).not.toBe('2026-w39');
  });

  it('y reste jusqu’au changement de semaine', () => {
    expect(semaineActive(DIMANCHE_SOIR)).toBe('2026-w39');
    expect(semaineOuverte(DIMANCHE_SOIR)).toBe('2026-w40');
  });

  it('redevient la semaine active une fois la semaine changée', () => {
    // Lundi 00:00 en GMT+2 : w40 devient active, et elle est ouverte.
    expect(semaineActive(LUNDI_MINUIT)).toBe('2026-w40');
    expect(semaineOuverte(LUNDI_MINUIT)).toBe('2026-w40');
  });
});
