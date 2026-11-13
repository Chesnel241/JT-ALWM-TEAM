/**
 * Le sommaire horodaté d'un JT publié : l'afficher, s'y déplacer, le copier.
 *
 * Il arrive du serveur déjà nettoyé (`{ t, titre }`, dans l'ordre). Ce module
 * ne fait que le présenter : il sert aussi bien l'écran des correspondants
 * que celui du montage, et ne dépend de rien d'autre.
 */

/** 0:00, 4:12, 1:02:03 — la forme que YouTube et Facebook reconnaissent. */
export function minutage(secondes) {
  const s = Math.max(0, Math.floor(Number(secondes) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** YouTube ne fait des chapitres que de parties d'au moins 10 secondes. */
const PARTIE_MINIMALE = 10;

/**
 * Le texte à coller dans la description d'une vidéo YouTube ou Facebook.
 *
 * YouTube exige un premier repère à 0:00 et des parties de 10 s au moins :
 * sans cela, il ignore TOUT le sommaire. Une partie trop courte (un carton
 * « Les titres » de six secondes) se fond donc dans la précédente.
 */
export function texteDuSommaire(chapitres = []) {
  const liste = (Array.isArray(chapitres) ? chapitres : []).filter((c) => c && c.titre);
  if (liste.length === 0) return '';
  const gardes = [{ ...liste[0], t: 0 }];
  for (const c of liste.slice(1)) {
    const precedent = gardes[gardes.length - 1];
    if (c.t - precedent.t >= PARTIE_MINIMALE) gardes.push(c);
    // Le premier repère reste à 0:00 ; une autre partie trop courte cède la
    // place à celle qui la suit.
    else if (gardes.length > 1) gardes[gardes.length - 1] = c;
  }
  return gardes.map((c) => `${minutage(c.t)} ${c.titre}`).join('\n');
}

/** L'index du chapitre en cours à cet instant de la lecture, ou -1. */
export function chapitreEnCours(chapitres = [], instant = 0) {
  let index = -1;
  for (let i = 0; i < chapitres.length; i += 1) {
    if (chapitres[i].t <= instant + 0.25) index = i;
    else break;
  }
  return index;
}

/** Où en est-on dans ce chapitre (0 à 1), pour la jauge du lecteur. */
export function avanceeDansChapitre(chapitres = [], index, instant, dureeTotale) {
  const c = chapitres[index];
  if (!c) return 0;
  const fin = chapitres[index + 1]?.t ?? dureeTotale;
  if (!(fin > c.t)) return 0;
  return Math.max(0, Math.min(1, (instant - c.t) / (fin - c.t)));
}
