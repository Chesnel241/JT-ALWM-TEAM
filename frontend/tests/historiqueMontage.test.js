import { describe, expect, it } from 'vitest';
import {
  FUSION_MS,
  PROFONDEUR,
  annuler,
  creerHistorique,
  enregistrer,
  etiquetteGeste,
  etiquetteSaisie,
  peutAnnuler,
  peutRetablir,
  reinitialiser,
  retablir,
} from '../src/components/editor/historiqueMontage.js';

/**
 * L'annulation, testée comme des mathématiques.
 *
 * Deux incidents la justifient. Les titres et l'habillage n'étaient pas
 * annulables du tout — supprimer un bandeau d'un clic était définitif. Et
 * taper une lettre dans l'inspecteur effaçait toute la pile, parce que
 * l'aperçu en direct réécrit les clips à chaque frappe : corriger une faute
 * faisait perdre la coupe faite deux minutes plus tôt.
 */

/** Un état de montage réduit à ce qui le distingue d'un autre. */
const etat = (n) => ({ clips: [{ id: `c${n}` }], overlays: [], branding: {} });

describe('revenir en arrière', () => {
  it('rend l’état d’avant la dernière modification', () => {
    let h = creerHistorique();
    h = enregistrer(h, etat(1), { etiquette: 'coupe', maintenant: 0 });
    h = enregistrer(h, etat(2), { etiquette: 'coupe', maintenant: 10_000 });

    const { historique, etat: rendu } = annuler(h, etat(3));
    expect(rendu).toEqual(etat(2));
    expect(annuler(historique, rendu).etat).toEqual(etat(1));
  });

  it('ne rend rien quand il n’y a rien à annuler', () => {
    const h = creerHistorique();
    expect(peutAnnuler(h)).toBe(false);
    expect(annuler(h, etat(1))).toEqual({ historique: h, etat: null });
  });

  it('permet de rétablir ce qu’on vient d’annuler', () => {
    let h = enregistrer(creerHistorique(), etat(1), { etiquette: 'coupe', maintenant: 0 });
    const recul = annuler(h, etat(2));
    expect(peutRetablir(recul.historique)).toBe(true);

    const avance = retablir(recul.historique, recul.etat);
    expect(avance.etat).toEqual(etat(2));
    expect(peutRetablir(avance.historique)).toBe(false);
  });

  it('referme le futur dès qu’on repart dans une autre direction', () => {
    // On ne peut pas rétablir une branche qu'on vient d'abandonner : ce serait
    // proposer au monteur de retrouver un montage qui n'existe plus.
    let h = enregistrer(creerHistorique(), etat(1), { etiquette: 'coupe', maintenant: 0 });
    const recul = annuler(h, etat(2));
    h = enregistrer(recul.historique, recul.etat, { etiquette: 'coupe', maintenant: 20_000 });
    expect(peutRetablir(h)).toBe(false);
  });
});

