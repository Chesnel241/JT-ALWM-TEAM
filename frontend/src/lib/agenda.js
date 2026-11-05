/**
 * Le rappel de clôture, à poser dans l'agenda du téléphone.
 *
 * LE BESOIN : la clôture tombe chaque dimanche matin, et beaucoup de
 * correspondants ne la découvraient qu'en ouvrant le lien — trop tard. Un
 * fichier `.ics` s'importe d'un geste dans l'agenda d'Android comme dans
 * celui de l'iPhone : un événement chaque semaine, à l'heure de clôture,
 * avec deux alarmes (la veille, et 3 h avant).
 *
 * L'heure est écrite en UTC : la clôture est fixée à heure fixe GMT+2, sans
 * heure d'été (`CLOTURE` côté serveur), donc la même en UTC toute l'année,
 * et l'agenda l'affiche à l'heure locale du correspondant.
 *
 * Module pur : il n'écrit rien, ne lit pas l'heure ; `maintenant` est passé.
 */

/** Échappement des textes selon la RFC 5545 (§ 3.3.11). */
export function echapperIcs(texte) {
  return String(texte ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Une date au format UTC de l'iCalendar : 20261108T083000Z. */
export function dateIcs(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Plie les lignes à 75 octets, comme l'exige la norme : certains agendas
 * refusent sinon le fichier entier. On coupe sur des caractères, jamais au
 * milieu d'un caractère accentué.
 */
export function plierLigne(ligne) {
  const encodeur = new TextEncoder();
  const morceaux = [];
  let courant = '';
  for (const caractere of ligne) {
    const limite = morceaux.length === 0 ? 75 : 74; // la suite commence par un espace
    if (encodeur.encode(courant + caractere).length > limite) {
      morceaux.push(courant);
      courant = caractere;
    } else {
      courant += caractere;
    }
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

/**
 * @param {object} p
 * @param {string|Date} p.cutoffAt  clôture de la semaine en cours (ISO, UTC)
 * @param {string} p.paysId
 * @param {string} p.titre        « Clôture des envois — Cameroun »
 * @param {string} p.description  le lien et la consigne
 * @param {string} p.alarmeVeille
 * @param {string} p.alarme3h
 * @param {Date}   p.maintenant
 * @returns {string} le contenu du fichier .ics, lignes séparées par CRLF
 */
export function rappelCloture({ cutoffAt, paysId, titre, description, alarmeVeille, alarme3h, maintenant }) {
  const debut = new Date(cutoffAt);
  if (!Number.isFinite(debut.getTime())) throw new Error('Clôture inconnue');
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JT ALWM//Rappel de cloture//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Un identifiant stable par pays : réimporter le fichier met l'événement
    // à jour au lieu d'en créer un second.
    `UID:cloture-${String(paysId || 'pays').replace(/[^a-z0-9-]/gi, '')}@jt-alwm`,
    `DTSTAMP:${dateIcs(maintenant)}`,
    `DTSTART:${dateIcs(debut)}`,
    'DURATION:PT15M',
    'RRULE:FREQ=WEEKLY',
    `SUMMARY:${echapperIcs(titre)}`,
    `DESCRIPTION:${echapperIcs(description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    `DESCRIPTION:${echapperIcs(alarmeVeille)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT3H',
    `DESCRIPTION:${echapperIcs(alarme3h)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lignes.map(plierLigne).join('\r\n')}\r\n`;
}

/** Propose le fichier au téléchargement (le téléphone l'ouvre dans l'agenda). */
export function telechargerIcs(contenu, nomFichier = 'rappel-cloture.ics') {
  const blob = new Blob([contenu], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
