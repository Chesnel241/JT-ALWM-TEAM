/**
 * Le contrôle avant génération : ce qu'un œil exercé vérifierait avant de
 * lancer deux heures de rendu.
 *
 * LE CONSTAT : la seule vérification portait sur les fichiers manquants, côté
 * serveur. Un bandeau sans texte (qui ne s'affiche pas), un rush refusé resté
 * au déroulé, un plan d'une demi-seconde, deux titres l'un sur l'autre : tout
 * cela ne se découvrait qu'en regardant le master.
 *
 * Rien ici n'empêche de générer : le monteur décide. Calcul pur, sans React.
 */
import { computeTimelineLayout } from './timelineModel.js';
import { estCarton } from '../../../../remotion/src/plans.js';
import { OVERLAY_TEMPLATES } from '../../data/overlayTemplates.js';
import { EXIGENT_UN_TEXTE as EXIGENT_DU_MOTEUR } from '../../../../remotion/src/overlays/index.jsx';

/**
 * Les modèles qui ne s'affichent pas sans texte : la liste même du moteur,
 * plus « Les titres », qui ne dessine rien sans au moins un titre.
 */
const EXIGENT_UN_TEXTE = new Set([...EXIGENT_DU_MOTEUR, 'rappel_titres']);

const PLAN_TROP_COURT = 1;
const TOLERANCE_DUREE = 0.1;

const aDuTexte = (overlay) => Object.values(overlay?.fields || {}).some((v) => String(v ?? '').trim() !== '');
const idPlan = (clip, i) => clip?.instanceId || clip?.id || String(i);
const connu = (id) => OVERLAY_TEMPLATES.some((t) => t.id === id);

/**
 * Les remarques sur le montage, dans l'ordre du JT.
 *
 * Chaque remarque : `{ code, gravite: 'important' | 'conseil', planId?, rang?, instant?, valeurs }`.
 * Les textes vivent dans le dictionnaire (`studio.controle`) : ce module ne
 * dit que quoi et où.
 *
 * @param fichiers  vidéos et jingles connus de la semaine (`filename`, `status`)
 * @param jingles   jingles enregistrés (`categorie`, `filename`)
 * @param dureeCible durée visée du JT en minutes, ou rien
 */
export function controlerJT({ clips = [], overlays = [], fichiers = [], jingles = [], dureeCible = null }) {
  const remarques = [];
  const layout = computeTimelineLayout(clips);
  const parNom = new Map(fichiers.map((f) => [f.filename, f]));

  if (clips.length === 0) {
    remarques.push({ code: 'vide', gravite: 'important', valeurs: {} });
    return remarques;
  }

  layout.items.forEach((item, i) => {
    const clip = item.clip;
    const nom = clip.name || clip.filename;
    const ou = { planId: idPlan(clip, i), rang: i + 1, instant: item.start };
    if (!estCarton(clip)) {
      const fichier = parNom.get(clip.filename);
      if (fichier?.status === 'rejected') remarques.push({ code: 'refuse', gravite: 'important', ...ou, valeurs: { nom } });
      else if (!fichier && fichiers.length > 0) remarques.push({ code: 'introuvable', gravite: 'important', ...ou, valeurs: { nom } });
    }
    if (item.duration < PLAN_TROP_COURT) remarques.push({ code: 'court', gravite: 'conseil', ...ou, valeurs: { nom, duree: item.duration } });
    (clip.overlays || []).forEach((overlay) => {
      if (EXIGENT_UN_TEXTE.has(overlay.templateId) && !aDuTexte(overlay)) {
        remarques.push({ code: 'texteVide', gravite: 'important', ...ou, valeurs: { nom, modele: overlay.templateId } });
      }
    });
  });

  // Les titres de la piste T1 : sans texte, ou l'un sur l'autre.
  const titres = overlays
    .filter((o) => connu(o.templateId) || EXIGENT_UN_TEXTE.has(o.templateId))
    .map((o) => ({ o, debut: Number(o.startTime) || 0, fin: (Number(o.startTime) || 0) + (Number(o.duration) || 0) }))
    .sort((a, b) => a.debut - b.debut);
  titres.forEach(({ o, debut }) => {
    if (EXIGENT_UN_TEXTE.has(o.templateId) && !aDuTexte(o)) {
      remarques.push({ code: 'titreVide', gravite: 'important', instant: debut, valeurs: { modele: o.templateId } });
    }
  });
  for (let i = 1; i < titres.length; i += 1) {
    const a = titres[i - 1];
    const b = titres[i];
    // Une mention d'identification (le pays) peut accompagner un titre : ce
    // sont deux places différentes à l'écran. Deux titres, non.
    if (a.o.templateId === 'mention_image' || b.o.templateId === 'mention_image') continue;
    if (b.debut < a.fin - 0.05) remarques.push({ code: 'chevauchement', gravite: 'conseil', instant: b.debut, valeurs: { a: a.o.templateId, b: b.o.templateId } });
  }

  // La durée visée, à 10 % près.
  const cible = Number(dureeCible) * 60;
  if (cible > 0 && Math.abs(layout.total - cible) > cible * TOLERANCE_DUREE) {
    remarques.push({ code: 'duree', gravite: 'conseil', valeurs: { total: layout.total, cible } });
  }

  // Les jingles : enregistrés mais absents du déroulé.
  const auDeroule = new Set(clips.map((c) => c.filename));
  const generique = (jingles || []).filter((j) => j.categorie === 'generique');
  if (generique.length > 0 && !generique.some((j) => auDeroule.has(j.filename))) {
    remarques.push({ code: 'sansGenerique', gravite: 'conseil', valeurs: {} });
  }

  return remarques;
}

/** Vrai s'il reste quelque chose d'important à corriger. */
export const aCorriger = (remarques) => remarques.some((r) => r.gravite === 'important');
