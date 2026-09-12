import logger from '../logger/index.js';
import { wasReminderSent, markReminderSent } from '../data/store.js';
import { buildWeeks, weekUploadCutoff, CLOTURE } from '../data/constants.js';
import { paysARelancer, MANQUE } from '../services/manquants.js';
import { broadcastNotification, AUDIENCES } from '../routes/webpush.js';

/**
 * Rappel d'échéance aux pays qui n'ont encore rien envoyé.
 *
 * La relance se faisait à la main, un dimanche sur deux, en parcourant le
 * tableau de bord pays par pays. Ici elle part toute seule la veille de la
 * clôture, et seulement vers les correspondants qui n'ont pas de quoi être
 * montés : un pays qui a envoyé sa vidéo n'a aucune raison d'être dérangé.
 *
 * Elle ne visait au départ que les chutiers COMPLÈTEMENT vides. Un pays ayant
 * déposé une photo, ou un script sans vidéo, passait donc pour servi et
 * n'était jamais relancé — alors qu'aucun de ces envois ne se monte. La règle
 * partagée avec le panneau de relance de la rédaction (`services/manquants.js`)
 * dit qu'un pays est en règle quand il a envoyé au moins une vidéo.
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

  const notified = [];

  for (const pays of paysARelancer(week.id)) {
    if (wasReminderSent(week.id, pays.countryId)) continue;

    // Le message dit ce qui manque vraiment : « rien reçu » et « reçu mais
    // pas de vidéo » n'appellent pas le même geste du correspondant.
    const corps = pays.manque === MANQUE.SANS_VIDEO
      ? `Nous avons bien reçu ${pays.nbFichiers} fichier(s) pour ${pays.nom}, mais aucune vidéo. Dernier délai : ${CLOTURE.libelle}.`
      : `Il reste moins de 24 h pour envoyer le reportage ${pays.nom}. Dernier délai : ${CLOTURE.libelle}.`;

    try {
      await broadcastNotification({
        title: 'Votre reportage est attendu',
        body: corps,
        url: `/journalistes/${pays.countryId}`,
      }, { audiences: [AUDIENCES.REPORTER], countryId: pays.countryId });
      markReminderSent(week.id, pays.countryId);
      notified.push(pays.countryId);
    } catch (err) {
      // Un pays injoignable ne doit pas empêcher les autres d'être prévenus,
      // et son marqueur n'est pas posé : il sera retenté au passage suivant.
      logger.warn('Rappel d\'échéance non envoyé', { countryId: pays.countryId, error: err.message });
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
