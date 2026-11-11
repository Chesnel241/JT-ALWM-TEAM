import React from 'react';
import { FournisseurHabillage } from '../TexteJT.jsx';
import {
  NomBandeau, NomDeuxBlocs, NomLigne, NomPresentateur, NomDeuxInvites,
  TitreBandeau, TitreFilet, TitreBiseau, TitreBalayage, TitreVerre, TitreMassif,
  AlerteBandeau, Lieu, Citation,
  Generique, Transition, Flash, DerniereMinute, RappelTitres as RappelDesTitres, Fin, GrandTitre, Duplex, Defilant,
} from './paquet.jsx';

export const REGISTRY = {
  intro_jt: Generique,
  lower_third: NomBandeau, // alias historique
  nom_interview: NomBandeau,
  titre_reportage: TitreBandeau,
  transition_reportage: Transition,
  flash_info: Flash,
  breaking_news: DerniereMinute,
  rappel_titres: RappelDesTitres,
  fin_merci: Fin,
  envato_presenter: NomPresentateur,
  envato_news: AlerteBandeau,
  envato_big_title: GrandTitre,
  envato_ticker: Defilant,
  envato_split_screen: Duplex,
  envato_rep_minimal: TitreFilet,
  envato_rep_skew: TitreBiseau,
  envato_rep_swipe: TitreBalayage,
  envato_rep_glass: TitreVerre,
  envato_rep_massif: TitreMassif,
  envato_lt_compact: NomLigne,
  envato_lt_corporate: NomDeuxBlocs,
  envato_lt_interview: NomDeuxInvites,
  envato_loc_pin: Lieu,
  envato_quote: Citation,
};

/**
 * Les habillages qui n'ont de sens qu'avec un texte : un nom, un titre, une
 * alerte, une citation, un lieu.
 *
 * L'INCIDENT : un champ laissé vide affichait un texte de démonstration (un
 * faux nom, une fausse fonction, une fausse citation en anglais) dans l'aperçu
 * ET dans le JT diffusé. Un champ vide reste maintenant vide, et un habillage
 * sans aucun texte ne s'affiche pas du tout. Les exemples précis sont dans le
 * test `textes-de-demonstration`.
 */
const EXIGENT_UN_TEXTE = new Set([
  'nom_interview', 'lower_third', 'titre_reportage', 'flash_info',
  'envato_presenter', 'envato_news', 'envato_big_title', 'envato_split_screen',
  'envato_rep_minimal', 'envato_rep_skew', 'envato_rep_swipe', 'envato_rep_glass',
  'envato_rep_massif', 'envato_lt_compact', 'envato_lt_corporate',
  'envato_lt_interview', 'envato_loc_pin', 'envato_quote',
]);

/** Vrai si l'habillage porte au moins un texte saisi (les couleurs ne comptent pas). */
export function aDuTexte(overlay) {
  return Object.entries(overlay?.fields || {}).some(([cle, valeur]) => (
    typeof valeur === 'string' && valeur.trim() !== '' && !/^(color|bg)/i.test(cle)
  ));
}

export function Overlay({ overlay, durationInFrames }) {
  const Comp = REGISTRY[overlay.templateId];
  if (!Comp) return null;
  if (EXIGENT_UN_TEXTE.has(overlay.templateId) && !aDuTexte(overlay)) return null;

  // Chaque habillage du paquet place et colore lui-même ses calques.
  // Le fournisseur enveloppe les deux branches : c'est le seul point de passage
  // commun, et il évite d'enfiler trois propriétés à travers 23 gabarits pour
  // qu'une ligne de texte connaisse la durée de son habillage.
  return (
    <FournisseurHabillage overlay={overlay} durationInFrames={durationInFrames}>
      <Comp overlay={overlay} durationInFrames={durationInFrames} />
    </FournisseurHabillage>
  );
}
