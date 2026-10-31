/**
 * Le drapeau d'un pays, servi par l'application elle-même.
 *
 * L'INCIDENT : les drapeaux venaient d'un CDN externe, adressés par
 * l'identifiant du pays. Un pays ajouté à la main (« cameroun », « bdi »)
 * n'a pas d'identifiant ISO : son drapeau tombait en erreur — visible dans la
 * console de la rédaction — et la carte montrait trois lettres à la place.
 * Un domaine externe de plus était aussi un point de panne de plus pour des
 * réseaux qui filtrent déjà certains domaines.
 *
 * Les SVG viennent de `flag-icons` (licence MIT, `public/flags/`), et le code
 * se retrouve par tous les chemins qu'un humain a pu prendre en saisissant un
 * pays : code ISO, code à trois lettres, nom en français ou en anglais.
 */

/** Les drapeaux présents dans `public/flags/` (un test garde l'accord). */
export const DRAPEAUX_DISPONIBLES = Object.freeze(new Set([
  'dz', 'ao', 'bj', 'bw', 'bf', 'bi', 'cv', 'cm', 'cf', 'td', 'km', 'cg', 'cd', 'ci', 'dj',
  'eg', 'gq', 'er', 'sz', 'et', 'ga', 'gm', 'gh', 'gn', 'gw', 'ke', 'ls', 'lr', 'ly', 'mg',
  'mw', 'ml', 'mr', 'mu', 'ma', 'mz', 'na', 'ne', 'ng', 'rw', 'st', 'sn', 'sc', 'sl', 'so',
  'za', 'ss', 'sd', 'tz', 'tg', 'tn', 'ug', 'zm', 'zw', 'eh', 're', 'yt',
  'fr', 'be', 'ch', 'ca', 'us', 'gb', 'ht', 'un',
]));

// Codes saisis par la rédaction qui ne sont pas des codes ISO, ou qui en
// désignent un autre pays : « GB » y est le Gabon, « CB » le Congo
// Brazzaville, « KY » le Kenya. Repris tels quels de l'ancien composant.
const CODES_MAISON = Object.freeze({
  RDC: 'cd', CB: 'cg', DAGAN: 'cg', GB: 'ga', DP: 'un', KY: 'ke', 254: 'ke',
});

// ISO 3166 alpha-3 → alpha-2, pour les pays dont on sert le drapeau.
const ALPHA3 = Object.freeze({
  DZA: 'dz', AGO: 'ao', BEN: 'bj', BWA: 'bw', BFA: 'bf', BDI: 'bi', CPV: 'cv', CMR: 'cm',
  CAF: 'cf', TCD: 'td', COM: 'km', COG: 'cg', COD: 'cd', CIV: 'ci', DJI: 'dj', EGY: 'eg',
  GNQ: 'gq', ERI: 'er', SWZ: 'sz', ETH: 'et', GAB: 'ga', GMB: 'gm', GHA: 'gh', GIN: 'gn',
  GNB: 'gw', KEN: 'ke', LSO: 'ls', LBR: 'lr', LBY: 'ly', MDG: 'mg', MWI: 'mw', MLI: 'ml',
  MRT: 'mr', MUS: 'mu', MAR: 'ma', MOZ: 'mz', NAM: 'na', NER: 'ne', NGA: 'ng', RWA: 'rw',
  STP: 'st', SEN: 'sn', SYC: 'sc', SLE: 'sl', SOM: 'so', ZAF: 'za', SSD: 'ss', SDN: 'sd',
  TZA: 'tz', TGO: 'tg', TUN: 'tn', UGA: 'ug', ZMB: 'zm', ZWE: 'zw', ESH: 'eh', REU: 're',
  MYT: 'yt', FRA: 'fr', BEL: 'be', CHE: 'ch', CAN: 'ca', USA: 'us', GBR: 'gb', HTI: 'ht',
});

