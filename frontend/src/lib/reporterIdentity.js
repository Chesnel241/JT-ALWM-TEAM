/**
 * Identité du correspondant, portée par son lien personnel.
 *
 * Le jeton arrive une fois dans l'URL (`?k=…`), on le range, et il est renvoyé
 * à chaque appel. Il n'ouvre aucune porte : l'API reste accessible sans lui.
 * Il sert à ATTRIBUER un envoi à quelqu'un — qui a envoyé quoi, à qui écrire,
 * qui relancer — là où la plateforme ne savait rien de personne.
 *
 * Rangé par appareil, comme le pays : le même lien collé sur deux téléphones
 * fait deux appareils qui se savent tous deux le correspondant du pays, ce qui
 * est le comportement voulu pour une équipe qui se partage un poste.
 */

const KEY = 'reporter_token';

export function readReporterToken() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function saveReporterToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le jeton vaut pour la page en cours */
  }
}

export function forgetReporterToken() {
  saveReporterToken('');
}

/**
 * Récupère le jeton d'une URL et le range. Renvoie true si un jeton neuf
 * vient d'être adopté, pour que l'appelant nettoie la barre d'adresse : un
 * secret porteur n'a rien à faire dans un lien qu'on recopie ou partage.
 */
export function adoptTokenFromSearch(search) {
  const raw = String(search || '');
  if (!raw.includes('k=')) return false;
  try {
    const value = new URLSearchParams(raw).get('k');
    const clean = String(value || '').trim();
    if (!clean) return false;
    saveReporterToken(clean);
    return true;
  } catch {
    return false;
  }
}
