/**
 * Le sommaire horodaté d'un JT : où commence chaque partie.
 *
 * Il vient du navigateur (calculé depuis le déroulé au moment de lancer le
 * rendu) : il n'est jamais repris tel quel. Seuls des instants bornés et des
 * titres courts, en texte simple, survivent — le sommaire s'affiche chez tous
 * les correspondants et se recopie dans une description YouTube ou Facebook.
 */

export const MAX_CHAPITRES = 60;
export const TITRE_MAX = 120;
const INSTANT_MAX = 36000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Caractères de contrôle et marques de direction (qui retourneraient une
// ligne à l'affichage) : rien de cela n'a sa place dans un titre.
const INVISIBLES = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

const nettoyerTitre = (valeur) => String(valeur ?? '')
  .replace(INVISIBLES, ' ')
  .replace(/[<>]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, TITRE_MAX)
  .trim();

/**
 * @param brut tableau `{ t, titre }` (secondes depuis le début du JT)
 * @returns les chapitres valides, dans l'ordre, un seul par instant
 */
export function nettoyerSommaire(brut) {
  if (!Array.isArray(brut)) return [];
  const vus = new Set();
  return brut
    .slice(0, MAX_CHAPITRES * 2)
    .map((c) => ({
      t: Math.round(Number(c?.t) * 10) / 10,
      titre: nettoyerTitre(c?.titre),
      // Le reportage de cette partie, quand c'en est un : c'est ce qui dit au
      // correspondant « votre reportage passe à 4:12 ».
      ...(UUID.test(String(c?.sujetId || '')) ? { sujetId: String(c.sujetId).toLowerCase() } : {}),
    }))
    .filter((c) => Number.isFinite(c.t) && c.t >= 0 && c.t <= INSTANT_MAX && c.titre)
    .sort((a, b) => a.t - b.t)
    .filter((c) => {
      if (vus.has(c.t)) return false;
      vus.add(c.t);
      return true;
    })
    .slice(0, MAX_CHAPITRES);
}

/** Le champ `sommaire` d'un envoi en multipart : du JSON, ou rien. */
export function lireSommaireTexte(texte) {
  if (typeof texte !== 'string' || !texte.trim() || texte.length > 20000) return [];
  try {
    return nettoyerSommaire(JSON.parse(texte));
  } catch {
    return [];
  }
}

/** 0:00, 4:12, 1:02:03 — comme le lecteur et les plateformes l'écrivent. */
export function minutage(secondes) {
  const s = Math.max(0, Math.floor(Number(secondes) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
