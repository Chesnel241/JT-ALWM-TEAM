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

export const WEEKS = [
  { id: 'w-42', name: 'Semaine 42', dates: '14 Oct - 20 Oct', status: 'archived' },
  { id: 'w-43', name: 'Semaine 43', dates: '21 Oct - 27 Oct', status: 'active' },
  { id: 'w-44', name: 'Semaine 44', dates: '28 Oct - 03 Nov', status: 'upcoming' },
];
