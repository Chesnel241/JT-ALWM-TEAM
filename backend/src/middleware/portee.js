/**
 * Portée d'un appel : qui a le droit de toucher à quel pays.
 *
 * Jusqu'ici le lien personnel ATTRIBUAIT un envoi sans rien autoriser, et
 * l'API restait ouverte à qui connaissait une URL (voir lib/reporterToken.js).
 * Ce module transforme ce lien en frontière : un correspondant agit sur son
 * pays, la rédaction sur tous, et un inconnu sur aucun.
 *
 * LE CRAN, PAS L'INTERRUPTEUR. Les liens se distribuent un par un, par
 * WhatsApp. Fermer d'un coup couperait chaque correspondant qui n'a pas
 * encore reçu le sien, un dimanche après-midi, en pleine collecte. D'où
 * REPORTER_ACCESS :
 *
 *   observe (défaut) — ne refuse rien, compte ce qu'il aurait refusé. Déployer
 *                      ne change donc rien pour personne ; on mesure d'abord
 *                      (GET /api/liens/etat dit quels pays sont encore
 *                      anonymes), on bascule ensuite.
 *   strict          — refuse pour de bon.
 *   ouvert          — court-circuite tout calcul : marche arrière immédiate,
 *                      sans redéploiement de code.
 *
 * Un seul chemin de décision mène aux trois issues : jamais deux logiques
 * parallèles qui finiraient par diverger.
 */

import { createErrors } from './errorHandler.js';
import { safeEqual, normalizeToken } from './auth.js';
import { COUNTRIES } from '../data/constants.js';
import { estRubrique, trouverRubrique } from '../data/rubriques.js';
import { getCustomCountries } from '../data/store.js';
import { noteAcces, DECISIONS } from '../services/porteeStats.js';

export const NIVEAUX = Object.freeze({
  OUVERT: 'ouvert',
  OBSERVE: 'observe',
  STRICT: 'strict',
});

/**
 * Les deux rubriques du journal — le conducteur et le Mot du JT — ne sont
 * pas des pays, et n'appartiennent donc à aucun correspondant en
 * particulier. Décision produit : **tout correspondant identifié** peut les
 * remplir ; un inconnu, non.
 *
 * Elles étaient auparavant traitées comme des chutiers réservés à la
 * rédaction, ce qui les rendait inaccessibles à celui qui rédige le
 * conducteur.
 */

// Relu à chaque appel, comme ADMIN_PASSWORD dans requireAdmin : le cran doit
// pouvoir changer par simple redémarrage, et les tests le basculent d'un bloc
// à l'autre.
export function niveauAcces() {
  const brut = String(process.env.REPORTER_ACCESS || '').trim().toLowerCase();
  if (brut === NIVEAUX.OUVERT || brut === NIVEAUX.STRICT) return brut;
  return NIVEAUX.OBSERVE;
}

/**
 * Vrai si l'appel porte le mot de passe de l'équipe montage.
 *
 * Mêmes règles de normalisation que `requireAdmin` (auth.js) : sans ça, un
 * NBSP en bord d'ADMIN_PASSWORD ferait diverger deux gardes censées dire la
 * même chose. Pas de dérogation en mode test — la garde doit se comporter
 * ici exactement comme en production.
 */
export function estRedaction(req) {
  const attendu = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : '';
  if (!attendu) return false;
  const fourni = typeof req?.header === 'function' ? req.header('x-admin-password') : null;
  if (!fourni) return false;
  return safeEqual(normalizeToken(fourni), normalizeToken(attendu));
}

function nomPays(id) {
  const cible = String(id || '').trim().toLowerCase();
  if (!cible) return '';
  const connu = COUNTRIES.find((c) => c.id === cible);
  if (connu) return connu.name;
  try {
    const extra = getCustomCountries().find((c) => c.id === cible);
    if (extra) return extra.name;
  } catch {
    // Store indisponible : le code du pays reste un repère suffisant.
  }
  return cible;
}

function refus(message, code) {
  const err = createErrors.forbidden(message);
  // `code` remonte tel quel dans le corps JSON (errorHandler.js) : le
  // frontend peut ainsi présenter une explication plutôt qu'une panne.
  err.code = code;
  return err;
}

function messageRefus({ decision, rubrique, pays, paysDuLien }) {
  if (rubrique) {
    const nom = trouverRubrique(pays)?.nom || 'Cette rubrique';
    return `${nom} demande votre lien personnel. Demandez-le à la rédaction : n'importe lequel convient, cette rubrique n'appartient à aucun pays.`;
  }
  if (decision === DECISIONS.HORS_PAYS) {
    return `Votre lien personnel est celui du pays « ${nomPays(paysDuLien)} » : il ne donne pas accès aux reportages du pays « ${nomPays(pays)} ». Demandez le bon lien à la rédaction.`;
  }
  return `Cette page demande votre lien personnel. Demandez-le à la rédaction : il vous ouvrira les reportages du pays « ${nomPays(pays)} ».`;
}

