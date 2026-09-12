import { describe, it, expect } from 'vitest';
import { translations } from '../src/i18n/translations.js';

/**
 * L'heure de clôture, dite pareil dans les deux langues.
 *
 * Quand la clôture est passée du dimanche 17h30 au dimanche 10h30, le
 * français a été repris partout et l'anglais oublié à trois endroits : les
 * correspondants du Ghana et du Nigeria ont continué de lire « Sunday
 * 5:30 PM ». Une heure fausse annoncée à un correspondant vaut un reportage
 * qui arrive après la fermeture.
 *
 * Ce test parcourt les DEUX dictionnaires en entier, y compris les clés
 * fonctions, et refuse toute trace de l'ancienne heure.
 */

// Formes possibles de l'ancienne échéance, dans les deux langues.
const ANCIENNE_HEURE = /\b(17\s*h\s*30|17:30|5:30\s*(PM|pm)|5\s*h\s*30\s*(PM|pm))\b/;

// Formes acceptées de la nouvelle.
const NOUVELLE_HEURE = /\b(10\s*h\s*30|10:30)\b/;

/** Toutes les chaînes d'un dictionnaire, chemin compris, fonctions évaluées. */
function toutesLesChaines(noeud, chemin = [], sortie = []) {
  if (typeof noeud === 'string') {
    sortie.push([chemin.join('.'), noeud]);
    return sortie;
  }
  if (typeof noeud === 'function') {
    // On appelle avec des valeurs neutres : c'est le texte fixe autour des
    // trous qui nous intéresse, pas les trous eux-mêmes.
    try {
      const rendu = noeud(...Array.from({ length: noeud.length }, () => '…'));
      if (typeof rendu === 'string') sortie.push([`${chemin.join('.')}()`, rendu]);
    } catch {
      // Une clé fonction qui refuse des arguments neutres rend un objet
      // (cf. countdown.normalDesc) : ses parties sont déjà parcourues.
    }
    return sortie;
  }
  if (noeud && typeof noeud === 'object') {
    for (const [cle, valeur] of Object.entries(noeud)) {
      toutesLesChaines(valeur, [...chemin, cle], sortie);
    }
  }
  return sortie;
}

describe('heure de clôture annoncée aux correspondants', () => {
  for (const langue of ['fr', 'en']) {
    it(`${langue} : plus aucune trace de l’ancienne échéance`, () => {
      const fautives = toutesLesChaines(translations[langue])
        .filter(([, texte]) => ANCIENNE_HEURE.test(texte))
        .map(([chemin, texte]) => `${langue}.${chemin} → « ${texte} »`);

      expect(fautives, `Ancienne heure de clôture encore annoncée :\n${fautives.join('\n')}`)
        .toEqual([]);
    });
  }

  it('les deux langues annoncent la même heure, et autant de fois', () => {
    const compte = (langue) => toutesLesChaines(translations[langue])
      .filter(([, texte]) => NOUVELLE_HEURE.test(texte)).length;

    // Un déséquilibre signale une chaîne traduite sans son heure, ou une
    // heure ajoutée d'un seul côté.
    expect(compte('en')).toBe(compte('fr'));
    expect(compte('fr')).toBeGreaterThan(0);
  });

  it('le fuseau est toujours écrit, jamais sous-entendu', () => {
    // L'équipe est répartie de Dakar à Libreville : « 10h30 » sans fuseau
    // n'est pas une heure, c'est une devinette.
    for (const langue of ['fr', 'en']) {
      const sansFuseau = toutesLesChaines(translations[langue])
        .filter(([, texte]) => NOUVELLE_HEURE.test(texte) && !/GMT\s*\+\s*2/i.test(texte))
        .map(([chemin]) => `${langue}.${chemin}`);
      expect(sansFuseau, `Heure sans fuseau : ${sansFuseau.join(', ')}`).toEqual([]);
    }
  });
});
