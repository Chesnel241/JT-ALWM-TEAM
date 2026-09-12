import logger from '../logger/index.js';
import {
  getWeekUploads,
  getCustomCountries,
  wasReminderSent,
  markReminderSent,
} from '../data/store.js';
import { COUNTRIES, SPECIAL_BUCKETS, buildWeeks, weekUploadCutoff } from '../data/constants.js';
import { broadcastNotification, AUDIENCES } from '../routes/webpush.js';

/**
 * Rappel d'échéance aux pays qui n'ont encore rien envoyé.
 *
 * La relance se faisait à la main, un dimanche sur deux, en parcourant le
 * tableau de bord pays par pays. Ici elle part toute seule la veille de la
 * clôture, et seulement vers les correspondants dont le chutier est vide :
 * un pays qui a déjà envoyé n'a aucune raison d'être dérangé.
 *
 * Un pays n'est prévenu qu'une fois par semaine de production. Le marqueur
 * est persisté, donc un redémarrage du serveur ne relance pas la salve.
 */

// Fenêtre de rappel : la veille de la clôture. Le service tourne toutes les
// demi-heures ; la fenêtre est donc large pour ne pas dépendre de l'instant
// exact du passage.
const REMIND_FROM_MS = 26 * 60 * 60 * 1000;
const REMIND_UNTIL_MS = 18 * 60 * 60 * 1000;
const TICK_MS = 30 * 60 * 1000;

/** Pays réellement attendus : ni bucket technique, ni rubrique de montage. */
function expectedCountries() {
  const custom = getCustomCountries();
  const all = [...COUNTRIES, ...(Array.isArray(custom) ? custom : [])];
  const seen = new Set();
  return all.filter((c) => {
    if (!c || !c.id) return false;
    if (c.id === 'tj' || SPECIAL_BUCKETS.has(c.id)) return false;
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

/** Semaine en cours de collecte, ou null. */
function activeWeek(now) {
  return buildWeeks(now).find((w) => w.status === 'active') || null;
}

/**
 * Un passage. Exporté pour être testable sans attendre l'horloge.
 * Retourne les pays effectivement prévenus.
 */
export async function runReminderPass(now = new Date()) {
  const week = activeWeek(now);
  if (!week) return [];

  const cutoff = weekUploadCutoff(week.id);
  if (!cutoff) return [];

  const remaining = cutoff.getTime() - now.getTime();
  if (remaining > REMIND_FROM_MS || remaining < REMIND_UNTIL_MS) return [];

  const uploads = getWeekUploads(week.id);
  const notified = [];

  for (const country of expectedCountries()) {
    const files = uploads[country.id];
    if (Array.isArray(files) && files.length > 0) continue;
    if (wasReminderSent(week.id, country.id)) continue;

    try {
      await broadcastNotification({
        title: 'Votre reportage est attendu',
        body: `Il reste moins de 24 h pour envoyer le reportage ${country.name}. Dernier délai : dimanche 10h30 (GMT+2).`,
        url: `/journalistes/${country.id}`,
      }, { audiences: [AUDIENCES.REPORTER], countryId: country.id });
      markReminderSent(week.id, country.id);
      notified.push(country.id);
    } catch (err) {
      // Un pays injoignable ne doit pas empêcher les autres d'être prévenus,
      // et son marqueur n'est pas posé : il sera retenté au passage suivant.
      logger.warn('Rappel d\'échéance non envoyé', { countryId: country.id, error: err.message });
    }
  }

  if (notified.length) {
    logger.info('Rappels d\'échéance envoyés', { context: { weekId: week.id, countries: notified } });
  }
  return notified;
}

let timer = null;

export function startDeadlineReminders() {
  if (timer) return timer;
  const tick = () => {
    runReminderPass().catch((err) => {
      logger.error('Passage de rappel en échec', { error: err.message });
    });
  };
  tick();
  timer = setInterval(tick, TICK_MS);
  // Le rappel ne doit pas retenir le process à l'arrêt.
  timer.unref?.();
  return timer;
}

export function stopDeadlineReminders() {
  if (timer) clearInterval(timer);
  timer = null;
}
