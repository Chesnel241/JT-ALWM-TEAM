/**
 * Les noms de la version légère d'un JT publié. Sans dépendance : le store
 * s'en sert pour nommer le téléchargement et reconnaître le fichier.
 */
import path from 'path';

const sansExtension = (nom) => {
  const base = path.basename(String(nom || ''));
  const point = base.lastIndexOf('.');
  return point > 0 ? base.slice(0, point) : base;
};

/** Le fichier sur le disque : `<master>.leger.mp4`, à côté du master. */
export const nomLeger = (filename) => `${sansExtension(filename)}.leger.mp4`;

/** Le nom proposé au téléchargement, qui dit ce qu'on enregistre. */
export const nomTelechargementLeger = (nom) => `${sansExtension(nom) || 'JT'} (version légère).mp4`;
