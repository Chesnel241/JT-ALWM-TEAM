/**
 * L'heure limite, dite dans l'heure du correspondant.
 *
 * La clôture est un instant unique, décidé par le serveur : dimanche 10h30 à
 * l'heure de la rédaction (GMT+2), soit 08h30 UTC (`week.cutoffAt`). Le
 * compte à rebours était donc juste partout. Le TEXTE, lui, disait
 * « dimanche 10h30 (GMT+2) » à tout le monde : un correspondant de Douala
 * (GMT+1) devait retrancher une heure de tête, un collaborateur de São Paulo
 * (GMT-3) cinq heures — et certains envoyaient en croyant avoir le temps.
 *
 * Ici, l'heure est rendue dans le fuseau du navigateur : 09h30 à Douala,
 * 05h30 à São Paulo, samedi 22h30 à Honolulu. La référence de la rédaction
 * reste disponible, en petit, pour parler la même langue au téléphone.
 *
 * Module pur, comme `semaine.js` côté serveur : l'instant présent et le
 * fuseau sont passés en argument, jamais lus ici — sauf `fuseauNavigateur()`,
 * seul point de contact avec l'appareil.
 */

/** Décalage de la rédaction par rapport à UTC, en minutes (GMT+2, fixe). */
export const DECALAGE_REDACTION_MIN = 120;

/** Heure de clôture, en UTC : dimanche 08h30. */
const CLOTURE_UTC = Object.freeze({ jour: 0, heure: 8, minute: 30 });

/**
 * Seuils des couleurs du compte à rebours, validés avec la rédaction :
 * vert au-delà de 48 h, orange jusqu'à 12 h, rouge en dessous.
 */
export const SEUILS = Object.freeze({
  procheMs: 48 * 3600 * 1000,
  urgentMs: 12 * 3600 * 1000,
});

/** Le fuseau de l'appareil (« Africa/Douala »), ou `undefined`. */
export function fuseauNavigateur() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function lireParties(instant, timeZone) {
  const options = {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  };
  if (timeZone) options.timeZone = timeZone;
  const parties = {};
  for (const p of new Intl.DateTimeFormat('en-US', options).formatToParts(instant)) {
    parties[p.type] = Number(p.value);
  }
  return parties;
}

/**
 * Décalage du fuseau par rapport à UTC à cet instant, en minutes
 * (+60 à Douala, -180 à São Paulo, +330 à Calcutta).
 *
 * Calculé en comparant l'heure murale du fuseau à l'instant UTC : c'est ce
 * qui suit l'heure d'été sans table à tenir à jour.
 */
export function decalageMinutes(instant, timeZone) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return 0;
  try {
    const p = lireParties(date, timeZone);
    const mural = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
    const exact = Math.floor(date.getTime() / 60000) * 60000;
    return Math.round((mural - exact) / 60000);
  } catch {
    // Fuseau inconnu de ce navigateur : celui de l'appareil.
    return -date.getTimezoneOffset();
  }
}

