/**
 * Brouillons locaux des textes longs.
 *
 * Les fichiers savent déjà reprendre à l'octet près après une coupure ; les
 * textes, non. Le conducteur du journal se tape dans une grande zone de
 * saisie, et un onglet fermé ou une page rechargée suffisait à tout perdre.
 *
 * Un brouillon est gardé dans le navigateur de la personne, en plus de
 * l'enregistrement serveur. Il ne remplace pas ce dernier : il couvre les
 * quelques secondes entre deux enregistrements, et le cas où le réseau n'est
 * pas là du tout.
 *
 * `localStorage` peut lever (navigation privée, stockage plein, réglages
 * d'entreprise) : l'absence de brouillon est un cas NORMAL, jamais une
 * erreur. Chaque accès est protégé, et l'écran doit fonctionner sans.
 */

const PREFIXE = 'jt-brouillon:';

// Au-delà, le brouillon parle d'une semaine qui n'est plus à l'antenne :
// le proposer ferait ressortir un texte périmé au mauvais moment.
const DUREE_VIE_MS = 7 * 24 * 60 * 60 * 1000;

function cleComplete(cle) {
  return `${PREFIXE}${cle}`;
}

/** Le brouillon gardé pour cette clé, ou `null` s'il n'y en a pas d'utilisable. */
export function lireBrouillon(cle) {
  if (!cle) return null;
  try {
    const brut = localStorage.getItem(cleComplete(cle));
    if (!brut) return null;
    const contenu = JSON.parse(brut);
    if (!contenu || typeof contenu.valeurs !== 'object' || !contenu.valeurs) return null;
    const le = Date.parse(contenu.le);
    if (!Number.isFinite(le) || Date.now() - le > DUREE_VIE_MS) {
      effacerBrouillon(cle);
      return null;
    }
    return { valeurs: contenu.valeurs, le: contenu.le };
  } catch {
    return null;
  }
}

/**
 * Garde un brouillon. Rend `true` s'il a pu être écrit — l'appelant s'en sert
 * pour ne promettre « brouillon gardé » que quand c'est vrai.
 */
export function ecrireBrouillon(cle, valeurs) {
  if (!cle || !valeurs || typeof valeurs !== 'object') return false;
  try {
    localStorage.setItem(cleComplete(cle), JSON.stringify({
      valeurs,
      le: new Date().toISOString(),
    }));
    return true;
  } catch {
    // Quota atteint ou stockage refusé : on ne casse rien, la saisie
    // continue et l'enregistrement serveur reste le vrai filet.
    return false;
  }
}

export function effacerBrouillon(cle) {
  if (!cle) return;
  try {
    localStorage.removeItem(cleComplete(cle));
  } catch {
    // Rien à faire : un brouillon qu'on n'arrive pas à effacer expirera seul.
  }
}

/**
 * Retire les brouillons périmés. Appelé à l'ouverture d'un écran de saisie,
 * pour que le stockage d'un téléphone modeste ne se remplisse pas de textes
 * de semaines passées.
 */
export function purgerBrouillons(maintenant = Date.now()) {
  let retires = 0;
  try {
    const aRetirer = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const cle = localStorage.key(i);
      if (!cle || !cle.startsWith(PREFIXE)) continue;
      try {
        const contenu = JSON.parse(localStorage.getItem(cle) || 'null');
        const le = Date.parse(contenu?.le);
        if (!Number.isFinite(le) || maintenant - le > DUREE_VIE_MS) aRetirer.push(cle);
      } catch {
        // Entrée illisible : c'est justement ce qu'il faut retirer.
        aRetirer.push(cle);
      }
    }
    for (const cle of aRetirer) {
      localStorage.removeItem(cle);
      retires += 1;
    }
  } catch {
    return 0;
  }
  return retires;
}

/** Clé stable d'une rubrique pour une semaine donnée. */
export function cleRubrique(weekId, rubrique) {
  return `rubrique:${weekId || 'sans-semaine'}:${rubrique || 'inconnue'}`;
}
