/**
 * La taille d'un fichier, lisible.
 *
 * L'INCIDENT : la Livraison affichait « NaN MB » sous chaque montage. Le
 * serveur envoie déjà une chaîne (« 412.3 MB », « 812 octets ») et l'écran
 * la divisait encore par 1024 × 1024. Ici on accepte les deux formes : un
 * nombre d'octets, ou une chaîne déjà formatée, laissée telle quelle.
 */
export function tailleLisible(taille) {
  if (typeof taille === 'number' && Number.isFinite(taille) && taille >= 0) {
    if (taille < 1024 * 1024) return `${Math.max(1, Math.round(taille / 1024))} Ko`;
    if (taille < 1024 * 1024 * 1024) return `${(taille / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(taille / (1024 * 1024 * 1024)).toFixed(2)} Go`;
  }
  if (typeof taille === 'string' && taille.trim() && !/nan/i.test(taille)) return taille.trim();
  return '';
}