// Noms, sans accents ni ponctuation, en français et en anglais.
const NOMS = Object.freeze({
  cameroun: 'cm', cameroon: 'cm', senegal: 'sn', 'cote divoire': 'ci', 'ivory coast': 'ci',
  rdc: 'cd', 'rd congo': 'cd', 'rep dem du congo': 'cd', 'republique democratique du congo': 'cd',
  'democratic republic of the congo': 'cd', 'congo kinshasa': 'cd', 'congo brazzaville': 'cg',
  congo: 'cg', 'republique du congo': 'cg', maroc: 'ma', morocco: 'ma', togo: 'tg',
  benin: 'bj', 'burkina faso': 'bf', burundi: 'bi', gabon: 'ga', ouganda: 'ug', uganda: 'ug',
  tchad: 'td', chad: 'td', ghana: 'gh', kenya: 'ke', nigeria: 'ng', rwanda: 'rw', mali: 'ml',
  niger: 'ne', guinee: 'gn', guinea: 'gn', 'guinee equatoriale': 'gq', 'equatorial guinea': 'gq',
  'guinee bissau': 'gw', 'guinea bissau': 'gw', madagascar: 'mg', centrafrique: 'cf',
  'republique centrafricaine': 'cf', 'central african republic': 'cf', algerie: 'dz',
  algeria: 'dz', tunisie: 'tn', tunisia: 'tn', egypte: 'eg', egypt: 'eg',
  'afrique du sud': 'za', 'south africa': 'za', ethiopie: 'et', ethiopia: 'et',
  tanzanie: 'tz', tanzania: 'tz', angola: 'ao', mozambique: 'mz', zambie: 'zm', zambia: 'zm',
  zimbabwe: 'zw', malawi: 'mw', mauritanie: 'mr', mauritania: 'mr', liberia: 'lr',
  'sierra leone': 'sl', gambie: 'gm', gambia: 'gm', 'cap vert': 'cv', 'cape verde': 'cv',
  comores: 'km', comoros: 'km', djibouti: 'dj', somalie: 'so', somalia: 'so', soudan: 'sd',
  sudan: 'sd', 'soudan du sud': 'ss', 'south sudan': 'ss', erythree: 'er', eritrea: 'er',
  libye: 'ly', libya: 'ly', namibie: 'na', namibia: 'na', botswana: 'bw', lesotho: 'ls',
  eswatini: 'sz', swaziland: 'sz', maurice: 'mu', mauritius: 'mu', seychelles: 'sc',
  'sao tome et principe': 'st', reunion: 're', mayotte: 'yt', haiti: 'ht', france: 'fr',
  belgique: 'be', belgium: 'be', suisse: 'ch', switzerland: 'ch', canada: 'ca',
  'etats unis': 'us', 'united states': 'us', 'royaume uni': 'gb', 'united kingdom': 'gb',
});

function normaliserNom(nom) {
  return String(nom || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function depuisCode(brut) {
  const code = String(brut || '').trim().toUpperCase();
  if (!code) return null;
  if (CODES_MAISON[code]) return CODES_MAISON[code];
  const deux = code.toLowerCase();
  if (code.length === 2 && DRAPEAUX_DISPONIBLES.has(deux)) return deux;
  if (code.length === 3 && ALPHA3[code]) return ALPHA3[code];
  return null;
}

/**
 * Le code du drapeau à afficher (« cm »), ou `null` s'il n'y en a pas.
 *
 * Ordre : les codes maison de la rédaction, le nom du pays, son code, puis
 * son identifiant. Le nom passe avant le code générique : c'est la donnée la
 * plus parlante, et la moins souvent mal saisie.
 */
export function isoDrapeau(pays) {
  if (!pays) return null;
  const code = String(pays.code || '').trim().toUpperCase();
  if (CODES_MAISON[code]) return CODES_MAISON[code];
  const parNom = NOMS[normaliserNom(pays.name)];
  if (parNom) return parNom;
  // L'identifiant d'un pays ajouté à la main est souvent son nom
  // (« cameroun »), même quand le nom affiché diffère (« Cameroun Nord »).
  return depuisCode(pays.code) || depuisCode(pays.id) || NOMS[normaliserNom(pays.id)] || null;
}

/** L'adresse du drapeau, servie par l'application, ou `null`. */
export function urlDrapeau(pays) {
  const iso = isoDrapeau(pays);
  return iso ? `/flags/${iso}.svg` : null;
}

/**
 * Le drapeau d'un code ISO 3166 à deux lettres, tel que le donne le champ
 * téléphone (« CM », « GB »), ou `null`.
 *
 * Pas de codes maison ici : pour le champ téléphone, « GB » est le
 * Royaume-Uni et « KY » les îles Caïmans, pas le Gabon et le Kenya de la
 * rédaction.
 */
export function urlDrapeauIso(code) {
  const iso = String(code || '').trim().toLowerCase();
  return iso.length === 2 && DRAPEAUX_DISPONIBLES.has(iso) ? `/flags/${iso}.svg` : null;
}
