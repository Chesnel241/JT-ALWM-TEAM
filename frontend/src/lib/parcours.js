import { splitByMediaType } from './mediaTypes.js';

/**
 * La semaine d'un correspondant, en trois étapes reliées : ses fichiers, sa
 * voix off, le JT.
 *
 * LE BESOIN : sans compte utilisateur, rien ne disait au correspondant où il
 * en était — sinon une ligne « 3 fichiers envoyés » perdue sous son pays. Les
 * trois étapes, reliées par un trait qui se remplit, se lisent d'un coup
 * d'œil, même pour quelqu'un qui n'est pas à l'aise avec un écran.
 *
 * Ce n'est pas une séquence imposée : la voix off est facultative (beaucoup
 * la posent dans leur montage), et le JT arrive quand la rédaction le
 * publie. Aucune étape n'est donc numérotée ; l'étape « à vous » est la
 * première chose qui dépend du correspondant et qui reste à faire.
 *
 * @param {{fichiers?: object[], livraisons?: object[]}} donnees
 * @returns {{etapes: Array<{cle: 'reportage'|'voixOff'|'jt', etat: string, nombre?: number}>,
 *   aVous: ?string, remplissage: number}}
 *   `etat` : `fait`, `aFaire`, `aCorriger`, `facultatif`, `enAttente`, `pret`.
 *   `remplissage` : part du trait déjà parcourue, de 0 à 1.
 */
export function etapesParcours({ fichiers = [], livraisons = [] } = {}) {
  const liste = Array.isArray(fichiers) ? fichiers.filter(Boolean) : [];
  const parType = splitByMediaType(liste);
  const audios = (parType.audio || []).length;
  const autres = liste.length - audios;
  const aCorriger = liste.filter((f) => f.status === 'rejected').length;
  const jtPret = Array.isArray(livraisons) && livraisons.length > 0;

  const reportage = aCorriger > 0
    ? { cle: 'reportage', etat: 'aCorriger', nombre: aCorriger }
    : autres > 0
      ? { cle: 'reportage', etat: 'fait', nombre: autres }
      : { cle: 'reportage', etat: 'aFaire' };
  const voixOff = audios > 0
    ? { cle: 'voixOff', etat: 'fait', nombre: audios }
    : { cle: 'voixOff', etat: 'facultatif' };
  const jt = { cle: 'jt', etat: jtPret ? 'pret' : 'enAttente' };

  const etapes = [reportage, voixOff, jt];
  const aVous = reportage.etat !== 'fait' ? 'reportage' : null;

  // Le trait avance d'une moitié par étape franchie : fichiers envoyés,
  // puis JT prêt. La voix off, facultative, ne le retient pas.
  let remplissage = 0;
  if (reportage.etat === 'fait') remplissage = 0.5;
  if (jtPret) remplissage = 1;

  return { etapes, aVous, remplissage };
}
