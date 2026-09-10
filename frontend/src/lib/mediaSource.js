import { API_BASE } from '../api/index.js';

/**
 * Fichier que l'APERÇU doit lire : la copie légère quand elle existe, le
 * master sinon.
 *
 * L'export, lui, repart toujours du master — il est adressé par `filename`
 * côté serveur et ne passe pas par ici. C'est cette séparation qui permet au
 * studio de rester fluide sur une machine modeste sans dégrader le JT diffusé.
 */
export function previewFilename(item) {
  if (!item) return '';
  return item.proxyFilename || item.filename || item.name || '';
}

/** URL de lecture d'un média du chutier, proxy compris. */
export function previewUrl(item) {
  const name = previewFilename(item);
  if (!name) return '';
  if (name.startsWith('http') || name.startsWith('blob:')) return name;
  return `${API_BASE}/uploads/${encodeURIComponent(name)}?cors=2`;
}
