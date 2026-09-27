/**
 * Les deux rubriques du journal.
 *
 * « Titres & Rappels » et « Mot du JT » étaient rangés parmi les pays : le
 * premier injecté dans COUNTRIES, le second en « bucket spécial ». Ce n'en
 * sont pas. Le premier est le CONDUCTEUR du journal — il recense les
 * reportages de tous les pays — et le second la vidéo d'un intervenant.
 * Les traiter en pays obligeait à les écarter à la main d'une quinzaine
 * d'endroits, et n'offrait aucun des champs qui leur sont propres.
 *
 * Ce qui ne change PAS : les identifiants de rangement `tj` et `mj` restent
 * les clés de stockage des fichiers. Le studio de montage, la frise et les
 * exports les adressent déjà ainsi ; une migration de fichiers n'apporterait
 * rien de visible pour un vrai risque. Ils cessent d'être des pays, ils
 * restent des tiroirs.
 */

export const RUBRIQUES = Object.freeze({
  conducteur: Object.freeze({
    cle: 'conducteur',
    bin: 'tj',
    nom: 'Conducteur du JT',
    description: 'Le déroulé du journal, la voix off et son texte.',
    // Ce que le correspondant dépose comme FICHIER dans cette rubrique.
    natureFichier: 'audio',
    libelleFichier: 'La voix off (audio)',
    champs: Object.freeze([
      Object.freeze({ cle: 'texte', libelle: 'Le conducteur', multiligne: true, max: 20000 }),
      Object.freeze({ cle: 'texteVoixOff', libelle: 'Texte de la voix off', multiligne: true, max: 20000 }),
    ]),
  }),
  motDuJt: Object.freeze({
    cle: 'motDuJt',
    bin: 'mj',
    nom: 'Mot du JT',
    description: "L'intervention filmée, et qui parle de quoi.",
    natureFichier: 'video',
    libelleFichier: "La vidéo de l'intervenant",
    champs: Object.freeze([
      Object.freeze({ cle: 'orateur', libelle: "Nom de l'orateur", max: 120 }),
      Object.freeze({ cle: 'pays', libelle: 'Pays', max: 80 }),
      Object.freeze({ cle: 'theme', libelle: 'Thème', max: 300 }),
    ]),
  }),
});

export const LISTE_RUBRIQUES = Object.freeze(Object.values(RUBRIQUES));

/** Identifiants de rangement des rubriques : `tj` et `mj`. */
export const BINS_RUBRIQUES = Object.freeze(new Set(LISTE_RUBRIQUES.map((r) => r.bin)));

/** Une rubrique, désignée par sa clé (`conducteur`) ou son tiroir (`tj`). */
export function trouverRubrique(cleOuBin) {
  const v = String(cleOuBin || '');
  return LISTE_RUBRIQUES.find((r) => r.cle === v || r.bin === v) || null;
}

/** Vrai si cet identifiant désigne une rubrique et non un pays. */
export function estRubrique(id) {
  return BINS_RUBRIQUES.has(String(id || ''));
}

/**
 * Étiquettes de fichier qui ne désignent **jamais** un reportage de
 * correspondant.
 *
 * L'espace d'un pays a deux sections fixes, « Annonces » et « Séminaires de
 * la semaine », et la rédaction y dépose aussi le « Reportage Assemblé ».
 * Aucune n'est un sujet : elles n'ont pas d'auteur, pas de titre à choisir,
 * et n'entrent pas dans la limite de cinq reportages.
 *
 * L'INCIDENT : la migration créait un sujet par étiquette rencontrée, sans
 * exception. Au redémarrage suivant, une annonce devenait un sujet
 * « Annonces » — numéroté parmi les reportages du correspondant, en double
 * avec la section fixe, compté dans ses cinq, et présenté à la rédaction
 * comme un reportage attendu. Vérifié sur le vrai store.
 *
 * Le studio déclare les mêmes noms (`SECTIONS_FIXES`, dans
 * `frontend/src/lib/sujets.js`) ; un test garde les deux listes accordées.
 */
export const ETIQUETTES_HORS_SUJET = Object.freeze(new Set([
  'Annonces',
  'Séminaires de la semaine',
  'Reportage Assemblé',
]));

/** Vrai si l'étiquette désigne une section fixe, et non un reportage. */
export function estHorsSujet(etiquette) {
  return ETIQUETTES_HORS_SUJET.has(String(etiquette || '').trim());
}

/**
 * Ne garde que les champs déclarés, en respectant leurs bornes.
 * Un champ absent de la déclaration est ignoré : la forme de la rubrique est
 * décidée ici, pas par ce que le client envoie.
 */
export function nettoyerChamps(rubrique, recu = {}) {
  const propre = {};
  for (const champ of rubrique.champs) {
    if (!(champ.cle in (recu || {}))) continue;
    propre[champ.cle] = String(recu[champ.cle] ?? '').slice(0, champ.max);
  }
  return propre;
}
