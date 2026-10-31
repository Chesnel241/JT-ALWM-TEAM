import { describe, it, expect } from 'vitest';
import { etapesEnvoi, positionSurLiaison, estEnVol } from '../src/lib/envoi.js';

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
