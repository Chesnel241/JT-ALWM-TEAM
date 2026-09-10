import { sectionsFromUploads } from './mediaTypes.js';

/**
 * Sections affichées au correspondant.
 *
 * Un sujet du serveur donne une section nommée, à laquelle les fichiers se
 * rattachent par `sujetId`. C'est ce qui remplace l'étiquette texte comparée
 * par égalité de chaîne : une faute de frappe ou un changement de langue ne
 * sépare plus en deux ce qui est un seul reportage.
 *
 * Repli : tant qu'aucun sujet n'existe — première visite, migration pas encore
 * passée, API injoignable — on reconstruit les sections numérotées à partir
 * des envois, comme avant. Rien ne disparaît de l'écran dans l'intervalle.
 */
export function buildSections(sujets, uploads, { reportageName, extras = [] } = {}) {
  const liste = Array.isArray(sujets) ? sujets : [];

  const sections = liste.length > 0
    ? liste.map((sujet, i) => ({
      id: sujet.id,
      sujetId: sujet.id,
      name: sujet.titre,
      badge: i + 1,
      isFirst: i === 0,
      etat: sujet.etat,
    }))
    : Array.from(
      { length: Math.max(1, sectionsFromUploads(uploads)) },
      (_, i) => ({
        id: `reportage-${i}`,
        sujetId: null,
        name: reportageName ? reportageName(i + 1) : `Reportage ${i + 1}`,
        badge: i + 1,
        isFirst: i === 0,
        etat: null,
      })
    );

  return [...sections, ...extras];
}

/**
 * Fichiers d'une section.
 *
 * `sujetId` fait foi. Le repli sur l'étiquette couvre les envois faits avant
 * la bascule, et les rubriques fixes (Annonces, Séminaires) qui n'ont pas de
 * sujet. Un fichier sans rattachement rejoint la première section, exactement
 * comme l'affichage le faisait déjà.
 */
export function filesForSection(files, section) {
  const liste = Array.isArray(files) ? files : [];
  if (!section) return [];
  if (section.sujetId) return liste.filter((f) => f?.sujetId === section.sujetId);
  return liste.filter(
    (f) => f?.reportage === section.name || (!f?.reportage && !f?.sujetId && section.isFirst)
  );
}
