import { Router } from 'express';
import * as Sentry from '@sentry/node';
import logger from '../logger/index.js';
import { contexteRequete, masquerAdresses } from '../monitoring/expurge.js';

/**
 * Les plantages du studio, relayés par votre propre serveur.
 *
 * POURQUOI PAS `@sentry/react`
 * ----------------------------
 * `VITE_SENTRY_DSN` était documenté dans trois fichiers et **aucun code Sentry
 * n'existait côté navigateur** : une variable fantôme de plus, exactement le
 * défaut que les lots précédents ont passé leur temps à débusquer.
 *
 * Plutôt que d'installer le SDK navigateur, le studio signale à son propre
 * backend, qui relaie. Cela évite un script tiers chargé chez chaque monteur,
 * un second projet à surveiller, et du poids dans un paquet qui voyage
 * jusqu'à des connexions médiocres. Les données ne quittent pas le poste du
 * monteur vers un tiers : elles passent par le serveur de l'association.
 *
 * CE QUE LA ROUTE ACCEPTE
 * -----------------------
 * Elle est **volontairement non authentifiée** : un plantage peut survenir
 * avant même l'écran de connexion, et c'est souvent là que ça compte. Ce qui
 * arrive ici est donc hostile par construction — borné, tronqué, expurgé, et
 * limité en débit (`signalementLimiter`), sans quoi un navigateur coincé dans
 * une boucle de plantage remplirait le quota Sentry à lui seul.
 *
 * Elle répond toujours 204 : le studio ne doit jamais dépendre de cette
 * réponse pour afficher son écran d'erreur.
 */

const BORNES = { message: 500, pile: 4000, composant: 200, chemin: 300 };
const LANGUES = new Set(['fr', 'en']);

// Marge de découpe avant expurgation. Une adresse RFC 5321 fait au plus 254
// caractères : en coupant un peu plus loin que la borne, une adresse à cheval
// sur celle-ci est présente en entier au moment du masquage, et ne peut donc
// pas survivre en morceaux.
const MARGE = 320;

/**
 * On tronque **avant** d'expurger, pas après.
 *
 * L'ordre inverse faisait parcourir les deux mégaoctets que le corps peut
 * porter pour n'en garder que quatre kilo-octets. C'est le travail inutile qui
 * a fait expirer un test en intégration continue, et c'est surtout un chemin
 * non authentifié : le coût doit être borné par ce qu'on garde, pas par ce
 * qu'on reçoit.
 */
const borner = (valeur, max) => (typeof valeur === 'string'
  ? masquerAdresses(valeur.slice(0, max + MARGE)).slice(0, max)
  : '');

/**
 * Normalise un signalement reçu du navigateur. Fonction pure : elle se teste
 * comme des mathématiques, et c'est elle qui porte toute la défense.
 */
export function nettoyerSignalement(corps) {
  const brut = corps && typeof corps === 'object' && !Array.isArray(corps) ? corps : {};
  // Le chemin seul, jamais la query string : elle peut porter un jeton de
  // téléchargement. Même discipline qu'`errorHandlerMiddleware`.
  const chemin = borner(brut.url, BORNES.chemin).split('?')[0].split('#')[0];
  return {
    message: borner(brut.message, BORNES.message),
    pile: borner(brut.stack, BORNES.pile),
    composant: borner(brut.composant, BORNES.composant),
    chemin,
    langue: LANGUES.has(brut.langue) ? brut.langue : '',
  };
}

const router = Router();

router.post('/', (req, res) => {
  const signalement = nettoyerSignalement(req.body);

  // Un signalement sans message ne dit rien : on l'avale sans bruit plutôt que
  // d'encombrer le journal.
  if (!signalement.message) return res.status(204).end();

  logger.warn('[studio] plantage signalé par le navigateur', { context: signalement });

  if (process.env.SENTRY_DSN) {
    try {
      Sentry.withScope((portee) => {
        portee.setLevel('error');
        portee.setTag('source', 'studio');
        portee.setContext('studio', signalement);
        portee.setContext('requete', contexteRequete(req));
        Sentry.captureMessage(`studio : ${signalement.message}`, 'error');
      });
    } catch {
      // Un rapporteur cassé ne doit pas transformer un plantage du studio en
      // panne du serveur.
    }
  }

  return res.status(204).end();
});

export default router;
