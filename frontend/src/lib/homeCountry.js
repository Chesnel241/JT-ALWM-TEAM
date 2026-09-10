/**
 * « Mon pays » côté journaliste, sans compte utilisateur.
 *
 * Tous les correspondants ouvrent la même URL avec le même mot de passe : il
 * n'y a donc aucune identité côté serveur sur laquelle s'appuyer. Ce qui les
 * distingue, c'est l'appareil. `localStorage` est cloisonné par navigateur et
 * par appareil : le téléphone du correspondant gabonais ne voit jamais ce
 * qu'a écrit celui du Sénégal, alors même que le lien est identique.
 *
 * Deux niveaux, volontairement distincts :
 *
 *   - `last` : dernier pays ouvert. Posé sans rien demander, il ne sert qu'à
 *     remonter le bon pays en tête de liste.
 *   - `home` : pays confirmé par la personne (« oui, c'est mon pays »). Lui
 *     seul autorise le raccourci qui saute la liste. Un clic d'exploration ne
 *     doit pas enfermer quelqu'un dans le mauvais pays, et un poste partagé en
 *     rédaction ne doit pas propager le choix du voisin.
 *
 * La mémoire locale reste un confort, jamais une source de vérité : elle
 * disparaît en navigation privée, à la purge du navigateur, au changement de
 * téléphone, et Safari efface le stockage des sites non installés après
 * environ sept jours sans visite — soit exactement le rythme d'un JT
 * hebdomadaire. Le support durable est l'URL personnelle `/journalistes/ga`
 * (voir lib/routing.js) ; ce module ne fait que lui éviter d'être ressaisie.
 */

const LAST_KEY = 'last_selected_country_id';
const HOME_KEY = 'reporter_home_country_id';

function read(key) {
  try {
    return (localStorage.getItem(key) || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function write(key, value) {
  try {
    if (value) localStorage.setItem(key, String(value).trim().toLowerCase());
    else localStorage.removeItem(key);
  } catch {
    /* stockage indisponible : on se rabat sur la liste complète */
  }
}

/** Dernier pays ouvert sur cet appareil, ou ''. */
export function readLastCountryId() {
  return read(LAST_KEY);
}

export function saveLastCountryId(countryId) {
  write(LAST_KEY, countryId);
}

/** Pays confirmé comme étant celui du correspondant, ou ''. */
export function readHomeCountryId() {
  return read(HOME_KEY);
}

export function saveHomeCountryId(countryId) {
  write(HOME_KEY, countryId);
}

export function forgetHomeCountry() {
  write(HOME_KEY, '');
}

/**
 * Résout un identifiant mémorisé en pays réellement existant. Un pays
 * personnalisé peut avoir été supprimé côté serveur, et un identifiant
 * recopié à la main peut ne correspondre à rien : dans les deux cas on
 * préfère la liste complète à un écran vide.
 */
export function resolveCountry(countries, countryId) {
  if (!countryId || !Array.isArray(countries)) return null;
  const wanted = String(countryId).trim().toLowerCase();
  return countries.find((c) => c && String(c.id).toLowerCase() === wanted) || null;
}
