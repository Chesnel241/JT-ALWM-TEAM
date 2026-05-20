const DEFAULT_COUNTRIES = [
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

export const WEEKS_PAST = parseInt(process.env.WEEKS_PAST || 4, 10);
export const WEEKS_FUTURE = parseInt(process.env.WEEKS_FUTURE || 2, 10);

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
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const m1 = `${monday.getDate()} ${MONTHS_FR[monday.getMonth()]}`;
  const m2 = sameMonth
    ? `${sunday.getDate()} ${MONTHS_FR[sunday.getMonth()]}`
    : `${sunday.getDate()} ${MONTHS_FR[sunday.getMonth()]}`;
  return `${m1} - ${m2}`;
}

/**
 * Génère la liste des semaines visibles dans l'outil, centrée sur la
 * semaine actuelle. Format ISO 8601 : ID stable d'une année à l'autre.
 *
 * Status:
 *  - archived : semaine passée (ses uploads seront nettoyés 48 h après)
 *  - active   : semaine courante (la semaine "EN COURS")
 *  - upcoming : semaine future
 *
 * Note: la liste est recalculée à chaque démarrage du serveur. Les IDs
 * (ex: "2026-w21") restent valides tant que la semaine est dans la
 * fenêtre [past, future]. Une fois sortie, elle disparaît de l'API mais
 * les fichiers physiques sont conservés jusqu'au cleanup (48h après la
 * fin).
 */
export function buildWeeks(now = new Date(), { past = WEEKS_PAST, future = WEEKS_FUTURE } = {}) {
  const currentMonday = startOfIsoWeek(now);
  const weeks = [];

  for (let offset = -past; offset <= future; offset++) {
    const monday = new Date(currentMonday);
    monday.setDate(monday.getDate() + offset * 7);
    const sunday = endOfIsoWeek(monday);
    const year = isoWeekYear(monday);
    const num = isoWeekNumber(monday);
    const id = `${year}-w${String(num).padStart(2, '0')}`;
    const status = offset < 0 ? 'archived' : offset === 0 ? 'active' : 'upcoming';

    weeks.push({
      id,
      name: `Semaine ${num}`,
      dates: formatRange(monday, sunday),
      status,
      startDate: monday.toISOString(),
      endDate: sunday.toISOString(),
    });
  }

  return weeks;
}

// La liste est rebattie à chaque démarrage. Pour la régénérer sans
// redéployer, déclencher un restart du service Render.
export const WEEKS = buildWeeks();
