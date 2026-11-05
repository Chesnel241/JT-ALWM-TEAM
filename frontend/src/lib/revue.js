/**
 * La revue des rushes, côté montage : ce qui reste à regarder, et dans quel
 * ordre.
 *
 * L'INCIDENT : regarder un rush puis le valider coûtait cinq clics, la
 * fenêtre s'ouvrait sur « Refusé » par défaut, et rien ne disait ce qui
 * restait à revoir. Ces fonctions pures donnent à l'écran les trois repères
 * qui manquaient : le statut lisible, le compte « à revoir », l'ordre.
 */
import { groupByReportage, MEDIA_ORDER } from './mediaTypes.js';

/** Un fichier sans statut est à revoir : c'est l'état d'un envoi neuf. */
export function statutDe(fichier) {
  const s = fichier?.status;
  return s === 'approved' || s === 'rejected' ? s : 'pending';
}

export function estARevoir(fichier) {
  return statutDe(fichier) === 'pending';
}

export function compterARevoir(fichiers) {
  return (Array.isArray(fichiers) ? fichiers : []).filter(estARevoir).length;
}

/** Le plus récent d'abord : c'est lui que le monteur vient chercher. */
export function recentsDabord(a, b) {
  const ta = Date.parse(a?.uploadedAt || '') || 0;
  const tb = Date.parse(b?.uploadedAt || '') || 0;
  return tb - ta;
}

/**
 * L'ordre exact de l'écran : par reportage, puis par famille (vidéo, image,
 * son, document), le plus récent d'abord. La visionneuse suit cet ordre pour
 * « suivant » et « précédent ».
 */
export function ordreAffichage(fichiers, sujets = []) {
  const groupes = groupByReportage(fichiers, { sujets });
  return groupes.flatMap((g) => MEDIA_ORDER.flatMap((type) => [...g.byType[type]].sort(recentsDabord)));
}
