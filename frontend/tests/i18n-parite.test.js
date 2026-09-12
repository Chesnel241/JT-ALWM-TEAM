import { describe, it, expect } from 'vitest';
import { translations } from '../src/i18n/translations.js';

// Garde-fou du dictionnaire : l'application est lue par des correspondants
// francophones ET anglophones. Une clé ajoutée d'un seul côté, c'est un écran
// à moitié en français pour le Ghana ou le Nigeria. Ce test doit nommer les
// clés fautives : à 2 h du matin, un « faux » tout seul ne sert à rien.

const LANGUES = ['fr', 'en'];

/** Aplatit un dictionnaire imbriqué en « chemin.complet » -> valeur. */
function aplatir(objet, prefixe = '', sortie = new Map()) {
  for (const [cle, valeur] of Object.entries(objet)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (valeur && typeof valeur === 'object' && !Array.isArray(valeur)) {
      aplatir(valeur, chemin, sortie);
    } else {
      sortie.set(chemin, valeur);
    }
  }
  return sortie;
}

const fr = aplatir(translations.fr);
const en = aplatir(translations.en);

/** Chemins présents dans `source` mais pas dans `cible`. */
function absentes(source, cible) {
  return [...source.keys()].filter((chemin) => !cible.has(chemin)).sort();
}

const liste = (lignes) => (lignes.length ? `\n  - ${lignes.join('\n  - ')}` : ' (aucune)');

// Les blocs ajoutés pour l'espace montage et la rédaction du journal. On vérifie
// leur présence nommément : la parité seule ne verrait pas un bloc oublié
// des deux côtés à la fois.
const NOUVEAUX_BLOCS = {
  hub: ['envoiTitre', 'envoiSous', 'redactionTitre', 'redactionSous'],
  rubriques: [
    'retour', 'chargement', 'indisponible', 'reessayer', 'enregistrer', 'enregistrement',
    'enregistreA', 'brouillonLocal', 'quitterSansEnregistrer', 'conflitTitre', 'conflitTexte',
    'conflitRecharger', 'modifieLe', 'conducteurTitre', 'conducteurTexte', 'conducteurCta',
    'motDuJtTitre', 'motDuJtTexte', 'motDuJtCta', 'fichierChoisir', 'fichierTousFormats',
    'fichierEnvoi', 'fichierRecu', 'fichierEchec', 'fichierAnnuler', 'fichiersDeposes',
    'sujetsTitre', 'sujetsSous', 'sujetsInserer', 'sujetsInsereOk', 'sujetsAucun',
  ],
  planning: [
    'titre', 'sous', 'semaineEtDates', 'assemblage', 'habillage', 'aFaire', 'enCours', 'termine',
    'badgeEnCours', 'equipe', 'ajouterMonteur', 'nomDuMonteur', 'retirerNote', 'personne',
    'conducteurSemaine', 'monteSur', 'enAttenteFichier', 'pieces', 'aucuneSemaine',
    'aucuneSemaineSous', 'chargement', 'maSemaine', 'ajoutImpossible', 'majImpossible',
  ],
  adminGate: ['titre', 'sous', 'champ', 'valider', 'enCours', 'erreur', 'erreurReseau'],
  delais: ['enAttente', 'accorder', 'accuse', 'aucune'],
  relance: ['titre', 'sous', 'aucun', 'ouvrir', 'sansNumero', 'message'],
  duree: ['inconnue', 'totalPays', 'totalJournal'],
};

describe('parité du dictionnaire FR / EN', () => {
  it('expose rigoureusement les mêmes chemins de clés dans les deux langues', () => {
    const absentesEn = absentes(fr, en);
    const absentesFr = absentes(en, fr);
    const rapport =
      `Clés définies en FR et manquantes en EN (${absentesEn.length}) :${liste(absentesEn)}\n` +
      `Clés définies en EN et manquantes en FR (${absentesFr.length}) :${liste(absentesFr)}`;

    // On compare les listes elles-mêmes : l'échec affiche les clés en clair.
    expect({ absentesEn, absentesFr }, rapport).toEqual({ absentesEn: [], absentesFr: [] });
  });

  it('donne le même type à chaque clé dans les deux langues', () => {
    const ecarts = [];
    for (const [chemin, valeurFr] of fr) {
      if (!en.has(chemin)) continue; // déjà signalé par le test de parité des clés
      const valeurEn = en.get(chemin);
      if (typeof valeurFr !== typeof valeurEn) {
        ecarts.push(`${chemin} : fr=${typeof valeurFr}, en=${typeof valeurEn}`);
      }
    }
    expect(ecarts, `Clés de type différent entre FR et EN :${liste(ecarts)}`).toEqual([]);
  });

  it('donne le même nombre d’arguments aux clés fonction', () => {
    const ecarts = [];
    for (const [chemin, valeurFr] of fr) {
      const valeurEn = en.get(chemin);
      if (typeof valeurFr !== 'function' || typeof valeurEn !== 'function') continue;
      if (valeurFr.length !== valeurEn.length) {
        ecarts.push(`${chemin} : fr attend ${valeurFr.length} argument(s), en ${valeurEn.length}`);
      }
    }
    expect(ecarts, `Clés fonction aux signatures divergentes :${liste(ecarts)}`).toEqual([]);
  });

  it('n’a aucune valeur de chaîne vide', () => {
    const vides = [];
    for (const langue of LANGUES) {
      for (const [chemin, valeur] of aplatir(translations[langue])) {
        if (typeof valeur === 'string' && valeur.trim() === '') vides.push(`${langue}.${chemin}`);
      }
    }
    expect(vides, `Chaînes vides :${liste(vides)}`).toEqual([]);
  });
});

describe('blocs des écrans montage et rédaction', () => {
  for (const [bloc, clesAttendues] of Object.entries(NOUVEAUX_BLOCS)) {
    for (const langue of LANGUES) {
      it(`« ${bloc} » est traduit en ${langue}`, () => {
        const contenu = translations[langue][bloc];
        expect(contenu, `Bloc « ${bloc} » absent en ${langue}`).toBeTypeOf('object');

        const presentes = Object.keys(contenu);
        const manquantes = clesAttendues.filter((cle) => !presentes.includes(cle));
        expect(manquantes, `Clés manquantes dans ${langue}.${bloc} :${liste(manquantes)}`).toEqual([]);
      });
    }
  }
});