/**
 * Le cœur de la décision, sans Express : TUS ne passe pas par les
 * middlewares (il est monté avant eux, les body-parsers casseraient le
 * protocole) et doit pourtant appliquer exactement la même règle. Tout
 * passe donc par ici — une seule logique, deux points d'entrée.
 *
 * @param {{redaction: boolean, correspondant: ?object, pays: string, chemin?: string}} appel
 * @returns {{autorise: boolean, decision: string, erreur: ?Error}}
 *   `autorise` tient déjà compte du cran : en `observe` il vaut toujours
 *   vrai, et la décision a néanmoins été comptée.
 */
export function evaluerPortee({ redaction, correspondant, pays, chemin }) {
  const niveau = niveauAcces();
  const cible = String(pays || '').trim().toLowerCase();

  if (niveau === NIVEAUX.OUVERT || !cible) {
    return { autorise: true, decision: null, erreur: null };
  }

  const verdict = deciderPays({ redaction, correspondant, pays: cible });
  noteAcces(cible, verdict.decision, {
    niveau,
    paysDuLien: verdict.paysDuLien,
    chemin,
  });

  const admis = verdict.decision === DECISIONS.REDACTION || verdict.decision === DECISIONS.IDENTIFIE;
  if (admis || niveau === NIVEAUX.OBSERVE) {
    return { autorise: true, decision: verdict.decision, erreur: null };
  }

  return {
    autorise: false,
    decision: verdict.decision,
    erreur: refus(messageRefus({ ...verdict, pays: cible }), 'PORTEE_PAYS'),
  };
}

function deciderPays({ redaction, correspondant, pays }) {
  if (redaction) return { decision: DECISIONS.REDACTION };

  const lien = correspondant || null;

  // Une rubrique du journal n'est le pays de personne : il suffit d'être
  // identifié, quel que soit le pays de son lien.
  if (estRubrique(pays)) {
    return lien
      ? { decision: DECISIONS.IDENTIFIE }
      : { decision: DECISIONS.ANONYME, rubrique: true };
  }

  if (!lien) return { decision: DECISIONS.ANONYME };
  if (lien.pays === pays) return { decision: DECISIONS.IDENTIFIE };
  return { decision: DECISIONS.HORS_PAYS, paysDuLien: lien.pays };
}

const paysDepuisParams = (req) => req?.params?.countryId;

/**
 * Réserve la route au pays du correspondant, ou à la rédaction.
 *
 * @param {(req) => string} [resolveur] — où lire le pays. Par défaut
 *   `req.params.countryId` ; quelques routes le portent dans le corps.
 */
export function porteeCountry(resolveur = paysDepuisParams) {
  return function gardePays(req, res, next) {
    if (req.method === 'OPTIONS') return next();

    // Pays illisible : ce n'est pas à la portée de trancher. La route valide
    // déjà ses paramètres et répondra 400/404 d'elle-même.
    const { autorise, erreur } = evaluerPortee({
      // `req.accesRedaction` est posé par un middleware amont qui a déjà
      // établi le droit autrement — un jeton de téléchargement signé, pour
      // une URL ouverte par le navigateur, qui ne peut porter aucun en-tête.
      redaction: estRedaction(req) || req.accesRedaction === true,
      correspondant: req.correspondant,
      pays: resolveur(req),
      chemin: req.path,
    });

    return autorise ? next() : next(erreur);
  };
}

/**
 * Réserve la route à la rédaction. Sert aux vues transversales — la semaine
 * entière, le projet de montage, les statistiques — qu'aucun correspondant
 * n'a de raison de lire.
 */
export function porteeRedaction() {
  return function gardeRedaction(req, res, next) {
    if (req.method === 'OPTIONS') return next();

    const niveau = niveauAcces();
    if (niveau === NIVEAUX.OUVERT) return next();
    if (estRedaction(req)) return next();

    const lien = req.correspondant || null;
    noteAcces(lien?.pays || '(transversal)', lien ? DECISIONS.HORS_PAYS : DECISIONS.ANONYME, {
      niveau,
      paysDuLien: lien?.pays || null,
      chemin: req.path,
    });

    if (niveau === NIVEAUX.OBSERVE) return next();

    return next(refus(
      'Cet écran est réservé à l\'équipe de rédaction. Votre lien personnel ouvre les reportages de votre pays, pas la semaine entière.',
      'PORTEE_REDACTION',
    ));
  };
}
