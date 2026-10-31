/**
 * Le voyage d'un fichier, de l'appareil du correspondant à la rédaction.
 *
 * LE BESOIN : une barre de progression seule ne dit pas ce qui se passe. Un
 * correspondant voyait la barre atteindre 99 % puis ne plus bouger pendant
 * la compression, et croyait l'envoi bloqué. Trois étapes nommées —
 * *Envoi*, *Traitement*, *Reçu* — disent où en est chaque fichier, et ce
 * qu'il faut faire quand il s'arrête (attendre le réseau, ou réessayer).
 *
 * Un envoi en cours a la forme posée par UploaderView :
 * `{ status: 'uploading'|'queued'|'error'|'completed',
 *    phase: 'uploading'|'processing'|'done'|'queued', progress: 0..100 }`.
 */

/**
 * @returns {Array<{cle: 'envoi'|'traitement'|'recu',
 *   etat: 'avenir'|'actif'|'fait'|'attente'|'erreur'}>}
 */
export function etapesEnvoi(envoi) {
  const status = envoi?.status;
  const phase = envoi?.phase;
  const etapes = (envoiEtat, traitementEtat, recuEtat) => [
    { cle: 'envoi', etat: envoiEtat },
    { cle: 'traitement', etat: traitementEtat },
    { cle: 'recu', etat: recuEtat },
  ];

  if (status === 'completed' || phase === 'done') return etapes('fait', 'fait', 'fait');
  if (status === 'error') return etapes('erreur', 'avenir', 'avenir');
  if (status === 'queued' || phase === 'queued') return etapes('attente', 'avenir', 'avenir');
  if (phase === 'processing') return etapes('fait', 'actif', 'avenir');
  return etapes('actif', 'avenir', 'avenir');
}

/**
 * Où dessiner le fichier sur la liaison pays → rédaction, de 0 à 1.
 *
 * Il avance au pourcentage réel pendant l'envoi, attend à l'arrivée pendant
 * le traitement, et reste au départ s'il attend le réseau ou a échoué.
 */
export function positionSurLiaison(envoi) {
  const [envoiEtape] = etapesEnvoi(envoi);
  if (envoiEtape.etat === 'fait') return 1;
  if (envoiEtape.etat !== 'actif') return 0;
  const p = Number(envoi?.progress);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p / 100)) : 0;
}

/** Vrai tant qu'un envoi n'est ni reçu ni définitivement échoué. */
export function estEnVol(envoi) {
  const s = envoi?.status;
  if (s) return s === 'uploading' || s === 'queued';
  // Une entrée sans statut se lit à sa phase.
  const p = envoi?.phase;
  return p === 'uploading' || p === 'processing' || p === 'queued';
}
