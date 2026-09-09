/**
 * Indicatif téléphonique par défaut du champ WhatsApp.
 *
 * Les identifiants pays du store sont des codes ISO alpha-2 (cm, sn, ci...),
 * directement exploitables par le champ téléphone. Les entrées maison (tj pour
 * « Titres & Rappels », mj pour « Mot du JT ») n'en sont pas : on retombe alors
 * sur la France. Sans ça, un correspondant camerounais devait retrouver son
 * pays dans une liste de deux cents entrées, proposée par défaut sur la France.
 */
const ISO_ALPHA2 = /^[a-z]{2}$/;
const NON_COUNTRY_IDS = ['tj', 'mj'];

export function phoneCountryFor(countryId) {
  const id = String(countryId || '').toLowerCase();
  return ISO_ALPHA2.test(id) && !NON_COUNTRY_IDS.includes(id) ? id.toUpperCase() : 'FR';
}
