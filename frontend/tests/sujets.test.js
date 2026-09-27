import { describe, it, expect } from 'vitest';
import { buildSections, filesForSection, etatNombreReportages, estSectionFixe } from '../src/lib/sujets.js';

const EXTRAS = [{ id: 'annonces', sujetId: null, name: 'Annonces', badge: 'A', isFirst: false }];

describe('sections du correspondant', () => {
  it('construit une section par sujet, avec son titre', () => {
    const sections = buildSections(
      [{ id: 's1', titre: 'Marché de Kermel', etat: 'recu' }, { id: 's2', titre: 'Rentrée à Pikine', etat: 'attendu' }],
      [],
      { extras: EXTRAS }
    );
    expect(sections.map((s) => s.name)).toEqual(['Marché de Kermel', 'Rentrée à Pikine', 'Annonces']);
    expect(sections[0].sujetId).toBe('s1');
    expect(sections[0].isFirst).toBe(true);
  });

  it('retombe sur les sections numérotées quand aucun sujet n\'existe', () => {
    // Première visite, migration pas encore passée, ou API injoignable :
    // l'écran doit rester utilisable.
    const sections = buildSections([], [{ reportage: 'Reportage 3' }], {
      reportageName: (i) => `Reportage ${i}`,
    });
    expect(sections.map((s) => s.name)).toEqual(['Reportage 1', 'Reportage 2', 'Reportage 3']);
    expect(sections.every((s) => s.sujetId === null)).toBe(true);
  });

  it('montre toujours au moins une section', () => {
    expect(buildSections([], [])).toHaveLength(1);
    expect(buildSections(null, null)).toHaveLength(1);
  });
});

describe('rattachement des fichiers', () => {
  const files = [
    { id: 'a', sujetId: 's1' },
    { id: 'b', sujetId: 's2' },
    { id: 'c', reportage: 'Annonces' },
    { id: 'd' },
  ];

  it('rattache par sujet, pas par égalité de chaîne', () => {
    const s1 = { id: 's1', sujetId: 's1', name: 'Peu importe le titre', isFirst: true };
    expect(filesForSection(files, s1).map((f) => f.id)).toEqual(['a']);
  });

  it('sert les rubriques fixes par leur étiquette', () => {
    const annonces = { id: 'annonces', sujetId: null, name: 'Annonces', isFirst: false };
    expect(filesForSection(files, annonces).map((f) => f.id)).toEqual(['c']);
  });

  it('rassemble les envois sans rattachement dans la première section', () => {
    const premiere = { id: 'r0', sujetId: null, name: 'Reportage 1', isFirst: true };
    expect(filesForSection(files, premiere).map((f) => f.id)).toEqual(['d']);
  });

  it('ne casse pas sur des entrées vides', () => {
    expect(filesForSection(null, { sujetId: 's1' })).toEqual([]);
    expect(filesForSection(files, null)).toEqual([]);
  });
});

describe('le nombre de reportages', () => {
  // Ce que la carte « Combien de reportages envoyez-vous cette semaine ? »
  // affiche, et le plancher sous lequel on perdrait des fichiers.

  it('ne décide rien tant que rien n’est choisi ni déposé', () => {
    expect(etatNombreReportages([], [])).toEqual({ nommes: false, actuel: 0, minimum: 1 });
  });

  it('ne compte pas les sections fixes comme un reportage', () => {
    // Une annonce déposée ne vaut pas choix d'un reportage.
    const etat = etatNombreReportages([], [{ id: 'a', reportage: 'Annonces' }]);
    expect(etat.actuel).toBe(0);
  });

  it('compte les sections de repli qui portent déjà des fichiers', () => {
    // Elles sont à l'écran : le chiffre retenu doit le dire.
    const etat = etatNombreReportages([], [{ id: 'x', reportage: 'Reportage 2' }]);
    expect(etat).toEqual({ nommes: false, actuel: 2, minimum: 2 });
  });

  it('suit les reportages nommés', () => {
    const etat = etatNombreReportages([{ id: 'a' }, { id: 'b' }, { id: 'c' }], []);
    expect(etat).toEqual({ nommes: true, actuel: 3, minimum: 1 });
  });

  it('ne descend pas sous le dernier reportage qui contient des fichiers', () => {
    // Le serveur le refuse (409) ; ici on ne le propose pas.
    const sujets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(etatNombreReportages(sujets, [{ sujetId: 'a' }]).minimum).toBe(1);
    expect(etatNombreReportages(sujets, [{ sujetId: 'c' }]).minimum).toBe(3);
  });

  it('reconnaît une section fixe', () => {
    expect(estSectionFixe({ reportage: 'Séminaires de la semaine' })).toBe(true);
    expect(estSectionFixe({ reportage: 'Reportage 1' })).toBe(false);
  });
});
