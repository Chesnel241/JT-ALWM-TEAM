import { sectionsFromUploads, sectionNumber } from './mediaTypes.js';

/**
 * Les sections fixes de l'espace d'un pays. Elles ne sont pas des reportages :
 * pas de titre à choisir, et hors de la limite de cinq.
 *
 * Écrites une seule fois ici — elles l'étaient en double, dans la vue mobile
 * et dans la vue ordinateur. Le serveur en tient la liste miroir
 * (`ETIQUETTES_HORS_SUJET`, `backend/src/data/rubriques.js`) : sans elle, une
 * annonce redevenait un reportage « Annonces » au redémarrage suivant. Un test
 * garde les deux listes accordées.
 */
export const SECTIONS_FIXES = Object.freeze([
  Object.freeze({ id: 'annonces', sujetId: null, name: 'Annonces', badge: 'A', isFirst: false }),
  Object.freeze({ id: 'seminaires', sujetId: null, name: 'Séminaires de la semaine', badge: 'S', isFirst: false }),
]);

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

/** Vrai si le fichier appartient à une section fixe, et non à un reportage. */
export function estSectionFixe(fichier) {
  return SECTIONS_FIXES.some((s) => s.name === fichier?.reportage);
}

/**
 * Ce que le choix du nombre de reportages doit savoir.
 *
 * - `nommes` : les reportages ont déjà un titre (des sujets existent) ;
 * - `actuel` : le nombre à afficher comme choisi — 0 tant que rien n'est
 *   décidé et que rien n'a été déposé ;
 * - `minimum` : on ne descend pas sous le dernier reportage qui contient des
 *   fichiers. Le serveur le refuse aussi (409) ; ici, on évite de proposer ce
 *   qui serait refusé.
 *
 * Tant qu'aucun reportage n'est nommé, les envois déjà faits dans les
 * sections de repli (« Reportage 2 ») comptent : ils sont à l'écran, et le
 * serveur les rattachera au reportage de même rang.
 */
export function etatNombreReportages(sujets, uploads) {
  const liste = Array.isArray(sujets) ? sujets : [];
  const fichiers = Array.isArray(uploads) ? uploads : [];

  if (liste.length > 0) {
    let dernierPlein = 0;
    liste.forEach((sujet, i) => {
      if (fichiers.some((f) => f?.sujetId === sujet.id)) dernierPlein = i + 1;
    });
    return { nommes: true, actuel: liste.length, minimum: Math.max(1, dernierPlein) };
  }

  const orphelins = fichiers.filter((f) => f && !f.sujetId && !estSectionFixe(f));
  if (orphelins.length === 0) return { nommes: false, actuel: 0, minimum: 1 };

  // Un envoi sans étiquette s'affiche dans la section 1.
  const dernierPlein = orphelins.reduce((max, f) => Math.max(max, sectionNumber(f.reportage) || 1), 1);
  return {
    nommes: false,
    actuel: Math.max(1, sectionsFromUploads(fichiers), dernierPlein),
    minimum: dernierPlein,
  };
}
