/**
 * Ce qui ne doit jamais quitter la machine.
 *
 * Sentry est un sous-traitant tiers : ce qui part d'ici part chez lui, et n'en
 * revient pas. Deux familles sont à retenir, et elles n'empruntent pas le même
 * chemin.
 *
 * 1. **Les secrets.** Le mot de passe d'administration voyage dans l'en-tête
 *    `X-Admin-Password` — jamais dans une URL, c'est la règle posée avec les
 *    liens de correspondants — et d'anciennes formes passaient encore par la
 *    query string. Or un événement d'erreur emporte la requête qui l'a
 *    provoqué : sans expurgation, le mot de passe de l'équipe atterrit dans un
 *    tableau de bord tiers, et il y reste.
 *
 * 2. **Les adresses des correspondants.** Celles-là ne sont dans aucun
 *    en-tête : elles arrivent par le message de l'exception lui-même
 *    (« contact introuvable pour … »), par un corps de requête, par une
 *    miette de navigation. Ce sont les adresses de gens dans sept pays qui
 *    n'ont pas choisi Sentry. On les masque **partout** dans l'événement, à
 *    quelque profondeur qu'elles se trouvent.
 *
 * Module pur : aucune dépendance, aucune horloge, aucun accès réseau. Il se
 * teste comme des mathématiques, à la manière de `semaine.js`.
 */

export const REMPLACEMENT = '[expurgé]';

/** Les en-têtes qui portent un secret, et qui ne partent donc jamais tels quels. */
export const EN_TETES_SENSIBLES = /^(x-app-password|x-admin-password|x-worker-key|authorization|cookie|set-cookie)$/i;

/** Les paramètres de query string hérités qui portaient un mot de passe. */
export const PARAMS_SENSIBLES = /(adminPassword|appPassword|pwd|password|dl_token|token)=[^&]*/gi;

/**
 * Forme d'une adresse électronique. Volontairement large du côté gauche : on
 * préfère masquer un peu trop qu'une adresse de trop.
 */
export const EXPRESSION_ADRESSE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** Masque les adresses électroniques d'un texte. */
export function masquerAdresses(texte) {
  if (typeof texte !== 'string') return texte;
  return texte.replace(EXPRESSION_ADRESSE, '[adresse expurgée]');
}

/** Masque les mots de passe qui traînent dans une query string. */
export function masquerParams(chaine) {
  if (typeof chaine !== 'string') return chaine;
  return chaine.replace(PARAMS_SENSIBLES, `$1=${REMPLACEMENT}`);
}

/**
 * Parcourt une valeur de part en part et masque les adresses de toutes les
 * chaînes qu'elle contient. Mute sur place — c'est ce qu'attend `beforeSend`.
 * Les cycles sont gardés : un événement Sentry en contient.
 */
export function expurgerProfond(valeur, vus = new WeakSet()) {
  if (typeof valeur === 'string') return masquerAdresses(valeur);
  if (!valeur || typeof valeur !== 'object') return valeur;
  if (vus.has(valeur)) return valeur;
  vus.add(valeur);

  if (Array.isArray(valeur)) {
    for (let i = 0; i < valeur.length; i += 1) valeur[i] = expurgerProfond(valeur[i], vus);
    return valeur;
  }
  for (const cle of Object.keys(valeur)) {
    valeur[cle] = expurgerProfond(valeur[cle], vus);
  }
  return valeur;
}

/**
 * Expurge un événement Sentry complet : d'abord les en-têtes et la query
 * string, qui portent les secrets, puis les adresses partout ailleurs.
 *
 * Lève si l'événement résiste (propriété en lecture seule, accesseur qui
 * jette). C'est voulu : l'appelant doit alors **abandonner l'envoi** plutôt que
 * de laisser partir un événement à moitié nettoyé. Un rapport d'erreur perdu
 * coûte moins cher qu'un mot de passe publié.
 */
export function expurgerEvenement(evenement) {
  if (!evenement || typeof evenement !== 'object') return evenement;

  const requete = evenement.request;
  if (requete && typeof requete === 'object') {
    const entetes = requete.headers;
    if (entetes && typeof entetes === 'object') {
      for (const cle of Object.keys(entetes)) {
        if (EN_TETES_SENSIBLES.test(cle)) entetes[cle] = REMPLACEMENT;
      }
    }
    requete.query_string = masquerParams(requete.query_string);
    requete.url = masquerParams(requete.url);
  }

  return expurgerProfond(evenement);
}

/**
 * Le contexte de requête qui accompagne un rapport d'erreur.
 *
 * **On choisit ce qui part, plutôt que d'expurger ce qu'un SDK a décidé de
 * prendre.** C'est la discipline déjà appliquée par `errorHandlerMiddleware`,
 * qui journalise `req.path` et jamais `req.originalUrl` : la query string peut
 * porter un jeton de téléchargement, et un en-tête porte le mot de passe
 * d'administration. Ni l'un ni l'autre ne sortent d'ici.
 *
 * Une erreur sans sa requête est difficile à exploiter — on garde donc de quoi
 * la situer : la méthode, le chemin, le fait qu'il y avait des paramètres, et
 * le navigateur.
 */
export function contexteRequete(req) {
  if (!req || typeof req !== 'object') return {};
  const url = typeof req.url === 'string' ? req.url : '';
  let agent = '';
  try {
    agent = (typeof req.get === 'function' ? req.get('user-agent') : req.headers?.['user-agent']) || '';
  } catch { agent = ''; }
  return {
    methode: req.method || '',
    // Le chemin seul. La query string reste dehors, jeton compris.
    chemin: req.path || url.split('?')[0] || '',
    avecParametres: url.includes('?'),
    navigateur: String(agent).slice(0, 200),
  };
}

export default { contexteRequete, expurgerEvenement, expurgerProfond, masquerAdresses, masquerParams };
