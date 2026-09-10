import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import logger from '../logger/index.js';

/**
 * Lien personnel d'un correspondant.
 *
 * Il n'y a pas de compte sur cette plateforme, et ce n'est pas ce qu'on
 * ajoute ici : le jeton ne crée ni inscription, ni mot de passe, ni session.
 * Il dit seulement « ce lien a été émis pour telle personne, dans tel pays »,
 * et il est vérifiable sans rien stocker côté serveur au moment de la lecture.
 *
 * Forme : <payloadBase64Url>.<signatureBase64Url>, où le contenu signé est
 * { v, id, pays, nom, emisLe }. Court, collable dans WhatsApp, lisible dans
 * une barre d'adresse.
 *
 * Ce que ce jeton n'est PAS : un contrôle d'accès. L'API reste ouverte, par
 * décision produit, et un lien absent ou faux n'empêche personne d'envoyer.
 * Il sert à ATTRIBUER un envoi, pas à l'autoriser. Refermer l'accès serait un
 * autre chantier, à décider une fois les liens distribués.
 */

const VERSION = 1;

function secret() {
  // Sans secret configuré, la signature n'aurait aucune valeur : mieux vaut
  // ne poser aucune identité que d'en poser une que n'importe qui peut forger.
  return process.env.REPORTER_TOKEN_SECRET || '';
}

export function isReporterTokenConfigured() {
  return Boolean(secret());
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payloadB64) {
  return b64url(createHmac('sha256', secret()).update(payloadB64).digest());
}

/**
 * Émet un lien pour un correspondant.
 * @param {{pays: string, nom?: string, id?: string}} correspondant
 */
export function issueReporterToken({ pays, nom = '', id = '' }) {
  if (!secret()) return '';
  const payload = {
    v: VERSION,
    id: id || randomUUID(),
    pays: String(pays || '').trim().toLowerCase(),
    nom: String(nom || '').trim().slice(0, 60),
    emisLe: new Date().toISOString(),
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/**
 * Relit un jeton. Renvoie le correspondant, ou null — jeton absent, tronqué,
 * signé avec un autre secret, ou d'une version qu'on ne connaît pas.
 */
export function readReporterToken(token) {
  const secretValue = secret();
  if (!secretValue) return null;

  const raw = String(token || '').trim();
  if (!raw || raw.length > 2048) return null;

  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  // Comparaison à temps constant, sur des tampons de même taille : un
  // early-return sur des longueurs différentes laisserait fuiter la taille
  // de la signature attendue.
  let attendu;
  try {
    attendu = Buffer.from(sign(body));
  } catch {
    return null;
  }
  const recu = Buffer.from(signature);
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null;

  try {
    const payload = JSON.parse(unb64url(body).toString('utf-8'));
    if (payload?.v !== VERSION) return null;
    if (!payload.pays || !/^[a-z0-9-]{2,12}$/.test(payload.pays)) return null;
    return { id: payload.id || '', pays: payload.pays, nom: payload.nom || '', emisLe: payload.emisLe || '' };
  } catch (err) {
    logger.debug('Jeton correspondant illisible', { error: err.message });
    return null;
  }
}
