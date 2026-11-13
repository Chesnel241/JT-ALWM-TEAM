/**
 * Le JT en un clic : tout le journal posé dans l'ordre du gabarit.
 *
 * LE CONSTAT : même avec les rubriques automatiques, le monteur reconstruisait
 * à la main la charpente de chaque JT — le générique, « Les titres » qu'il
 * fallait réécrire, chaque reportage avec son titre, la virgule entre deux
 * reportages, le jingle avant chaque rubrique, la fin. C'est toujours la même
 * charpente. Ici, elle est posée d'un coup ; le monteur vérifie et ajuste.
 *
 * Ordre du journal (celui des jingles) :
 *   générique → les titres → reportages (virgule entre chacun) → annonces →
 *   séminaires → mot du JT → fin.
 *
 * Calcul pur, sans React : il se teste seul.
 */
import { classifyFile } from '../../lib/mediaTypes.js';
import { animationRecommandee } from '../../data/overlayTemplates.js';
import { CARTON, DUREE_MAX_CARTON } from '../../../../remotion/src/plans.js';
import {
  LIBELLE_ANNONCES, LIBELLE_SEMINAIRES, TIROIR_MOT_DU_JT, blocsParPays, parDateEnvoi, poserBlocs,
} from './rubriquesAuto.js';

/** Les sections fixes d'un pays, qui ne sont pas des reportages. */
export const LIBELLE_ASSEMBLE = 'Reportage Assemblé';
const SECTIONS_FIXES = new Set([LIBELLE_ANNONCES, LIBELLE_SEMINAIRES, LIBELLE_ASSEMBLE]);
const TIROIRS_DU_JT = new Set(['tj', 'mj']);

/** « Les titres » : cinq au plus, le temps de lire chacun. */
export const MAX_TITRES = 5;
const SECONDES_PAR_TITRE = 2.6;
const DUREE_FIN = 5;

/** La durée du carton des titres : l'ouverture, puis chaque titre. */
export const dureeTitres = (n) => Math.round((0.4 + n * SECONDES_PAR_TITRE + 0.3) * 30) / 30;

/** Un carton : un plan sans vidéo, avec son habillage plein écran. */
export function planCarton({ id, nom, duree, overlay }) {
  return {
    instanceId: id,
    filename: CARTON,
    name: nom,
    carton: true,
    inPoint: 0,
    outPoint: duree,
    durationSec: duree,
    // Rallongeable sur la timeline : la « source » d'un carton est longue.
    sourceDurationSec: DUREE_MAX_CARTON,
    overlays: overlay ? [overlay] : [],
  };
}

const video = (f) => f.status !== 'rejected' && !TIROIRS_DU_JT.has(f.countryId) && classifyFile({ name: f.filename || f.name }) === 'video';

/**
 * Les reportages de la semaine, un par sujet, dans l'ordre du JT : par pays
 * (ordre alphabétique), puis dans l'ordre où le pays les a ouverts.
 *
 * Un « Reportage assemblé » déposé par la rédaction est le reportage fini du
 * pays : il remplace ses rushes bruts, qui ne sont alors pas repris.
 */
export function reportagesDeLaSemaine(videos, sujets = [], nomPays = (id) => id) {
  const sujetsParId = new Map(sujets.map((s) => [s.id, s]));
  const rangSujet = new Map(sujets.map((s, i) => [s.id, i]));
  const assembles = new Set(videos.filter((f) => video(f) && f.reportage === LIBELLE_ASSEMBLE).map((f) => f.countryId));
  const groupes = new Map();
  for (const f of videos) {
    if (!video(f)) continue;
    const assemble = f.reportage === LIBELLE_ASSEMBLE;
    if (!assemble && SECTIONS_FIXES.has(f.reportage)) continue;
    if (!assemble && assembles.has(f.countryId)) continue;
    const cle = assemble ? `${f.countryId}::assemble` : `${f.countryId}::${f.sujetId || f.reportage || ''}`;
    if (!groupes.has(cle)) {
      const sujet = f.sujetId ? sujetsParId.get(f.sujetId) : null;
      groupes.set(cle, {
        paysId: f.countryId,
        pays: nomPays(f.countryId) || f.countryId,
        titre: String(sujet?.titre || (assemble ? '' : f.reportage) || '').trim(),
        rang: sujet ? rangSujet.get(sujet.id) : Number.MAX_SAFE_INTEGER,
        fichiers: [],
      });
    }
    groupes.get(cle).fichiers.push(f);
  }
  return [...groupes.values()]
    .map((g) => ({ ...g, fichiers: g.fichiers.sort(parDateEnvoi) }))
    .sort((a, b) => a.pays.localeCompare(b.pays, 'fr') || a.rang - b.rang || a.titre.localeCompare(b.titre, 'fr'));
}

/** Le premier jingle d'une catégorie, s'il y en a un. */
const jingleDe = (jingles, categorie) => (jingles || []).find((j) => j.categorie === categorie) || null;

