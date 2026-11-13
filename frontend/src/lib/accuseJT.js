/**
 * Les vues du JT, pays par pays — anonymes.
 *
 * LE BESOIN : la rédaction publie le JT sans savoir s'il est regardé, ni où.
 * Chaque appareil signale une fois qu'il a regardé (ou téléchargé) un JT, avec
 * pour seule information le pays : aucun identifiant, aucun nom, aucun
 * numéro. Le serveur ne garde qu'un compte par pays.
 */
import { api } from '../api/index.js';

const CLE_ACCUSES = 'jt-accuses';
const CLE_PAYS_SESSION = 'jt-pays-session';

/** L'espace du pays ouvert dans cet onglet : c'est le pays de la personne. */
export function memoriserPaysSession(countryId) {
  try { sessionStorage.setItem(CLE_PAYS_SESSION, String(countryId || '')); } catch { /* sans stockage, « inconnu » */ }
}

/**
 * Le pays de cet appareil : l'espace ouvert dans cet onglet, sinon le seul
 * pays dont un numéro WhatsApp est enregistré ici. Sinon rien (« inconnu »
 * côté serveur) ; le lien personnel, quand il y en a un, l'emporte de toute
 * façon côté serveur.
 */
export function paysDeLAppareil() {
  try {
    const session = sessionStorage.getItem(CLE_PAYS_SESSION);
    if (session) return session;
    const pays = Object.keys(localStorage)
      .filter((k) => k.startsWith('uploader_phone_') && localStorage.getItem(k))
      .map((k) => k.slice('uploader_phone_'.length));
    return pays.length === 1 ? pays[0] : '';
  } catch {
    return '';
  }
}

const lire = () => {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_ACCUSES) || '[]');
    return new Set(Array.isArray(brut) ? brut : []);
  } catch {
    return new Set();
  }
};

/**
 * Signale une lecture ou un téléchargement, une seule fois par appareil et
 * par JT. Ne lève jamais : un accusé perdu ne gêne personne.
 */
export function accuserJT(weekId, fichier, type = 'lecture') {
  if (!weekId || !fichier?.id) return false;
  const cle = `${fichier.id}:${type}`;
  const deja = lire();
  if (deja.has(cle)) return false;
  deja.add(cle);
  try { localStorage.setItem(CLE_ACCUSES, JSON.stringify([...deja].slice(-100))); } catch { /* il repartira peut-être une fois de plus */ }
  api.signalerVueJT?.(weekId, fichier.id, paysDeLAppareil(), type)?.catch?.(() => {});
  return true;
}
