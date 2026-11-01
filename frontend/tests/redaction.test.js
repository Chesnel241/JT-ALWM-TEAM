import { describe, it, expect } from 'vitest';
import { etatRedaction, avancementRedaction } from '../src/lib/redaction.js';

/**
 * L'état de la rédaction du journal, pièce par pièce.
 *
 * LE BESOIN : savoir depuis l'accueil ce qui manque au conducteur et au Mot
 * du JT, sans ouvrir chaque rubrique.
 */
describe('etatRedaction', () => {
  it('rien d’écrit, rien de déposé : tout est « vide »', () => {
    const etat = etatRedaction({ rubriques: {}, fichiersConducteur: [], fichiersMot: [] });
    expect(etat.inconnu).toBe(false);
    expect(etat.conducteur.etat).toBe('vide');
    expect(etat.motDuJt.etat).toBe('vide');
    expect(avancementRedaction(etat)).toEqual({ faits: 0, total: 7, part: 0 });
  });

  it('un texte fait d’espaces ne compte pas comme écrit', () => {
    const etat = etatRedaction({ rubriques: { conducteur: { texte: '   \n ' } } });
    expect(etat.conducteur.elements.find((e) => e.cle === 'texte').fait).toBe(false);
  });

  it('le conducteur complet : texte, texte de voix off et fichier audio', () => {
    const etat = etatRedaction({
      rubriques: { conducteur: { texte: 'Titres', texteVoixOff: 'Bonsoir', majLe: '2026-10-30T10:00:00Z' } },
      fichiersConducteur: [{ id: 'a' }],
    });
    expect(etat.conducteur.etat).toBe('pret');
    expect(etat.conducteur.faits).toBe(3);
    expect(etat.conducteur.majLe).toBe('2026-10-30T10:00:00.000Z');
  });

  it('le Mot du JT commencé : l’orateur est connu, la vidéo manque', () => {
    const etat = etatRedaction({ rubriques: { motDuJt: { orateur: '  Awa Diallo ', theme: 'Santé' } }, fichiersMot: [] });
    expect(etat.motDuJt.etat).toBe('partiel');
    expect(etat.motDuJt.orateur).toBe('Awa Diallo');
    expect(etat.motDuJt.elements.map((e) => [e.cle, e.fait])).toEqual([
      ['video', false], ['orateur', true], ['pays', false], ['theme', true],
    ]);
  });

  it('des rubriques illisibles : l’état est inconnu, jamais inventé', () => {
    const etat = etatRedaction({ rubriques: null });
    expect(etat.inconnu).toBe(true);
    expect(etatRedaction().inconnu).toBe(true);
  });

  it('l’avancement compte les pièces des deux rubriques', () => {
    const etat = etatRedaction({
      rubriques: { conducteur: { texte: 'x' }, motDuJt: { orateur: 'y' } },
      fichiersMot: [{ id: 'v' }],
    });
    expect(avancementRedaction(etat)).toEqual({ faits: 3, total: 7, part: 3 / 7 });
  });

  it('la date retenue est la plus récente : le texte, ou le dernier fichier déposé', () => {
    const etat = etatRedaction({
      rubriques: { conducteur: { texte: 'x', majLe: '2026-10-29T08:00:00Z' } },
      fichiersConducteur: [{ id: 'a', uploadedAt: '2026-10-30T18:00:00Z' }, { id: 'b', uploadedAt: '2026-10-28T09:00:00Z' }],
    });
    expect(etat.conducteur.majLe).toBe('2026-10-30T18:00:00.000Z');
    expect(etatRedaction({ rubriques: {} }).motDuJt.majLe).toBeNull();
  });
});
