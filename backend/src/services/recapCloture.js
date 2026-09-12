import logger from '../logger/index.js';
import { buildWeeks, weekUploadCutoff, CLOTURE } from '../data/constants.js';
import { wasReminderSent, markReminderSent } from '../data/store.js';
import { etatDesPays, MANQUE } from './manquants.js';
import { broadcastNotification, AUDIENCES } from '../routes/webpush.js';

/**
 * Le récapitulatif du dimanche 10h30.
 *
 * À l'instant de la clôture, l'équipe montage devait aller vérifier elle-même
 * ce qui était arrivé, pays par pays, sur le tableau de bord. L'échéance
 * devient un rendez-vous : le bilan part tout seul, et les deux monteurs
 * programmés savent en ouvrant leur téléphone sur quoi ils travaillent.
 *
 * Il ne part qu'UNE FOIS par semaine de production. Le marqueur est persisté
 * — même mécanique que les rappels — donc un redémarrage du serveur ne
 * relance pas la salve.
 */

// Fenêtre d'envoi : la demi-heure qui suit la clôture. Le service passe toutes
// les dix minutes, la fenêtre est donc large pour ne pas dépendre de l'instant
// exact du passage.
const FENETRE_APRES_MS = 30 * 60 * 1000;
const TICK_MS = 10 * 60 * 1000;

// Clé de marquage, rangée comme un rappel de pays pour réutiliser le même
// stockage persistant sans inventer une seconde mécanique.
const MARQUEUR = '_recap';

/** Le bilan d'une semaine, en clair. Exporté pour être testable et réutilisable. */
export function bilanSemaine(weekId) {
  const pays = etatDesPays(weekId);
  const complets = pays.filter((p) => p.manque === MANQUE.COMPLET);
  const sansVideo = pays.filter((p) => p.manque === MANQUE.SANS_VIDEO);
  const rien = pays.filter((p) => p.manque === MANQUE.RIEN_RECU);

  return {
    weekId,
    total: pays.length,
    complets: complets.map((p) => p.countryId),
    sansVideo: sansVideo.map((p) => p.countryId),
    rienRecu: rien.map((p) => p.countryId),
    nbFichiers: pays.reduce((somme, p) => somme + p.nbFichiers, 0),
  };
}

/** Le texte envoyé à l'équipe. Court : il s'affiche dans une notification. */
export function texteBilan(bilan) {
  const morceaux = [`${bilan.complets.length}/${bilan.total} pays prêts`];

  if (bilan.sansVideo.length) {
    morceaux.push(`sans vidéo : ${bilan.sansVideo.map((c) => c.toUpperCase()).join(', ')}`);
  }
  if (bilan.rienRecu.length) {
    morceaux.push(`rien reçu : ${bilan.rienRecu.map((c) => c.toUpperCase()).join(', ')}`);
  }
  if (!bilan.sansVideo.length && !bilan.rienRecu.length) {
    morceaux.push('tout le monde a envoyé');
  }

  return morceaux.join(' · ');
}

/**
 * Un passage. Exporté pour être testable sans attendre l'horloge.
 * Rend le bilan envoyé, ou `null` si ce n'était pas le moment.
 */
export async function runRecapPass(now = new Date()) {
  const semaine = buildWeeks(now).find((w) => w.status === 'active');
  if (!semaine) return null;

  const cloture = weekUploadCutoff(semaine.id);
  if (!cloture) return null;

  // Après la clôture, et pas plus d'une demi-heure après : un bilan qui part
  // trois heures plus tard n'aide plus personne à commencer son montage.
  const ecoule = now.getTime() - cloture.getTime();
  if (ecoule < 0 || ecoule > FENETRE_APRES_MS) return null;

  if (wasReminderSent(semaine.id, MARQUEUR)) return null;

  const bilan = bilanSemaine(semaine.id);
  try {
    await broadcastNotification({
      title: `Clôture ${CLOTURE.libelle} — ${semaine.libelle || semaine.name}`,
      body: texteBilan(bilan),
      url: '/monteurs',
    }, { audiences: [AUDIENCES.EDITOR] });
    markReminderSent(semaine.id, MARQUEUR);
    logger.info('Récapitulatif de clôture envoyé', { context: bilan });
    return bilan;
  } catch (err) {
    // Le marqueur n'est pas posé : le passage suivant réessaiera, tant qu'on
    // est encore dans la fenêtre.
    logger.warn('Récapitulatif de clôture non envoyé', { error: err.message });
    return null;
  }
}

let minuteur = null;

export function startRecapCloture() {
  if (minuteur) return minuteur;
  const battement = () => {
    runRecapPass().catch((err) => {
      logger.error('Passage de récapitulatif en échec', { error: err.message });
    });
  };
  battement();
  minuteur = setInterval(battement, TICK_MS);
  // Le récapitulatif ne doit pas retenir le process à l'arrêt.
  minuteur.unref?.();
  return minuteur;
}

export function stopRecapCloture() {
  if (minuteur) clearInterval(minuteur);
  minuteur = null;
}
