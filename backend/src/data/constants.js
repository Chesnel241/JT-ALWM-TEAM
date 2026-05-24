const DEFAULT_COUNTRIES = [
  { id: 'tj', name: 'Titres & Rappels JT', code: 'TJ' },
  { id: 'cm', name: 'Cameroun', code: 'CM' },
  { id: 'sn', name: 'Sénégal', code: 'SN' },
  { id: 'ci', name: "Côte d'Ivoire", code: 'CI' },
  { id: 'cd', name: 'Rép. Dém. du Congo', code: 'CD' },
  { id: 'cg', name: 'Congo Brazzaville', code: 'CG' },
  { id: 'ma', name: 'Maroc', code: 'MA' },
  { id: 'tg', name: 'Togo', code: 'TG' },
];

// Permet d'éditer la liste des pays via la variable d'env `COUNTRIES_JSON`
// (sur Render → Environment) sans toucher au code. Format attendu :
// [{"id":"bj","name":"Bénin","code":"BJ"}, ...] — un JSON array valide.
// Si la valeur est invalide ou absente, on retombe sur la liste par défaut.
function loadCountries() {
  const raw = process.env.COUNTRIES_JSON;
  if (!raw) return DEFAULT_COUNTRIES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn('COUNTRIES_JSON ignored: must be a non-empty array');
      return DEFAULT_COUNTRIES;
    }
    const valid = parsed.every(
      (c) =>
        c && typeof c.id === 'string' && c.id.length > 0 &&
        typeof c.name === 'string' && c.name.length > 0 &&
        typeof c.code === 'string' && c.code.length > 0
    );
    if (!valid) {
      console.warn('COUNTRIES_JSON ignored: each item needs id/name/code strings');
      return DEFAULT_COUNTRIES;
    }
    return parsed;
  } catch (err) {
    console.warn(`COUNTRIES_JSON ignored: ${err.message}`);
    return DEFAULT_COUNTRIES;
  }
}

export const COUNTRIES = loadCountries();

// Décale `date` au lundi de sa semaine ISO (ramener au début de la
// semaine, lundi 00:00 dans le fuseau local du serveur).
function startOfIsoWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dim, 1 = lun, ..., 6 = sam
  const diff = (day + 6) % 7; // 0 si lundi, 6 si dimanche
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfIsoWeek(monday) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Numéro de semaine ISO 8601 (1 à 53).
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function isoWeekYear(date) {
  // Le 4 janvier appartient toujours à la semaine 1 — décalage similaire
  // au calcul de isoWeekNumber.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function formatRange(monday, sunday) {
  const m1 = `${monday.getDate()} ${MONTHS_FR[monday.getMonth()]}`;
  const m2 = `${sunday.getDate()} ${MONTHS_FR[sunday.getMonth()]}`;
  return `${m1} - ${m2}`;
}

function makeWeek(monday, status) {
  const sunday = endOfIsoWeek(monday);
  const year = isoWeekYear(monday);
  const num = isoWeekNumber(monday);
  return {
    id: `${year}-w${String(num).padStart(2, '0')}`,
    num,
    name: `Semaine ${num}`,
    dates: formatRange(monday, sunday),
    status,
    startDate: monday.toISOString(),
    endDate: sunday.toISOString(),
  };
}

/**
 * Construit l'ID ISO (YYYY-wWW) d'une date donnée.
 */
export function weekIdFor(date) {
  return makeWeek(startOfIsoWeek(date), 'active').id;
}

/**
 * Date limite d'envoi des rushes pour une semaine donnée.
 * Règle métier : **dimanche 17h30 (fuseau serveur) de la semaine**.
 * Après ce moment, les correspondants ne peuvent plus uploader.
 * L'équipe montage (deliveries) reste libre d'uploader le JT final
 * jusqu'à la purge mercredi 00:00 W+1.
 *
 * @param {string} weekId - ex: "2026-w21"
 * @returns {Date|null}
 */
export function weekUploadCutoff(weekId) {
  const m = /^(\d{4})-w(\d{1,2})$/.exec(weekId);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);

  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - jan4Day + 1);
  mondayWeek1.setHours(0, 0, 0, 0);

  const monday = new Date(mondayWeek1);
  monday.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  // Dimanche = lundi + 6 jours, 17h30
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(17, 30, 0, 0);
  return sunday;
}

/**
 * Calcule la date d'expiration d'une semaine identifiée par son ID ISO.
 * Une semaine W expire **mercredi 00:00 de la semaine W+1** (= sunday
 * 23:59:59 + 48 h). Au-delà, ses uploads sont purgés et elle disparaît
 * de la liste visible.
 *
 * Retourne `null` si l'ID n'est pas au format `YYYY-wWW`.
 */
export function weekExpiryDate(weekId) {
  const m = /^(\d{4})-w(\d{1,2})$/.exec(weekId);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);

  // ISO 8601 : la semaine 1 est celle qui contient le 4 janvier.
  // On part du 4 janvier de cette année-là, on remonte à son lundi, puis
  // on avance de (week - 1) semaines.
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - jan4Day + 1);
  mondayWeek1.setHours(0, 0, 0, 0);

  const monday = new Date(mondayWeek1);
  monday.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  const sunday = endOfIsoWeek(monday);

  // Mercredi 00:00 de la semaine suivante = 48 h après dimanche 23:59:59
  return new Date(sunday.getTime() + 48 * 60 * 60 * 1000 + 1);
}

/**
 * Génère la liste des semaines visibles selon la règle métier "cycle de
 * 9 jours" :
 *
 *  - Semaine **précédente** : visible uniquement le lundi et le mardi
 *    de la semaine actuelle (statut `archived`). Le mercredi à 00:00,
 *    elle disparaît et ses uploads sont purgés (cf. cleanup).
 *  - Semaine **courante** : toujours visible (statut `active`).
 *  - Semaine **suivante** : toujours visible (statut `upcoming`).
 *
 * Résultat : 2 ou 3 semaines, jamais plus.
 */
export function buildWeeks(now = new Date()) {
  const currentMonday = startOfIsoWeek(now);
  const isoDay = now.getDay() === 0 ? 7 : now.getDay(); // 1=lun, ..., 7=dim
  const weeks = [];

  // Semaine précédente visible uniquement lundi (1) et mardi (2)
  if (isoDay <= 2) {
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    weeks.push(makeWeek(prevMonday, 'archived'));
  }

  weeks.push(makeWeek(currentMonday, 'active'));

  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  weeks.push(makeWeek(nextMonday, 'upcoming'));

  return weeks;
}

// La liste est recalculée à chaque démarrage. Le service Render redémarre
// régulièrement (deploys + autoscaling), ce qui garantit que la liste
// reste à jour. En complément, un timer interne régénère côté API.
export const WEEKS = buildWeeks();
