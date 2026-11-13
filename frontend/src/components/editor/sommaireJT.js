/**
 * Le sommaire du JT, calculé depuis le déroulé au moment de lancer le rendu.
 *
 * LE BESOIN : un JT de trente minutes se regarde rarement d'une traite sur un
 * téléphone. Le correspondant veut aller droit à son reportage ; la rédaction
 * veut publier sur YouTube et Facebook avec des chapitres. Le déroulé sait
 * déjà où commence chaque partie : les jingles de rubrique, le carton « Les
 * titres », et le titre posé sur chaque reportage.
 *
 * Calcul pur, sans React. Les titres sont ceux du JT, donc en français.
 */
import { computeTimelineLayout } from './timelineModel.js';
import { estCarton } from '../../../../remotion/src/plans.js';
import { LIBELLE_ANNONCES, LIBELLE_SEMINAIRES } from './rubriquesAuto.js';

/** Les jingles qui ouvrent une partie. La virgule entre deux reportages, non. */
const PARTIES_DES_JINGLES = {
  generique: 'Générique',
  annonces: 'Annonces',
  seminaires: 'Séminaires',
  mot: 'Le mot du JT',
};

const OUVERTURE = 'Ouverture';

const titreDuReportage = (overlay) => {
  const titre = String(overlay?.fields?.titre || '').trim();
  const sous = String(overlay?.fields?.sous_titre || '').trim();
  if (!titre) return '';
  return sous && sous !== titre ? `${titre} — ${sous}` : titre;
};

/**
 * @param clips     le déroulé
 * @param overlays  les titres de la piste T1 (instants absolus)
 * @param jingles   les jingles enregistrés (`filename`, `categorie`)
 * @param sujetDe   fichier -> identifiant de son reportage (le suivi du
 *                  correspondant dit alors « votre reportage passe à 4:12 »)
 * @returns [{ t, titre, sujetId? }] : le premier à 0, dans l'ordre, un seul par instant
 */
export function sommaireDuJT({ clips = [], overlays = [], jingles = [], sujetDe = () => null } = {}) {
  const layout = computeTimelineLayout(clips);
  if (layout.items.length === 0) return [];
  const categorieDe = new Map((jingles || []).map((j) => [j.filename, j.categorie]));
  const reportageDe = (clip) => clip?.sujetId || sujetDe(clip?.filename) || null;
  // Le plan qui passe à cet instant (pour un titre posé sur la piste T1).
  const planA = (t) => layout.items.find((i) => t >= i.start - 0.05 && t < i.start + i.duration)?.clip || null;
  const parties = [];
  const ajouter = (t, titre, sujetId = null) => {
    const instant = Math.round(Number(t) * 10) / 10;
    if (titre && Number.isFinite(instant) && instant >= 0 && instant < layout.total) {
      parties.push({ t: instant, titre, ...(sujetId ? { sujetId } : {}) });
    }
  };

  layout.items.forEach((item) => {
    const clip = item.clip;
    const categorie = categorieDe.get(clip.filename);
    if (categorie) {
      ajouter(item.start, PARTIES_DES_JINGLES[categorie]);
      return;
    }
    if (estCarton(clip)) {
      if ((clip.overlays || []).some((o) => o.templateId === 'rappel_titres')) ajouter(item.start, 'Les titres');
      return;
    }
    (clip.overlays || []).forEach((o) => {
      if (o.templateId === 'titre_reportage') ajouter(item.start + (Number(o.startTime) || 0), titreDuReportage(o), reportageDe(clip));
    });
  });

  (overlays || []).forEach((o) => {
    if (o.templateId === 'titre_reportage') ajouter(o.startTime, titreDuReportage(o), reportageDe(planA(Number(o.startTime) || 0)));
  });

  // Une rubrique posée sans son jingle s'annonce par le bandeau du premier pays.
  for (const [libelle, titre] of [[LIBELLE_ANNONCES, 'Annonces'], [LIBELLE_SEMINAIRES, 'Séminaires']]) {
    if (parties.some((p) => p.titre === titre)) continue;
    const debut = (overlays || [])
      .filter((o) => o.templateId === 'mention_image' && String(o.fields?.texte || '').endsWith(` · ${libelle}`))
      .map((o) => Number(o.startTime) || 0)
      .sort((a, b) => a - b)[0];
    if (debut !== undefined) ajouter(debut, titre);
  }

  const vus = new Set();
  const sommaire = parties
    .sort((a, b) => a.t - b.t)
    .filter((p) => (vus.has(p.t) ? false : vus.add(p.t)));
  if (sommaire.length === 0) return [];
  // Le premier repère est au tout début : YouTube l'exige, et le lecteur
  // doit pouvoir revenir au début du journal.
  if (sommaire[0].t > 0.5) sommaire.unshift({ t: 0, titre: OUVERTURE });
  else sommaire[0] = { ...sommaire[0], t: 0 };
  return sommaire;
}
