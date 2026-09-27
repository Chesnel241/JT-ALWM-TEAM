import { createErrors, AppError } from './errorHandler.js';
import { creerCompteur, estBloque, noterEchec, secondesRestantes, MAX_ECHECS } from './echecsAdmin.js';
import logger from '../logger/index.js';
import { timingSafeEqual, createHash } from 'crypto';
import { readReporterToken } from '../lib/reporterToken.js';

const IS_TEST = process.env.NODE_ENV === 'test';

// Mêmes règles que routes/auth.js : NFC + retrait des caractères invisibles
// (NBSP, ZW*, BOM) + trim + lowercase (décision : login insensible à la
// casse pour les pays qui tapent en majuscules sur mobile). Aligne le
// comparateur sur le format normalisé que le frontend envoie après login.
// Exportée pour les vérifications hors middleware (TUS notamment).
export function normalizeToken(s) {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFC')
    .replace(/[\u0009\u00A0\u1680\u2000-\u200D\u202F\u205F\u2060\u3000\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

// Comparaison à temps constant (anti-timing-attack). On hache les deux entrées
// en SHA-256 (32 octets fixes) AVANT timingSafeEqual : ça élimine l'oracle de
// longueur (un early-return sur des Buffer de tailles différentes laisserait
// fuiter la longueur du secret par timing). Exportée pour les vérifications
// admin hors middleware (app.js, routes/uploads.js).
export function safeEqual(a, b) {
  if (a == null || b == null) return false;
  const hashA = createHash('sha256').update(String(a)).digest();
  const hashB = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(hashA, hashB);
}

// Mot de passe global de session RETIRÉ intentionnellement (décision produit :
// la plateforme n'a plus besoin d'un mot de passe partagé pour les
// correspondants). Le check est supprimé ici EN CODE, pas seulement en
// laissant GLOBAL_PASSWORD vide en .env : une variable restaurée par
// erreur dans le .env ne doit plus jamais pouvoir rouvrir cette porte
// toute seule (avant : un ancien garde fail-closed refusait même de
// démarrer le serveur en prod si la variable était absente).
// requireAdmin (ADMIN_PASSWORD) reste inchangé : c'est une protection
// distincte pour les actions d'équipe montage, hors du périmètre de ce
// retrait. Pour réintroduire un mot de passe de session, il faudra
// réécrire cette fonction (voir l'historique git pour l'ancienne logique).
export function requireAuth(req, res, next) {
  return next();
}

// Les valeurs d'exemple de `.env.example` et `DEPLOY_VPS.md`. Elles sont
// publiques — elles sont dans le dépôt — et ne doivent jamais rien protéger :
// un serveur qui les garde est traité comme un serveur SANS mot de passe
// montage, c'est-à-dire qui refuse toutes les actions de l'équipe.
const VALEURS_EXEMPLE = new Set(
  ['change-me-admin-immediately', 'change-me-immediately', 'change-me', 'changeme'].map(normalizeToken)
);

/**
 * Le mot de passe montage configuré, normalisé — ou `''` s'il est absent ou
 * laissé à sa valeur d'exemple.
 *
 * Relu à chaque appel, comme avant : il doit pouvoir changer par simple
 * redémarrage, et les tests le basculent d'un bloc à l'autre.
 */
export function motDePasseAdmin() {
  const attendu = normalizeToken(process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD) : '');
  return attendu && !VALEURS_EXEMPLE.has(attendu) ? attendu : '';
}

const compteurEchecs = creerCompteur({
  max: Number(process.env.ADMIN_ECHECS_MAX) || MAX_ECHECS,
});

/**
 * Vrai si l'adresse ne désigne pas un visiteur identifiable : réseau privé,
 * réseau Docker, boucle locale, lien local — ou pas d'adresse du tout.
 *
 * Une limite par adresse ne vaut que si l'adresse est celle du visiteur.
 * Derrière un relais mal déclaré (`TRUST_PROXY`), le serveur voit l'adresse
 * interne du relais, la même pour tout le monde : compter les échecs sous
 * cette clé revient à laisser n'importe qui bloquer toute l'équipe.
 */
export function estAdresseInterne(adresse) {
  let a = String(adresse || '').trim().toLowerCase();
  if (a.startsWith('::ffff:')) a = a.slice(7);
  if (!a) return true;
  return /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)
    || a === '::1'
    || /^f[cd][0-9a-f]{0,2}:/.test(a)
    || /^fe[89ab][0-9a-f]?:/.test(a);
}

let adresseInterneSignalee = false;

function signalerAdresseInterne(adresse) {
  if (adresseInterneSignalee) return;
  adresseInterneSignalee = true;
  logger.warn(
    'Mot de passe montage : le serveur voit une adresse interne au lieu de celle du visiteur. '
    + 'La limite d’essais est suspendue tant que TRUST_PROXY n’est pas réglé (DEPLOY_VPS.md §13).',
    { context: { ip: String(adresse || '') } }
  );
}

/**
 * LE point de vérification du mot de passe montage.
 *
 * Il y en avait cinq — `requireAdmin`, `estRedaction`, `/check-admin`, TUS et
 * le téléchargement du Mot du JT — chacun avec sa lecture de la variable, et
 * l'un d'eux sensible à la casse quand les autres ne l'étaient pas.
 *
 * Elle vérifie, et ne compte RIEN : compter est l'affaire de
 * `noterEchecAdmin`, appelée seulement là où quelqu'un ESSAIE un mot de passe.
 *
 * L'INCIDENT : elle comptait elle-même chaque échec. Or l'envoi d'un
 * correspondant transportait, dans ses métadonnées TUS, l'ancien mot de passe
 * global resté dans son navigateur — un « échec » par vidéo. Vingt envois un
 * dimanche, et l'équipe montage trouvait l'espace montage fermé, avec le bon
 * mot de passe.
 *
 * @returns {{verdict: 'ok'|'faux'|'absent'|'bloque'|'non-configure', attente: number}}
 *   `attente` : secondes avant de pouvoir réessayer, quand `bloque`.
 */
export function verifierMotDePasseAdmin(fourni, adresse, maintenant = Date.now()) {
  const attendu = motDePasseAdmin();
  if (!attendu) return { verdict: 'non-configure', attente: 0 };
  const token = normalizeToken(typeof fourni === 'string' ? fourni : '');
  if (!token) return { verdict: 'absent', attente: 0 };
  const cle = String(adresse || '');
  if (!estAdresseInterne(cle) && estBloque(compteurEchecs, cle, maintenant)) {
    return { verdict: 'bloque', attente: secondesRestantes(compteurEchecs, cle, maintenant) };
  }
  return { verdict: safeEqual(token, attendu) ? 'ok' : 'faux', attente: 0 };
}

/**
 * Compte un échec — seulement pour une vraie tentative : l'écran de
 * connexion de l'espace montage (`/check-admin`) et les actions réservées
 * (`requireAdmin`). Jamais sur une adresse interne (voir plus haut).
 */
export function noterEchecAdmin(adresse, maintenant = Date.now()) {
  const cle = String(adresse || '');
  if (estAdresseInterne(cle)) {
    signalerAdresseInterne(cle);
    return false;
  }
  noterEchec(compteurEchecs, cle, maintenant);
  return true;
}

const VERDICT = Symbol('verdictMotDePasseAdmin');
const COMPTE = Symbol('echecCompte');

/**
 * Le verdict pour une requête Express, calculé une seule fois : plusieurs
 * gardes lisent le même en-tête au cours d'une même requête.
 *
 * `compter` : cette garde reçoit une vraie tentative. Un mauvais mot de passe
 * n'est alors compté qu'une fois par requête, quel que soit le nombre de
 * gardes qui le lisent. Les autres — la portée, le téléchargement du Mot du
 * JT — se contentent de savoir si c'est la rédaction.
 */
export function verdictAdmin(req, { compter = false } = {}) {
  if (!req) return { verdict: 'absent', attente: 0 };
  if (!req[VERDICT]) {
    const fourni = typeof req.header === 'function' ? req.header('x-admin-password') : undefined;
    req[VERDICT] = verifierMotDePasseAdmin(fourni, req.ip);
  }
  if (compter && req[VERDICT].verdict === 'faux' && !req[COMPTE]) {
    req[COMPTE] = true;
    noterEchecAdmin(req.ip);
  }
  return req[VERDICT];
}

/** L'erreur rendue à une adresse qui a épuisé ses essais. */
export function erreurTropDEssais(attente) {
  const minutes = Math.max(1, Math.ceil(attente / 60));
  return new AppError(
    'Too many admin password failures',
    429,
    `Trop d'essais du mot de passe montage. Réessayez dans ${minutes} min.`
  );
}

export function requireAdmin(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (IS_TEST) return next();

  const { verdict, attente } = verdictAdmin(req, { compter: true });
  if (verdict === 'ok') return next();

  if (verdict === 'non-configure') {
    logger.warn('Action montage refusée : ADMIN_PASSWORD absent ou laissé à sa valeur d’exemple.');
    return next(createErrors.forbidden(
      'Action non configurée : le mot de passe montage est absent du serveur, ou laissé à sa valeur d’exemple.'
    ));
  }

  if (verdict === 'bloque') {
    logger.warn('Mot de passe montage : adresse bloquée après trop d’échecs', {
      context: { path: req.path, ip: req.ip },
    });
    res.set('Retry-After', String(attente));
    return next(erreurTropDEssais(attente));
  }

  logger.warn('Admin authentication failed: Invalid or missing X-Admin-Password', {
    context: { path: req.path, ip: req.ip },
  });
  return next(createErrors.forbidden('Mot de passe administrateur incorrect ou manquant'));
}

/**
 * Lit le lien personnel s'il y en a un, et pose `req.correspondant`.
 *
 * Délibérément non bloquant : l'API reste ouverte, par décision produit. Ce
 * middleware ATTRIBUE un envoi à quelqu'un quand c'est possible ; il n'en
 * refuse aucun. Un jeton absent, expiré d'usage ou falsifié laisse simplement
 * `req.correspondant` à null, et tout continue comme avant.
 *
 * Le nom `requireReporter` a été écarté exprès : il aurait laissé croire à
 * une garde. C'est `readReporter`.
 */
export function readReporter(req, _res, next) {
  const brut = req.header('x-reporter-token') || req.query?.k || '';
  const correspondant = readReporterToken(brut);
  req.correspondant = correspondant;
  return next();
}
