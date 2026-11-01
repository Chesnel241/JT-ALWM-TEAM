/**
 * Le pays d'un correspondant, sans compte utilisateur.
 *
 * L'appareil retenait auparavant deux choses : le dernier pays ouvert, et un
 * « pays confirmé » qui ouvrait l'accueil sur ce pays. Ce « dernier accès »
 * a été retiré : l'accès se fait sans compte, et le pays ouvert en dernier
 * sur un appareil ne disait rien de la personne qui arrivait (poste partagé
 * en rédaction, téléphone prêté, correspondant qui couvre deux pays). Chacun
 * entre maintenant par son drapeau, sur l'accueil, ou par son lien personnel
 * `/journalistes/ga` (voir lib/routing.js), qui reste le seul raccourci.
 */

// Clés posées par les versions précédentes, effacées au démarrage.
const ANCIENNES_CLES = ['last_selected_country_id', 'reporter_home_country_id'];

/** Efface les pays mémorisés par les versions précédentes. */
export function oublierPaysMemorises() {
  for (const cle of ANCIENNES_CLES) {
    try {
      localStorage.removeItem(cle);
    } catch {
      /* stockage indisponible : il n'y a rien à effacer */
    }
  }
}

/**
 * Résout un identifiant (porté par l'URL) en pays réellement existant. Un
 * pays personnalisé peut avoir été supprimé côté serveur, et un identifiant
 * recopié à la main peut ne correspondre à rien : dans les deux cas on
 * préfère la liste complète à un écran vide.
 */
export function resolveCountry(countries, countryId) {
  if (!countryId || !Array.isArray(countries)) return null;
  const wanted = String(countryId).trim().toLowerCase();
  return countries.find((c) => c && String(c.id).toLowerCase() === wanted) || null;
}
