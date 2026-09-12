import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  lireBrouillon,
  ecrireBrouillon,
  effacerBrouillon,
  purgerBrouillons,
  cleRubrique,
} from '../src/lib/brouillon.js';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('brouillon local d’un texte long', () => {
  it('rend ce qui a été gardé', () => {
    const cle = cleRubrique('2026-w37', 'conducteur');
    expect(ecrireBrouillon(cle, { texte: 'Ouverture sur Douala' })).toBe(true);
    expect(lireBrouillon(cle).valeurs).toEqual({ texte: 'Ouverture sur Douala' });
  });

  it('rend null quand il n’y a rien', () => {
    expect(lireBrouillon(cleRubrique('2026-w37', 'conducteur'))).toBeNull();
  });

  it('sépare les semaines et les rubriques', () => {
    // Le conducteur de la semaine passée ne doit jamais ressortir dans celui
    // de la semaine en cours.
    ecrireBrouillon(cleRubrique('2026-w37', 'conducteur'), { texte: 'semaine 37' });
    ecrireBrouillon(cleRubrique('2026-w38', 'conducteur'), { texte: 'semaine 38' });
    ecrireBrouillon(cleRubrique('2026-w37', 'motDuJt'), { orateur: 'Nom' });

    expect(lireBrouillon(cleRubrique('2026-w37', 'conducteur')).valeurs.texte).toBe('semaine 37');
    expect(lireBrouillon(cleRubrique('2026-w38', 'conducteur')).valeurs.texte).toBe('semaine 38');
    expect(lireBrouillon(cleRubrique('2026-w37', 'motDuJt')).valeurs.orateur).toBe('Nom');
  });

  it('s’efface quand on le demande', () => {
    const cle = cleRubrique('2026-w37', 'conducteur');
    ecrireBrouillon(cle, { texte: 'à jeter' });
    effacerBrouillon(cle);
    expect(lireBrouillon(cle)).toBeNull();
  });

  it('oublie un brouillon de plus de sept jours', () => {
    const cle = cleRubrique('2026-w37', 'conducteur');
    ecrireBrouillon(cle, { texte: 'vieux texte' });

    // Un brouillon qui parle d'une semaine passée ressortirait au mauvais
    // moment, sur un écran où quelqu'un écrit celle d'aujourd'hui.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    expect(lireBrouillon(cle)).toBeNull();
  });
});

describe('robustesse du stockage', () => {
  it('ne lève pas quand le navigateur refuse d’écrire', () => {
    // Navigation privée, quota plein, réglage d'entreprise : l'écran doit
    // continuer de fonctionner, sans brouillon.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(ecrireBrouillon('rubrique:x:y', { texte: 'a' })).toBe(false);
  });

  it('ne lève pas quand le navigateur refuse de lire', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(lireBrouillon('rubrique:x:y')).toBeNull();
  });

  it('ignore une entrée corrompue plutôt que de planter la saisie', () => {
    localStorage.setItem('jt-brouillon:rubrique:x:y', 'ceci n’est pas du JSON');
    expect(lireBrouillon('rubrique:x:y')).toBeNull();
  });

  it('refuse une clé ou des valeurs absentes', () => {
    expect(ecrireBrouillon('', { texte: 'a' })).toBe(false);
    expect(ecrireBrouillon('cle', null)).toBe(false);
    expect(lireBrouillon('')).toBeNull();
  });
});

describe('purge des brouillons périmés', () => {
  it('retire les périmés et les illisibles, garde les récents', () => {
    ecrireBrouillon('rubrique:recent', { texte: 'à garder' });
    localStorage.setItem('jt-brouillon:vieux', JSON.stringify({
      valeurs: { texte: 'à jeter' },
      le: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    localStorage.setItem('jt-brouillon:casse', '{{{');
    localStorage.setItem('autre-chose', 'à ne pas toucher');

    expect(purgerBrouillons()).toBe(2);
    expect(lireBrouillon('rubrique:recent')).not.toBeNull();
    expect(localStorage.getItem('jt-brouillon:vieux')).toBeNull();
    expect(localStorage.getItem('jt-brouillon:casse')).toBeNull();
    expect(localStorage.getItem('autre-chose')).toBe('à ne pas toucher');
  });
});