/** « GMT+1 », « GMT-3 », « GMT+5:30 », « GMT+0 ». */
export function libelleDecalage(minutes) {
  const signe = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${signe}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

function heureLisible(heure, minute, lang) {
  if (lang === 'en') {
    const h12 = heure % 12 || 12;
    return `${h12}:${String(minute).padStart(2, '0')} ${heure < 12 ? 'AM' : 'PM'}`;
  }
  return `${String(heure).padStart(2, '0')}h${String(minute).padStart(2, '0')}`;
}

/**
 * L'échéance telle que le correspondant doit la lire.
 *
 * @param {string|Date} cutoffAt — l'instant de clôture (ISO), fourni par le
 *   serveur.
 * @param {{lang?: 'fr'|'en', timeZone?: string}} options — sans `timeZone`,
 *   le fuseau de l'appareil.
 * @returns {null|{
 *   jour: string, date: string, heure: string, fuseau: string,
 *   court: string, complet: string,
 *   reference: string, memeHeureQueRedaction: boolean, decalage: number,
 * }}
 */
export function echeanceLocale(cutoffAt, { lang = 'fr', timeZone } = {}) {
  if (!cutoffAt) return null;
  const instant = cutoffAt instanceof Date ? cutoffAt : new Date(cutoffAt);
  if (Number.isNaN(instant.getTime())) return null;

  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const options = { weekday: 'long', day: 'numeric', month: 'short' };
  let jour;
  let date;
  try {
    const parties = new Intl.DateTimeFormat(locale, timeZone ? { ...options, timeZone } : options)
      .formatToParts(instant);
    jour = parties.find((p) => p.type === 'weekday')?.value || '';
    const jourDuMois = parties.find((p) => p.type === 'day')?.value || '';
    const mois = parties.find((p) => p.type === 'month')?.value || '';
    date = lang === 'en' ? `${mois} ${jourDuMois}` : `${jourDuMois} ${mois}`;
  } catch {
    return echeanceLocale(instant, { lang });
  }

  const decalage = decalageMinutes(instant, timeZone);
  const p = lireParties(instant, timeZone);
  const heure = heureLisible(p.hour % 24, p.minute, lang);
  const fuseau = libelleDecalage(decalage);

  const r = lireParties(new Date(instant.getTime() + DECALAGE_REDACTION_MIN * 60000), 'UTC');
  const reference = `${heureLisible(r.hour % 24, r.minute, lang)} ${libelleDecalage(DECALAGE_REDACTION_MIN)}`;

  return {
    jour,
    date,
    heure,
    fuseau,
    court: `${jour} ${heure}`,
    complet: lang === 'en' ? `${jour}, ${date} at ${heure}` : `${jour} ${date} à ${heure}`,
    reference,
    memeHeureQueRedaction: decalage === DECALAGE_REDACTION_MIN,
    decalage,
  };
}

/**
 * La prochaine clôture après `maintenant` : dimanche 08h30 UTC.
 *
 * Pour les textes qui n'ont pas de semaine sous la main (l'aide, la visite
 * guidée). Quand une semaine est connue, son `cutoffAt` fait foi.
 */
export function prochaineCloture(maintenant) {
  const t = maintenant instanceof Date ? maintenant : new Date(maintenant);
  const d = new Date(Date.UTC(
    t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), CLOTURE_UTC.heure, CLOTURE_UTC.minute,
  ));
  const ecart = (CLOTURE_UTC.jour - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + ecart);
  if (d.getTime() <= t.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

/**
 * La couleur du temps qui reste.
 *
 * - `serein`  : plus de 48 h — vert ;
 * - `proche`  : de 48 h à 12 h — orange ;
 * - `urgent`  : moins de 12 h — rouge ;
 * - `clos`    : c'est passé.
 */
export function phaseEcheance(restantMs) {
  if (!Number.isFinite(restantMs) || restantMs <= 0) return 'clos';
  if (restantMs <= SEUILS.urgentMs) return 'urgent';
  if (restantMs <= SEUILS.procheMs) return 'proche';
  return 'serein';
}

/**
 * La cadence du halo, en secondes par battement : il « respire » lentement
 * tant qu'on a le temps, et de plus en plus vite dans la dernière heure.
 * `0` : pas de battement.
 */
export function cadencePouls(restantMs) {
  const phase = phaseEcheance(restantMs);
  if (phase === 'clos') return 0;
  if (phase === 'serein') return 4;
  if (phase === 'proche') return 3;
  const heure = 3600 * 1000;
  if (restantMs >= heure) return 2;
  // De 2 s à une heure de la fin, jusqu'à 0,6 s à la dernière seconde.
  return Math.round((0.6 + 1.4 * (restantMs / heure)) * 100) / 100;
}

/** Jours, heures, minutes, secondes restant (valeurs absolues). */
export function decompte(restantMs) {
  const abs = Math.max(0, Math.floor(Math.abs(restantMs) / 1000));
  return {
    jours: Math.floor(abs / 86400),
    heures: Math.floor((abs % 86400) / 3600),
    minutes: Math.floor((abs % 3600) / 60),
    secondes: abs % 60,
  };
}

/**
 * L'échéance en une phrase, pour les textes : « dimanche 09h30, votre heure
 * (GMT+1) », ou « … heure de la rédaction » quand c'est la même.
 *
 * @param {ReturnType<typeof echeanceLocale>} e
 * @param {{votreHeure: Function, memeHeure: Function}} textes — `t.echeance`.
 */
export function phraseEcheance(e, textes) {
  if (!e || !textes) return '';
  return e.memeHeureQueRedaction ? textes.memeHeure(e.court) : textes.votreHeure(e.court, e.fuseau);
}

/**
 * La phrase de la prochaine clôture, dans le fuseau de l'appareil — pour les
 * textes qui n'ont pas de semaine sous la main (l'aide, la visite guidée).
 */
export function phraseProchaineCloture(t, lang, maintenant = new Date()) {
  const e = echeanceLocale(prochaineCloture(maintenant), { lang, timeZone: fuseauNavigateur() });
  return phraseEcheance(e, t?.echeance);
}

function minuitLocal(annee, mois, jour, timeZone) {
  // L'instant où commence ce jour du calendrier dans ce fuseau : minuit
  // « mural », corrigé du décalage (deux passes pour les jours d'heure d'été).
  const mural = Date.UTC(annee, mois - 1, jour);
  let instant = mural - decalageMinutes(new Date(mural), timeZone) * 60000;
  instant = mural - decalageMinutes(new Date(instant), timeZone) * 60000;
  return instant;
}

/**
 * Les sept jours qui mènent à la clôture, dans le calendrier du
 * correspondant : le dernier est le jour de la clôture (dimanche à Douala,
 * samedi à Honolulu).
 *
 * Chaque jour dit s'il est passé, en cours ou à venir, et de combien il est
 * rempli : c'est ce qui dessine le ruban « vous êtes ici » sans qu'il puisse
 * se décaler d'un jour selon le pays.
 *
 * @returns {Array<{libelle: string, numero: number, etat: 'passe'|'aujourdhui'|'avenir',
 *   remplissage: number, cloture: boolean}>}
 */
export function rubanSemaine(cutoffAt, maintenant, { lang = 'fr', timeZone } = {}) {
  const fin = cutoffAt instanceof Date ? cutoffAt : new Date(cutoffAt);
  const now = (maintenant instanceof Date ? maintenant : new Date(maintenant)).getTime();
  if (Number.isNaN(fin.getTime()) || Number.isNaN(now)) return [];

  const p = lireParties(fin, timeZone);
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const nomJour = new Intl.DateTimeFormat(locale, timeZone ? { weekday: 'short', timeZone } : { weekday: 'short' });

  const jours = [];
  for (let i = 6; i >= 0; i -= 1) {
    const debut = minuitLocal(p.year, p.month, p.day - i, timeZone);
    const finJour = i === 0 ? fin.getTime() : minuitLocal(p.year, p.month, p.day - i + 1, timeZone);
    const midi = new Date(debut + 12 * 3600 * 1000);
    let etat = 'aujourdhui';
    if (now >= finJour) etat = 'passe';
    else if (now < debut) etat = 'avenir';
    const remplissage = etat === 'passe' ? 1
      : etat === 'avenir' ? 0
        : Math.min(1, Math.max(0, (now - debut) / (finJour - debut)));
    jours.push({
      libelle: nomJour.format(midi),
      numero: lireParties(midi, timeZone).day,
      etat,
      remplissage,
      cloture: i === 0,
    });
  }
  return jours;
}
