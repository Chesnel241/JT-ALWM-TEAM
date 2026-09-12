const DEFAULT_COUNTRIES = [
  { id: 'tj', name: 'Titres & Rappels JT', code: 'TJ' },
  { id: 'cm', name: 'Cameroun', code: 'CM' },
  { id: 'sn', name: 'Sénégal', code: 'SN' },
  { id: 'ci', name: "Côte d'Ivoire", code: 'CI' },
  { id: 'cd', name: 'Rép. Dém. du Congo', code: 'CD' },
  { id: 'cg', name: 'Congo Brazzaville', code: 'CB' },
  { id: 'ma', name: 'Maroc', code: 'MA' },
  { id: 'tg', name: 'Togo', code: 'TG' },
];

// Permet d'éditer la liste des pays via la variable d'env `COUNTRIES_JSON`
// (sur Render → Environment) sans toucher au code. Format attendu :
// [{"id":"bj","name":"Bénin","code":"BJ"}, ...] — un JSON array valide.
// Si la valeur est invalide ou absente, on retombe sur la liste par défaut.
function loadCountries() {
  let list = DEFAULT_COUNTRIES;
  const raw = process.env.COUNTRIES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.every(
          (c) =>
            c && typeof c.id === 'string' && c.id.length > 0 &&
            typeof c.name === 'string' && c.name.length > 0 &&
            typeof c.code === 'string' && c.code.length > 0
        );
        if (valid) {
          list = parsed;
        } else {
          console.warn('COUNTRIES_JSON ignored: each item needs id/name/code strings');
        }
      } else {
        console.warn('COUNTRIES_JSON ignored: must be a non-empty array');
      }
    } catch (err) {
      console.warn(`COUNTRIES_JSON ignored: ${err.message}`);
    }
  }

  // Injecter systématiquement "Titres & Rappels JT" s'il n'existe pas
  if (!list.find(c => c.id === 'tj')) {
    list = [{ id: 'tj', name: 'Titres & Rappels JT', code: 'TJ' }, ...list];
  }

  return list;
}

export const COUNTRIES = loadCountries();

/**
 * "Buckets" non géographiques utilisés par l'espace montage pour stocker
 * des fichiers hors du chutier d'un pays donné :
 *   - `mj` : Mot du JT / reportage assemblé (admin uniquement)
 * Les autres bins du frontend (`tj` → déjà dans COUNTRIES via loadCountries,
 * `delivery` → route /api/deliveries séparée, `studio` → vue read-only) ne
 * sont jamais envoyés comme countryId au backend.
 */
export const SPECIAL_BUCKETS = new Set(['mj']);

/**
 * Heure de clôture des envois : **dimanche 10h30 en GMT+2**.
 *
 * Le fuseau est déclaré, et non hérité de la machine. Avant, la règle
 * s'écrivait `setHours(17, 30)` dans le fuseau du serveur — lequel tourne en
 * UTC : la clôture annoncée « 17h30 » tombait en réalité à 19h30 pour une
 * rédaction en GMT+2, et aurait changé d'heure toute seule si le serveur
 * avait déménagé. Une règle métier ne doit pas dépendre de l'endroit où le
 * code s'exécute.
 *
 * `offsetUTC` est fixe et ne suit pas l'heure d'été : la collecte va de Dakar
 * à Libreville, où l'heure ne change pas, et une clôture qui se décale deux
 * fois par an serait une source d'erreur pour tout le monde.
 */
export const CLOTURE = Object.freeze({
  heureLocale: 10,
  minuteLocale: 30,
  offsetUTC: 2,
  /** Pour l'affichage : « dimanche 10h30 (GMT+2) ». */
  libelle: 'dimanche 10h30 (GMT+2)',
  libelleEN: 'Sunday 10:30 (GMT+2)',
});

/**
 * Lundi 00:00 UTC de la semaine ISO demandée.
 *
 * ISO 8601 : la semaine 1 est celle qui contient le 4 janvier. Ce calcul
 * était recopié à l'identique dans les deux fonctions ci-dessous, en heure
 * locale — donc dépendant du fuseau de la machine. Il vit ici, en UTC.
 */
function lundiIsoUTC(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jourJan4 = jan4.getUTCDay() || 7;
  const lundiSemaine1 = new Date(jan4);
  lundiSemaine1.setUTCDate(jan4.getUTCDate() - jourJan4 + 1);
  lundiSemaine1.setUTCHours(0, 0, 0, 0);

  const lundi = new Date(lundiSemaine1);
  lundi.setUTCDate(lundiSemaine1.getUTCDate() + (week - 1) * 7);
  return lundi;
}