/**
 * Le JT entier, du générique à la fin.
 *
 * @param videos    vidéos de la semaine
 * @param sons      fichiers audio de la semaine (voix off des annonces…)
 * @param sujets    sujets de la semaine (`id`, `titre`, `countryId`)
 * @param jingles   jingles enregistrés (`categorie`, `filename`…)
 * @param versClip  fichier -> plan du déroulé (durée connue)
 * @param versSon   (fichier, instant) -> son de la piste, ou null
 * @param creerId   générateur d'identifiants
 * @returns { clips, overlays, audio, bilan }
 */
export function composerJT({
  videos = [], sons = [], sujets = [], jingles = [], nomPays = (id) => id,
  versClip, versSon = null, creerId, motDuJt = null,
}) {
  const bilan = { reportages: 0, pays: 0, titres: 0, jingles: 0, annonces: 0, seminaires: 0, motDuJt: 0, voix: 0, sansJingle: [] };
  const blocs = [];
  const poserJingle = (categorie) => {
    const jingle = jingleDe(jingles, categorie);
    if (!jingle) { bilan.sansJingle.push(categorie); return; }
    blocs.push({ genre: 'jingle', plans: [{ ...versClip(jingle), name: jingle.name || jingle.filename }] });
    bilan.jingles += 1;
  };

  // 1. Le générique.
  poserJingle('generique');

  // 2. Les titres : ceux des reportages, dans l'ordre où ils passeront.
  const reportages = reportagesDeLaSemaine(videos, sujets, nomPays);
  const titres = reportages
    .map((r) => r.titre || r.pays)
    .filter((titre, i, liste) => titre && liste.indexOf(titre) === i)
    .slice(0, MAX_TITRES);
  if (titres.length > 0) {
    const fields = Object.fromEntries(titres.map((titre, i) => [`titre${i + 1}`, titre]));
    blocs.push({
      genre: 'carton',
      plans: [planCarton({
        id: creerId('carton'),
        nom: 'Les titres',
        duree: dureeTitres(titres.length),
        overlay: { id: creerId('overlay'), templateId: 'rappel_titres', fields, animation: animationRecommandee('rappel_titres'), startTime: 0, duration: null },
      })],
    });
    bilan.titres = titres.length;
  }

  // 3. Les reportages, chacun avec son titre ; la virgule entre deux.
  const pays = new Set();
  reportages.forEach((reportage, i) => {
    if (i > 0) poserJingle('reportages');
    blocs.push({
      plans: reportage.fichiers.map(versClip),
      titre: { titre: reportage.titre || reportage.pays, sous_titre: reportage.titre ? reportage.pays : '' },
    });
    pays.add(reportage.paysId);
    bilan.reportages += 1;
  });
  bilan.pays = pays.size;

  // 4 et 5. Les annonces, puis les séminaires : un bloc par pays, son bandeau
  // tout du long, et ses voix off.
  const sonsDuBloc = (libelle, paysId) => (versSon ? sons : [])
    .filter((f) => f.reportage === libelle && f.countryId === paysId && f.status !== 'rejected')
    .filter((f) => classifyFile({ name: f.filename || f.name }) === 'audio')
    .sort(parDateEnvoi);
  for (const [libelle, cle, categorie] of [[LIBELLE_ANNONCES, 'annonces', 'annonces'], [LIBELLE_SEMINAIRES, 'seminaires', 'seminaires']]) {
    const section = blocsParPays(videos, libelle, nomPays);
    if (section.length === 0) continue;
    poserJingle(categorie);
    for (const bloc of section) {
      const voix = sonsDuBloc(libelle, bloc.id);
      bilan.voix += voix.length;
      blocs.push({ plans: bloc.fichiers.map(versClip), bandeau: { texte: `${bloc.nom} · ${libelle}` }, voix });
      bilan[cle] += 1;
    }
  }

  // 6. Le mot du JT, avec le nom et le thème saisis par le journaliste.
  const mots = videos.filter((v) => v.countryId === TIROIR_MOT_DU_JT && v.status !== 'rejected').sort(parDateEnvoi);
  if (mots.length > 0) {
    poserJingle('mot');
    const orateur = String(motDuJt?.orateur || '').trim();
    for (const mot of mots) {
      blocs.push({ plans: [versClip(mot)], nomOrateur: orateur ? { nom: orateur, fonction: String(motDuJt?.theme || '').trim() } : null });
      bilan.motDuJt += 1;
    }
  }

  // Sans aucun contenu, il n'y a pas de JT à poser : un générique seul ne
  // ferait que remplacer le déroulé par rien.
  if (bilan.reportages + bilan.annonces + bilan.seminaires + bilan.motDuJt === 0) {
    return { clips: [], overlays: [], audio: [], bilan };
  }

  // 7. La fin.
  {
    blocs.push({
      genre: 'carton',
      plans: [planCarton({
        id: creerId('carton'),
        nom: 'Fin du JT',
        duree: DUREE_FIN,
        overlay: { id: creerId('overlay'), templateId: 'fin_merci', fields: {}, animation: animationRecommandee('fin_merci'), startTime: 0, duration: null },
      })],
    });
  }

  return { ...poserBlocs({ clips: [], overlays: [], audio: [], blocs, creerId, versSon }), bilan };
}
