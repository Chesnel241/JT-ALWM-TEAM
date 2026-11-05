import { describe, it, expect } from 'vitest';
import {
  etapesEnvoi, positionSurLiaison, estEnVol,
  mesurerDebit, secondesRestantes, dureeRestante, octetsLisibles, SEUIL_CONSEIL_WIFI,
} from '../src/lib/envoi.js';
import { translations } from '../src/i18n/translations.js';

/**
 * Le voyage d'un fichier en trois étapes nommées.
 *
 * LE BESOIN : la barre atteignait 99 % puis ne bougeait plus pendant la
 * compression ; des correspondants croyaient l'envoi bloqué et quittaient la
 * page. Chaque état d'un envoi doit dire laquelle des trois étapes est en
 * cours, et où dessiner le fichier sur la liaison pays → rédaction.
 */

const etats = (envoi) => etapesEnvoi(envoi).map((e) => e.etat);

describe('etapesEnvoi', () => {
  it('pendant l’envoi : la première étape est active', () => {
    expect(etats({ status: 'uploading', phase: 'uploading', progress: 40 })).toEqual(['actif', 'avenir', 'avenir']);
  });

  it('pendant la compression : l’envoi est fait, le traitement actif', () => {
    expect(etats({ status: 'uploading', phase: 'processing', progress: 99 })).toEqual(['fait', 'actif', 'avenir']);
  });

  it('reçu : les trois étapes sont faites', () => {
    expect(etats({ status: 'completed', phase: 'done', progress: 100 })).toEqual(['fait', 'fait', 'fait']);
  });

  it('sans réseau : l’envoi attend, rien n’est perdu', () => {
    expect(etats({ status: 'queued', phase: 'queued', progress: 0 })).toEqual(['attente', 'avenir', 'avenir']);
  });

  it('refusé par le serveur : l’envoi est en erreur', () => {
    expect(etats({ status: 'error', progress: 0 })).toEqual(['erreur', 'avenir', 'avenir']);
  });
});

describe('positionSurLiaison', () => {
  it('suit le pourcentage réel, attend à l’arrivée pendant le traitement', () => {
    expect(positionSurLiaison({ status: 'uploading', phase: 'uploading', progress: 25 })).toBe(0.25);
    expect(positionSurLiaison({ status: 'uploading', phase: 'processing', progress: 99 })).toBe(1);
    expect(positionSurLiaison({ status: 'completed', phase: 'done', progress: 100 })).toBe(1);
  });

  it('reste au départ s’il attend le réseau ou a échoué', () => {
    expect(positionSurLiaison({ status: 'queued', phase: 'queued', progress: 60 })).toBe(0);
    expect(positionSurLiaison({ status: 'error', progress: 60 })).toBe(0);
  });

  it('borne les valeurs absurdes', () => {
    expect(positionSurLiaison({ status: 'uploading', phase: 'uploading', progress: 140 })).toBe(1);
    expect(positionSurLiaison({ status: 'uploading', phase: 'uploading' })).toBe(0);
  });
});

describe('estEnVol', () => {
  it('un envoi en cours ou en attente est en vol ; reçu ou échoué, non', () => {
    expect(estEnVol({ status: 'uploading' })).toBe(true);
    expect(estEnVol({ status: 'queued' })).toBe(true);
    expect(estEnVol({ status: 'completed' })).toBe(false);
    expect(estEnVol({ status: 'error' })).toBe(false);
    expect(estEnVol({ phase: 'processing' })).toBe(true);
    expect(estEnVol({ phase: 'done' })).toBe(false);
  });
});


describe('le temps d’envoi estimé', () => {
  // LE BESOIN : « 37 % » ne dit pas si l'on attendra deux minutes ou une heure.
  it('mesure le débit et le lisse au lieu de suivre chaque à-coup', () => {
    let m = mesurerDebit(null, 0, 0);
    m = mesurerDebit(m, 1_000_000, 1000); // 1 Mo/s
    expect(m.debit).toBe(1_000_000);
    m = mesurerDebit(m, 1_100_000, 2000); // à-coup à 0,1 Mo/s
    expect(m.debit).toBeGreaterThan(600_000);
    expect(m.debit).toBeLessThan(1_000_000);
  });

  it('ignore les mesures trop rapprochées et les reprises en arrière', () => {
    const m = mesurerDebit(mesurerDebit(null, 0, 0), 500_000, 1000);
    expect(mesurerDebit(m, 600_000, 1100)).toBe(m);
    expect(mesurerDebit(m, 100_000, 3000).debit).toBe(m.debit);
  });

  it('ne promet rien tant que le débit est inconnu', () => {
    expect(secondesRestantes(85e6, 12e6, 0)).toBeNull();
    expect(secondesRestantes(85e6, 25e6, 100_000)).toBe(600);
  });

  it('dit la durée comme on la dirait, et conseille le Wi-Fi au-delà de 30 min', () => {
    const d = translations.fr.estimation;
    expect(dureeRestante(30, d)).toBe('moins d’une minute');
    expect(dureeRestante(360, d)).toBe('environ 6 min');
    expect(dureeRestante(4800, d)).toBe('environ 1 h 20');
    expect(4800 > SEUIL_CONSEIL_WIFI).toBe(true);
  });

  it('écrit les quantités en Mo à la française', () => {
    expect(octetsLisibles(12.4 * 1024 * 1024, 'fr')).toBe('12 Mo');
    expect(octetsLisibles(2.5 * 1024 * 1024, 'fr')).toBe('2,5 Mo');
    expect(octetsLisibles(2.5 * 1024 * 1024, 'en')).toBe('2.5 MB');
  });
});
