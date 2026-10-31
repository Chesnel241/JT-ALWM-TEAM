import { describe, it, expect } from 'vitest';
import { etapesParcours } from '../src/lib/parcours.js';

/**
 * La semaine d'un correspondant, en trois étapes reliées.
 *
 * LE BESOIN : rien ne disait au correspondant où il en était. Le parcours
 * (ses fichiers → sa voix off → le JT) se lit d'un coup d'œil ; ces tests
 * fixent ce que chaque étape affiche selon ce que le serveur a reçu.
 */

const video = (statut = 'pending') => ({ id: Math.random(), name: 'rush.mp4', type: 'video', status: statut });
const voix = () => ({ id: Math.random(), name: 'Sujet - Voix (Studio).mp3', type: 'audio', status: 'pending' });

describe('etapesParcours', () => {
  it('une semaine vide : les fichiers sont à faire, et c’est à vous', () => {
    const { etapes, aVous, remplissage } = etapesParcours();
    expect(etapes.map((e) => e.etat)).toEqual(['aFaire', 'facultatif', 'enAttente']);
    expect(aVous).toBe('reportage');
    expect(remplissage).toBe(0);
  });

  it('des fichiers envoyés : l’étape est faite, le trait avance de moitié', () => {
    const { etapes, aVous, remplissage } = etapesParcours({ fichiers: [video(), video()] });
    expect(etapes[0]).toEqual({ cle: 'reportage', etat: 'fait', nombre: 2 });
    expect(aVous).toBeNull();
    expect(remplissage).toBe(0.5);
  });

  it('une voix off posée ne compte pas comme un fichier de reportage', () => {
    const { etapes } = etapesParcours({ fichiers: [voix()] });
    expect(etapes[0].etat).toBe('aFaire');
    expect(etapes[1]).toEqual({ cle: 'voixOff', etat: 'fait', nombre: 1 });
  });

  it('un fichier refusé passe l’étape « à corriger », et c’est à vous', () => {
    const { etapes, aVous, remplissage } = etapesParcours({ fichiers: [video('approved'), video('rejected')] });
    expect(etapes[0]).toEqual({ cle: 'reportage', etat: 'aCorriger', nombre: 1 });
    expect(aVous).toBe('reportage');
    expect(remplissage).toBe(0);
  });

  it('le JT publié : prêt à télécharger, le trait est plein', () => {
    const { etapes, remplissage } = etapesParcours({ fichiers: [video()], livraisons: [{ id: 'jt' }] });
    expect(etapes[2].etat).toBe('pret');
    expect(remplissage).toBe(1);
  });

  it('ignore les entrées vides', () => {
    expect(etapesParcours({ fichiers: [null, undefined], livraisons: null }).etapes[0].etat).toBe('aFaire');
  });
});