describe('la fusion des salves', () => {
  it('ne fait qu’une entrée de quarante frappes dans le même champ', () => {
    // Sans elle, « Annuler » reculerait d'une lettre à la fois — ce qui revient
    // à ne pas avoir d'annulation. C'est la règle de tous les éditeurs de texte.
    let h = creerHistorique();
    const etiquette = etiquetteSaisie('o1', 'titre');
    for (let i = 0; i < 40; i += 1) {
      h = enregistrer(h, etat(i), { etiquette, maintenant: i * 20 });
    }
    expect(h.passe.length).toBe(1);
  });

  it('garde l’état le plus ancien de la salve', () => {
    // Annuler doit ramener avant le PREMIER caractère tapé, pas avant le
    // dernier : sinon le champ reste plein à une lettre près.
    let h = creerHistorique();
    const etiquette = etiquetteSaisie('o1', 'titre');
    h = enregistrer(h, etat('vide'), { etiquette, maintenant: 0 });
    h = enregistrer(h, etat('D'), { etiquette, maintenant: 100 });
    h = enregistrer(h, etat('Do'), { etiquette, maintenant: 200 });
    expect(annuler(h, etat('Dou')).etat).toEqual(etat('vide'));
  });

  it('ne fusionne jamais deux gestes de nature différente', () => {
    // Couper puis taper sont deux gestes : défaire la frappe ne doit pas
    // défaire la coupe, même si les deux se suivent d'une milliseconde.
    let h = creerHistorique();
    h = enregistrer(h, etat(1), { etiquette: 'coupe', maintenant: 0 });
    h = enregistrer(h, etat(2), { etiquette: etiquetteSaisie('o1', 'titre'), maintenant: 1 });
    expect(h.passe.length).toBe(2);
  });

  it('ne fusionne pas deux champs différents du même habillage', () => {
    let h = creerHistorique();
    h = enregistrer(h, etat(1), { etiquette: etiquetteSaisie('o1', 'titre'), maintenant: 0 });
    h = enregistrer(h, etat(2), { etiquette: etiquetteSaisie('o1', 'sous_titre'), maintenant: 50 });
    expect(h.passe.length).toBe(2);
  });

  it('rouvre une entrée quand la salve s’est interrompue', () => {
    let h = creerHistorique();
    const etiquette = etiquetteSaisie('o1', 'titre');
    h = enregistrer(h, etat(1), { etiquette, maintenant: 0 });
    h = enregistrer(h, etat(2), { etiquette, maintenant: FUSION_MS + 1 });
    expect(h.passe.length).toBe(2);
  });

  it('ne fusionne rien quand le geste n’est pas étiqueté', () => {
    // Une modification sans nom est une modification isolée : dans le doute,
    // on préfère une entrée de trop à une entrée perdue.
    let h = creerHistorique();
    h = enregistrer(h, etat(1), { maintenant: 0 });
    h = enregistrer(h, etat(2), { maintenant: 1 });
    expect(h.passe.length).toBe(2);
  });

  it('close la salve après une annulation', () => {
    // Sinon la frappe suivante fusionnerait avec celle d'avant le recul, et
    // écraserait l'état que l'annulation venait de rétablir.
    let h = creerHistorique();
    const etiquette = etiquetteSaisie('o1', 'titre');
    h = enregistrer(h, etat(1), { etiquette, maintenant: 0 });
    const recul = annuler(h, etat(2));
    const apres = enregistrer(recul.historique, recul.etat, { etiquette, maintenant: 10 });
    expect(apres.passe.length).toBe(1);
  });
});

describe('ce qui vient d’ailleurs', () => {
  it('efface la pile, parce qu’on n’annule pas le travail d’un collègue', () => {
    // Hydratation d'une semaine, notification socket, adoption de la copie
    // serveur après un 409 : annuler ces arrivées réécraserait le travail d'un
    // autre monteur en silence, et lui ne verrait rien.
    let h = enregistrer(creerHistorique(), etat(1), { etiquette: 'coupe', maintenant: 0 });
    expect(peutAnnuler(reinitialiser(h))).toBe(false);
    expect(peutRetablir(reinitialiser(h))).toBe(false);
  });
});

describe('la profondeur', () => {
  it('oublie les plus anciennes plutôt que de grossir sans fin', () => {
    let h = creerHistorique();
    for (let i = 0; i < PROFONDEUR + 20; i += 1) {
      h = enregistrer(h, etat(i), { etiquette: `geste-${i}`, maintenant: i * 10_000 });
    }
    expect(h.passe.length).toBe(PROFONDEUR);
    // Ce sont bien les plus récentes qu'on garde.
    expect(h.passe[h.passe.length - 1]).toEqual(etat(PROFONDEUR + 19));
  });
});

describe('un glissé, aussi lent soit-il, reste une seule modification', () => {
  it('ne se découpe pas quand le geste dure plus longtemps que la fenêtre', () => {
    // Un glissé de titre émet une modification par mouvement de souris. Sans
    // fenêtre ouverte, un déplacement de trois secondes ferait trois entrées,
    // et il faudrait annuler trois fois pour défaire un seul geste.
    let h = creerHistorique();
    const etiquette = etiquetteGeste('glisse');
    for (let i = 0; i < 60; i += 1) {
      h = enregistrer(h, etat(i), { etiquette, maintenant: i * 50, fenetre: Infinity });
    }
    expect(h.passe.length).toBe(1);
    expect(annuler(h, etat(99)).etat).toEqual(etat(0));
  });

  it('donne une étiquette différente à chaque geste', () => {
    expect(etiquetteGeste('glisse')).not.toBe(etiquetteGeste('glisse'));
  });
});
