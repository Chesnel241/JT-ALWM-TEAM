/**
 * L'historique d'un montage : ce que « Annuler » doit rendre.
 *
 * L'incident
 * ----------
 * La pile ne contenait que des instantanés de `clips`, et elle vivait dans
 * `Timeline.jsx`. Deux conséquences, toutes deux vécues par les monteurs :
 *
 * 1. **Les titres, l'habillage et les sous-titres n'étaient pas annulables.**
 *    Supprimer un bandeau d'un clic était définitif.
 * 2. **Taper une lettre dans l'inspecteur effaçait toute la pile.** L'aperçu
 *    en direct réécrit les clips à chaque frappe ; la timeline voyait passer
 *    une modification « venue d'ailleurs » et repartait de zéro. Corriger une
 *    faute dans un titre faisait perdre la coupe faite deux minutes plus tôt.
 *
 * Ce module ne connaît donc plus les clips seuls, mais **l'état de montage
 * entier** — clips, titres de la piste T1, habillage global. C'est ce que le
 * monteur appelle « mon travail », et c'est la seule unité qu'il ait envie
 * d'annuler.
 *
 * Il n'importe rien, ne lit ni l'heure ni le DOM, et se teste comme des
 * mathématiques — même convention que `timelineModel.js` à côté, et que
 * `semaine.js` côté serveur pour l'heure passée en argument.
 */

/** Au-delà, on oublie : une pile sans fin finit par peser plus qu'elle ne sert. */
export const PROFONDEUR = 50;

/**
 * Deux modifications de même nature, faites coup sur coup, n'en font qu'une.
 *
 * Sans cette fenêtre, taper un titre de quarante caractères produirait
 * quarante entrées et « Annuler » reculerait d'une lettre à la fois — ce qui
 * revient à ne pas avoir d'annulation du tout. C'est la règle de tous les
 * éditeurs de texte.
 */
export const FUSION_MS = 900;

/** Une pile vide. */
export function creerHistorique() {
  return { passe: [], futur: [], derniere: null };
}

/** Peut-on revenir en arrière ? En avant ? */
export const peutAnnuler = (h) => h.passe.length > 0;
export const peutRetablir = (h) => h.futur.length > 0;

/**
 * Enregistre l'état **d'avant** la modification.
 *
 * **Sans étiquette, rien ne fusionne** — et c'est le cas de tous les gestes
 * discrets : couper, supprimer, réordonner, poser une transition. Supprimer
 * deux clips coup sur coup doit demander deux annulations.
 *
 * L'étiquette est réservée à ce qui émet en continu : la frappe dans
 * l'inspecteur et le glissé à la souris. Deux étiquettes identiques
 * rapprochées fusionnent ; deux étiquettes différentes ne fusionnent jamais,
 * même à la milliseconde — couper puis taper sont deux gestes, et le monteur
 * veut défaire la frappe sans défaire la coupe.
 *
 * `maintenant` est passé par l'appelant : c'est ce qui garde ce module pur et
 * ses tests déterministes.
 *
 * `fenetre` ouvre le cas du geste continu. Un glissé de titre émet une
 * modification par mouvement de souris et peut durer plusieurs secondes ; son
 * étiquette porte alors un identifiant tiré au début du geste, donc aucune
 * autre entrée ne peut la partager. La fenêtre n'a plus rien à protéger, et on
 * passe `Infinity` : sans quoi un glissé lent se découperait en trois entrées
 * et il faudrait annuler trois fois pour défaire un seul déplacement.
 */
export function enregistrer(historique, etatAvant, { etiquette = null, maintenant = 0, fenetre = FUSION_MS } = {}) {
  const derniere = historique.derniere;
  const fusionne = derniere
    && etiquette != null
    && derniere.etiquette === etiquette
    && maintenant - derniere.instant <= fenetre;

  // En fusionnant, on garde l'état le PLUS ANCIEN : annuler doit ramener avant
  // le premier caractère de la salve, pas avant le dernier.
  const passe = fusionne ? historique.passe : [...historique.passe, etatAvant].slice(-PROFONDEUR);

  return {
    passe,
    // Toute nouvelle modification referme le futur : on ne peut pas rétablir
    // une branche qu'on vient d'abandonner.
    futur: [],
    derniere: { etiquette, instant: maintenant },
  };
}

/** Recule d'un cran. Rend la nouvelle pile et l'état à appliquer. */
export function annuler(historique, etatCourant) {
  if (!peutAnnuler(historique)) return { historique, etat: null };
  const etat = historique.passe[historique.passe.length - 1];
  return {
    historique: {
      passe: historique.passe.slice(0, -1),
      futur: [etatCourant, ...historique.futur].slice(0, PROFONDEUR),
      // La salve est close : la frappe suivante ne doit pas fusionner avec
      // celle d'avant l'annulation.
      derniere: null,
    },
    etat,
  };
}

/** Avance d'un cran. */
export function retablir(historique, etatCourant) {
  if (!peutRetablir(historique)) return { historique, etat: null };
  const etat = historique.futur[0];
  return {
    historique: {
      passe: [...historique.passe, etatCourant].slice(-PROFONDEUR),
      futur: historique.futur.slice(1),
      derniere: null,
    },
    etat,
  };
}

/**
 * Repart de zéro.
 *
 * Réservé à ce qui vient d'ailleurs : hydratation d'une semaine, notification
 * socket d'un collègue, adoption de la copie serveur après un 409. Annuler
 * l'arrivée d'un collègue réécraserait son travail en silence — et lui, il ne
 * verrait rien.
 */
export function reinitialiser() {
  return creerHistorique();
}

/** L'étiquette d'un geste continu : unique, donc jamais confondue. */
export function etiquetteGeste(nature) {
  return `${nature}:${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * L'étiquette d'une saisie dans l'inspecteur.
 *
 * Une par champ : corriger le titre puis le sous-titre sont deux gestes, et
 * les fusionner ferait disparaître les deux d'un seul « Annuler ».
 */
export function etiquetteSaisie(cible, champ) {
  return `saisie:${cible || '?'}:${champ || '?'}`;
}
