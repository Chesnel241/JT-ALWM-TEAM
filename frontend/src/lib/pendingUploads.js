/**
 * Envois interrompus, mémorisés d'une session à l'autre.
 *
 * Le protocole d'envoi est reprenable et garde son empreinte dans le
 * navigateur : reproposer le même fichier repart de l'octet où la coupure a
 * eu lieu. Ce qu'il manquait, c'était le souvenir qu'un envoi était en cours.
 * Sans lui, un correspondant dont la 4G lâche, dont le téléphone se met en
 * veille ou qui ferme l'onglet n'avait aucun moyen de savoir où il en était,
 * et le message « gardez cette page ouverte jusqu'à la fin » est intenable
 * sur un téléphone.
 *
 * On ne mémorise que la description du fichier, jamais son contenu :
 * localStorage ne pourrait pas le porter, et l'empreinte suffit à reprendre.
 */

const KEY = 'pending_uploads_v1';
// Au-delà, l'envoi date d'une autre semaine de travail : le reproposer
// embrouillerait plus qu'il n'aiderait.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* stockage indisponible : la reprise n'est qu'un confort */
  }
}

function isFresh(entry) {
  if (!entry || !entry.startedAt) return false;
  return Date.now() - new Date(entry.startedAt).getTime() < MAX_AGE_MS;
}

/** Clé d'un fichier : ce qui permet de reconnaître le même sur le disque. */
export function fileKey({ name, size }) {
  return `${name}::${size}`;
}

/** Enregistre un envoi qui démarre. */
export function rememberUpload({ weekId, countryId, reportage, file }) {
  if (!file || !weekId || !countryId) return;
  const entry = {
    key: fileKey(file),
    name: file.name,
    size: file.size,
    weekId,
    countryId,
    reportage: reportage || '',
    startedAt: new Date().toISOString(),
  };
  const rest = readAll().filter((e) => e && e.key !== entry.key);
  writeAll([...rest, entry].filter(isFresh));
}

/** Oublie un envoi terminé (ou abandonné volontairement). */
export function forgetUpload(key) {
  writeAll(readAll().filter((e) => e && e.key !== key));
}

/** Envois restés en suspens pour ce pays et cette semaine. */
export function listPendingUploads(weekId, countryId) {
  if (!weekId || !countryId) return [];
  return readAll().filter(
    (e) => isFresh(e) && e.weekId === weekId && e.countryId === countryId
  );
}

/** Vrai si le fichier proposé est bien celui qu'on attendait. */
export function matchesEntry(entry, file) {
  if (!entry || !file) return false;
  return entry.name === file.name && Number(entry.size) === Number(file.size);
}
