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

/**
 * Le débit d'un envoi, en octets par seconde, lissé.
 *
 * LE BESOIN : « 37 % » ne dit pas si l'on attendra deux minutes ou une
 * heure. Sur une 4G qui va et vient, le débit instantané saute d'un
 * extrême à l'autre ; une moyenne glissante (exponentielle) donne une
 * estimation qui ne clignote pas.
 *
 * `precedent` est la mesure d'avant (ou null) ; on la renvoie inchangée
 * tant que moins d'une demi-seconde s'est écoulée, pour ne pas diviser par
 * presque rien.
 */
export function mesurerDebit(precedent, envoyes, maintenant, lissage = 0.3) {
  const octets = Number(envoyes);
  const instant = Number(maintenant);
  if (!Number.isFinite(octets) || !Number.isFinite(instant)) return precedent || null;
  if (!precedent) return { envoyes: octets, instant, debit: 0 };
  const duree = (instant - precedent.instant) / 1000;
  if (duree < 0.5) return precedent;
  const gagnes = octets - precedent.envoyes;
  // Une reprise repart d'un décalage plus bas : on recommence la mesure.
  if (gagnes < 0) return { envoyes: octets, instant, debit: precedent.debit };
  const vitesse = gagnes / duree;
  const debit = precedent.debit > 0 ? lissage * vitesse + (1 - lissage) * precedent.debit : vitesse;
  return { envoyes: octets, instant, debit };
}

/** Secondes restantes, ou null tant qu'on ne sait pas encore. */
export function secondesRestantes(total, envoyes, debit) {
  const reste = Number(total) - Number(envoyes);
  if (!Number.isFinite(reste) || reste < 0 || !(debit > 0)) return null;
  return Math.round(reste / debit);
}

/** Au-delà d'une demi-heure, on conseille le Wi-Fi. */
export const SEUIL_CONSEIL_WIFI = 30 * 60;

/**
 * La durée, arrondie comme on la dirait : « moins d'une minute »,
 * « environ 6 min », « environ 1 h 20 ». `d` est le bloc du dictionnaire.
 */
export function dureeRestante(secondes, d) {
  if (secondes == null) return '';
  if (secondes < 60) return d.moinsDuneMinute;
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return d.environMinutes(minutes);
  const heures = Math.floor(minutes / 60);
  const reste = Math.round((minutes % 60) / 5) * 5;
  return d.environHeures(heures, reste === 60 ? 55 : reste);
}

/** « 12 Mo », « 1,2 Go » : la quantité, à la française ou à l'anglaise. */
export function octetsLisibles(octets, lang = 'fr') {
  const n = Number(octets);
  if (!Number.isFinite(n) || n < 0) return '';
  const fr = lang !== 'en';
  const nombre = (v, dec) => v.toLocaleString(fr ? 'fr-FR' : 'en-GB', { maximumFractionDigits: dec });
  if (n < 1024 * 1024) return `${nombre(n === 0 ? 0 : Math.max(1, Math.round(n / 1024)), 0)} ${fr ? 'Ko' : 'KB'}`;
  if (n < 1024 * 1024 * 1024) return `${nombre(n / (1024 * 1024), n < 10 * 1024 * 1024 ? 1 : 0)} ${fr ? 'Mo' : 'MB'}`;
  return `${nombre(n / (1024 * 1024 * 1024), 1)} ${fr ? 'Go' : 'GB'}`;
}

/**
 * Le temps qu'il reste à un rendu de master, d'après son avancement observé
 * depuis `depart` ({ t, pourcent }). Rend des secondes, ou `null` tant qu'on
 * n'a pas vu assez d'avancement pour le dire sans mentir (au moins une
 * minute et deux points gagnés).
 */
export function resteRendu(depart, maintenant, pourcent) {
  if (!depart || !(pourcent < 100)) return null;
  const ecoule = (maintenant - depart.t) / 1000;
  const gagne = pourcent - depart.pourcent;
  if (ecoule < 60 || gagne < 2) return null;
  return Math.round((ecoule / gagne) * (100 - pourcent));
}

/** « 4:07 » sous une heure, « 2:04:07 » au-delà. */
export function chronometre(secondes) {
  const s = Math.max(0, Math.floor(secondes));
  const deux = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return h ? `${h}:${deux(Math.floor((s % 3600) / 60))}:${deux(s % 60)}` : `${Math.floor(s / 60)}:${deux(s % 60)}`;
}
