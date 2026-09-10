/**
 * Numéro WhatsApp de contact, mémorisé PAR PAYS.
 *
 * Une ancienne clé globale `uploader_phone` servait de repli quand le pays
 * n'avait pas encore le sien. Résultat : le premier numéro saisi sur
 * n'importe quel pays réapparaissait sur tous les autres, et le corriger sur
 * un pays ne changeait rien puisque le repli global reprenait la main au
 * rechargement. Le repli est supprimé, et la clé globale est effacée au
 * passage pour que le numéro parasite disparaisse des appareils qui l'ont
 * encore en mémoire.
 */

const LEGACY_GLOBAL_KEY = 'uploader_phone';

function keyFor(countryId) {
  return `uploader_phone_${countryId}`;
}

/** Purge l'ancienne clé partagée. Appelée à chaque lecture, sans bruit. */
function dropLegacyGlobal() {
  try {
    localStorage.removeItem(LEGACY_GLOBAL_KEY);
  } catch {
    /* stockage indisponible : rien à purger */
  }
}

/** Numéro enregistré pour ce pays, ou '' s'il n'y en a pas. */
export function readCountryPhone(countryId) {
  dropLegacyGlobal();
  if (!countryId) return '';
  try {
    return (localStorage.getItem(keyFor(countryId)) || '').trim();
  } catch {
    return '';
  }
}

export function saveCountryPhone(countryId, phone) {
  dropLegacyGlobal();
  if (!countryId) return;
  try {
    localStorage.setItem(keyFor(countryId), String(phone || '').trim());
  } catch {
    /* stockage indisponible : le numéro reste envoyé au serveur */
  }
}

export function forgetCountryPhone(countryId) {
  if (!countryId) return;
  try {
    localStorage.removeItem(keyFor(countryId));
  } catch {
    /* ignore */
  }
}

/** Un numéro est exploitable à partir de quelques chiffres. */
export function isUsablePhone(phone) {
  return String(phone || '').trim().length >= 5;
}
