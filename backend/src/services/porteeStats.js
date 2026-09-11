/**
 * Compteurs d'accès, par pays.
 *
 * Le cran `observe` de la portée (voir middleware/portee.js) ne refuse rien :
 * il compte ce qu'il aurait refusé. Sans ces compteurs, ce cran ne servirait
 * à rien — c'est lui qui répond à la seule question qui décide de la bascule
 * en `strict` : quels pays travaillent encore sans lien personnel ?
 *
 * Tout est en mémoire, et repart à zéro au redémarrage. C'est délibéré : on
 * mesure une campagne de distribution de liens, pas un historique à
 * conserver, et on ne veut pas écrire sur le disque à chaque requête.
 */

import logger from '../logger/index.js';

// Un pays très actif produirait une ligne de journal par requête. Une ligne
// par (pays, décision) et par tranche suffit à laisser une trace ; les
// compteurs font le reste.
const FENETRE_LOG_MS = 10 * 60 * 1000;

export const DECISIONS = Object.freeze({
  REDACTION: 'redaction',   // mot de passe montage valide
  IDENTIFIE: 'identifie',   // lien personnel du bon pays
  ANONYME: 'anonyme',       // aucun lien : refusé en strict
  HORS_PAYS: 'horsPays',    // lien d'un autre pays : refusé en strict
});

const compteurs = new Map();
const dernierLog = new Map();
let depuis = new Date().toISOString();

function ligne(pays) {
  if (!compteurs.has(pays)) {
    compteurs.set(pays, {
      pays,
      redaction: 0,
      identifie: 0,
      anonyme: 0,
      horsPays: 0,
      dernierAnonyme: null,
      dernierHorsPays: null,
    });
  }
  return compteurs.get(pays);
}

/**
 * Enregistre une décision de portée.
 *
 * @param {string} pays — pays visé par la requête
 * @param {string} decision — une valeur de DECISIONS
 * @param {{niveau?: string, paysDuLien?: string, chemin?: string}} [contexte]
 */
export function noteAcces(pays, decision, contexte = {}) {
  const cible = String(pays || '').trim().toLowerCase();
  if (!cible) return;

  const entree = ligne(cible);
  if (Object.prototype.hasOwnProperty.call(entree, decision)) {
    entree[decision] += 1;
  }
  const maintenant = new Date().toISOString();
  if (decision === DECISIONS.ANONYME) entree.dernierAnonyme = maintenant;
  if (decision === DECISIONS.HORS_PAYS) entree.dernierHorsPays = maintenant;

  // Seules les décisions qui bloqueraient en `strict` méritent un journal.
  if (decision !== DECISIONS.ANONYME && decision !== DECISIONS.HORS_PAYS) return;

  const cle = `${cible}:${decision}`;
  const precedent = dernierLog.get(cle) || 0;
  if (Date.now() - precedent < FENETRE_LOG_MS) return;
  dernierLog.set(cle, Date.now());

  logger.info('Portée correspondant', {
    context: {
      pays: cible,
      decision,
      niveau: contexte.niveau,
      paysDuLien: contexte.paysDuLien || null,
      chemin: contexte.chemin || null,
    },
  });
}

/** Rollup lisible : quels pays travaillent encore sans lien personnel ? */
export function lireEtat() {
  const pays = [...compteurs.values()]
    .map((entree) => ({ ...entree }))
    .sort((a, b) => (b.anonyme + b.horsPays) - (a.anonyme + a.horsPays) || a.pays.localeCompare(b.pays));

  return {
    depuis,
    // Un pays est « prêt » quand plus aucun accès anonyme ou hors-pays n'a
    // été observé pour lui depuis le dernier redémarrage.
    paysNonPrets: pays.filter((p) => p.anonyme > 0 || p.horsPays > 0).map((p) => p.pays),
    pays,
  };
}

export function reinitialiserStats() {
  compteurs.clear();
  dernierLog.clear();
  depuis = new Date().toISOString();
}