/** Décompose un identifiant `YYYY-wWW`, ou renvoie null. */
function litIdSemaine(weekId) {
  const m = /^(\d{4})-w(\d{1,2})$/.exec(String(weekId || ''));
  return m ? { annee: parseInt(m[1], 10), semaine: parseInt(m[2], 10) } : null;
}

/**
 * Source de vérité unique pour la validation d'un countryId reçu sur les
 * routes d'upload, TUS, notifications, delete, archive, etc. Avant ce
 * helper, chaque route avait sa propre version divergente : la plus
 * permissive acceptait `mj`, la plus stricte le rejetait → la rubrique
 * Mot du JT ne s'uploadait pas via TUS (404 "Week ou Country invalide").
 *
 * @param {string} countryId
 * @param {Array<{id:string}>} [customCountries=[]] — pays ajoutés dynamiquement
 *   via "Ajouter un pays" (lus à chaque appel, pas mis en cache).
 */
export function isCountryAccepted(countryId, customCountries = []) {
  if (!countryId || typeof countryId !== 'string') return false;
  if (SPECIAL_BUCKETS.has(countryId)) return true;
  if (COUNTRIES.some((c) => c.id === countryId)) return true;
  if (Array.isArray(customCountries) && customCountries.some((c) => c.id === countryId)) return true;
  return false;
}

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
  const id = `${year}-w${String(num).padStart(2, '0')}`;
  const expiry = weekExpiryDate(id);
  const cutoff = weekUploadCutoff(id);
  return {
    id,
    num,
    name: `Semaine ${num}`,
    dates: formatRange(monday, sunday),
    status,
    startDate: monday.toISOString(),
    endDate: sunday.toISOString(),
    // Date réelle d'effacement des rushes. L'interface annonçait « 48 h »
    // partout, ce qui est faux : la purge est ancrée à la semaine de
    // diffusion, pas à l'envoi. Un fichier déposé le lundi vit neuf jours,
    // un fichier déposé le dimanche à l'échéance en vit deux. Le calcul
    // reste ici ; le frontend n'a pas de quoi le refaire.
    expiresAt: expiry ? expiry.toISOString() : null,
    // Instant exact de clôture des envois. Le frontend l'AFFICHE au lieu de
    // le recalculer : il le refaisait dans le fuseau du navigateur, si bien
    // qu'un correspondant en GMT+1 voyait son compte à rebours atteindre
    // zéro une heure avant que le serveur ne ferme réellement.
    cutoffAt: cutoff ? cutoff.toISOString() : null,
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
 *
 * Règle métier : **dimanche 10h30 GMT+2** (voir CLOTURE). Au-delà, les
 * correspondants ne peuvent plus envoyer. L'équipe montage reste libre de
 * déposer le JT final jusqu'à la purge, mercredi 00:00 de W+1.
 *
 * Le résultat est le même instant quel que soit le fuseau de la machine :
 * c'est ce qui permet au frontend de simplement l'afficher, au lieu de
 * refaire le calcul dans le fuseau du navigateur — ce qu'il faisait, avec
 * une heure d'écart pour un correspondant en GMT+1.
 *
 * @param {string} weekId - ex: "2026-w21"
 * @returns {Date|null}
 */
export function weekUploadCutoff(weekId) {
  const parts = litIdSemaine(weekId);
  if (!parts) return null;

  const dimanche = lundiIsoUTC(parts.annee, parts.semaine);
  dimanche.setUTCDate(dimanche.getUTCDate() + 6);
  dimanche.setUTCHours(CLOTURE.heureLocale - CLOTURE.offsetUTC, CLOTURE.minuteLocale, 0, 0);
  return dimanche;
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
  const parts = litIdSemaine(weekId);
  if (!parts) return null;

  // Mercredi 00:00 UTC de la semaine suivante = lundi + 9 jours. Écrit en
  // UTC comme la clôture : sur le serveur actuel, qui tourne en UTC, la
  // valeur est exactement celle d'avant — mais elle ne bougera plus si la
  // machine change de fuseau.
  const mercredi = lundiIsoUTC(parts.annee, parts.semaine);
  mercredi.setUTCDate(mercredi.getUTCDate() + 9);
  mercredi.setUTCHours(0, 0, 0, 0);
  return mercredi;
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
