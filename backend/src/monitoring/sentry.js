import * as Sentry from '@sentry/node';
import { contexteRequete, expurgerEvenement } from './expurge.js';

/**
 * Le suivi des erreurs — et pourquoi il ne fonctionnait pas.
 *
 * L'INCIDENT
 * ----------
 * Ce fichier existait, `SENTRY_DSN` était documenté, et **aucune exception de
 * route n'arrivait chez Sentry.** Trois défauts empilés :
 *
 * 1. `getSentryErrorHandler()` testait `Sentry.Handlers`, retiré du SDK depuis
 *    la v8 (la version installée est une v10). Le test échouait toujours et la
 *    fonction retournait un passe-plat `(err, req, res, next) => next(err)`,
 *    qui ne rapporte rien.
 * 2. `initSentry(app)` appelait `setupExpressErrorHandler(app)` **avant** que
 *    les routes soient enregistrées. Express cherche les gestionnaires
 *    d'erreur *en avant* depuis la couche fautive : un gestionnaire posé en
 *    tête de pile n'est jamais atteint par une route déclarée deux cents
 *    lignes plus bas.
 * 3. `SENTRY_DSN` n'était pas transmis au conteneur : rien ne s'initialisait.
 *
 * Reproduit au banc avec un vrai point d'entrée Sentry local : la seule
 * enveloppe envoyée était un `client_report` sur des spans jetés. Pas un seul
 * événement d'erreur.
 *
 * CE QUI CHANGE
 * -------------
 * `initSentry()` ne fait plus qu'initialiser. Poser le gestionnaire est le
 * métier de `getSentryErrorHandler()`, que `app.js` appelle déjà au bon
 * endroit : après les routes et `notFoundMiddleware`, juste avant le
 * gestionnaire maison.
 */

/**
 * Initialise Sentry. Sans DSN, tout le module devient inerte — c'est le cas
 * courant en développement et en test.
 */
export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not set - error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      // **Aucune trace de performance.** Découvert au banc : les enveloppes de
      // type `transaction` emportent `request.headers` en clair — dont
      // `x-admin-password` — et `sendDefaultPii: false` ne les en retire pas.
      // Pire, `beforeSend` **ne s'applique pas aux transactions** : le
      // nettoyage écrit plus bas ne les voyait pas passer. Avec l'ancien
      // réglage (0,1 en production), une requête sur dix aurait expédié le mot
      // de passe de l'équipe chez un tiers.
      //
      // Le tracé coûte par ailleurs le quota : l'offre gratuite plafonne les
      // événements, et des transactions en volume feraient jeter les vraies
      // pannes. Ce qu'on attend de Sentry ici, c'est de savoir qu'un envoi a
      // échoué un samedi soir — pas de chronométrer des requêtes.
      tracesSampleRate: 0,
      // Pas de PII automatique (adresse IP, cookies, identité).
      sendDefaultPii: false,
      // Garde-fou si quelqu'un rallume le tracé un jour : les transactions
      // passent par leur propre crochet, jamais par `beforeSend`.
      beforeSendTransaction(event) {
        try {
          return expurgerEvenement(event);
        } catch {
          return null;
        }
      },
      beforeSend(event) {
        try {
          return expurgerEvenement(event);
        } catch {
          // Si l'expurgation échoue, on **abandonne l'envoi**. L'ancien code
          // laissait partir l'événement en l'état (« best effort ») : un
          // événement à moitié nettoyé peut encore porter le mot de passe
          // d'administration. Un rapport d'erreur perdu coûte moins cher
          // qu'un secret publié chez un tiers.
          return null;
        }
      },
    });
    console.log('✅ Sentry initialized');
  } catch (err) {
    console.error('⚠️ Sentry init failed:', err.message);
  }
}

/**
 * Capture une exception et l'envoie à Sentry.
 * @param {Error} error
 * @param {Object} context - étiquettes additionnelles
 */
export function captureException(error, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: context,
    });
  }
  console.error('❌ Exception:', error.message, context);
}

/**
 * Capture un message et l'envoie à Sentry.
 * @param {string} message
 * @param {string} level - info, warning, error
 * @param {Object} context
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
  console.log(`📝 [${level.toUpperCase()}] ${message}`, context);
}

/**
 * Le middleware d'erreur qui rapporte vraiment.
 *
 * **À enregistrer après les routes**, sinon il ne voit rien — c'est le défaut
 * numéro 2 ci-dessus. `app.js` le fait déjà.
 *
 * On capture nous-mêmes plutôt que de déléguer à `Sentry.expressErrorHandler()`,
 * pour deux raisons vérifiées au banc :
 *
 * - **Le SDK n'instrumente pas Express ici.** Depuis la v8, l'instrumentation
 *   automatique demande un fichier d'initialisation chargé par `--import` au
 *   démarrage de Node. Le backend n'en a pas, en test comme en production : le
 *   SDK l'annonce lui-même au démarrage, et les événements partaient sans
 *   aucune donnée de requête — ni méthode, ni chemin.
 * - **`withScope` isole.** Sans instrumentation il n'y a pas de portée par
 *   requête ; poser le contexte sur la portée courante le laisserait collé aux
 *   événements suivants. Une erreur du dimanche porterait le chemin du samedi.
 *
 * `doitRapporter` est explicite plutôt qu'hérité : seules les 5xx partent. Une
 * validation refusée est un 4xx, c'est-à-dire le fonctionnement normal de
 * l'application ; les laisser passer épuiserait le quota en bruit et noierait
 * les vraies pannes.
 */
export function doitRapporter(err) {
  const code = Number(err?.statusCode ?? err?.status ?? 500);
  return !Number.isFinite(code) || code >= 500;
}

export function getSentryErrorHandler() {
  if (!process.env.SENTRY_DSN) {
    return (err, req, res, next) => next(err);
  }
  return (err, req, res, next) => {
    try {
      if (doitRapporter(err)) {
        Sentry.withScope((portee) => {
          portee.setContext('requete', contexteRequete(req));
          Sentry.captureException(err);
        });
      }
    } catch {
      // Un rapporteur cassé ne doit jamais empêcher la réponse d'erreur de
      // partir : c'est la convention `useOptionalToast` côté studio, une
      // feuille n'abat pas son parent.
    }
    return next(err);
  };
}

export default { initSentry, captureException, captureMessage, getSentryErrorHandler, doitRapporter };
