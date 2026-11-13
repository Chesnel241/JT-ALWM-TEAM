/**
 * Les rubriques répétitives du JT, assemblées d'un clic.
 *
 * LE CONSTAT : chaque semaine, le monteur refait la même chose pour les
 * séminaires, les annonces et le mot du JT. Il ouvre les dossiers des pays,
 * glisse les vidéos une par une, écrit « Gabon » sur chaque bloc, puis cale les
 * transitions à la main. C'est long, et c'est toujours pareil.
 *
 * Ce module ne fait que le calcul, sans React : il prend les vidéos reçues et
 * le déroulé en cours, et rend un déroulé complété. Il ne retire rien — un
 * fichier déjà présent dans le déroulé n'est jamais ajouté une deuxième fois,
 * et le travail manuel du monteur reste à sa place.
 *
 * Ordre d'un bloc : séminaires, puis annonces, puis mot du JT. Dans chaque
 * rubrique, un bloc par pays (du plus proche au plus lointain, c'est-à-dire
 * par ordre alphabétique) ; dans un pays, les vidéos par ordre d'arrivée.
 * Un bandeau identifie le pays pendant toute la durée de son bloc, et une
 * transition de chaîne sépare les blocs.
 */
import { computeTimelineLayout } from './timelineModel.js';
import { animationRecommandee } from '../../data/overlayTemplates.js';
import { classifyFile } from '../../lib/mediaTypes.js';

/** Les libellés de section tels qu'ils sont enregistrés à l'envoi (en français). */
export const LIBELLE_SEMINAIRES = 'Séminaires de la semaine';
export const LIBELLE_ANNONCES = 'Annonces';

/** Le tiroir du mot du JT, et les tiroirs du JT qui ne sont jamais des pays. */
export const TIROIR_MOT_DU_JT = 'mj';
const TIROIRS_DU_JT = new Set(['tj', 'mj']);

/** La transition entre deux blocs de pays : celle de la chaîne. */
export const TRANSITION_ENTRE_PAYS = Object.freeze({ type: 'volet_antenne', duration: 0.6 });

/** Un nom à l'écran ou un titre de reportage reste le temps d'être lu, pas plus. */
const DUREE_NOM_ORATEUR = 8;
const DUREE_TITRE_REPORTAGE = 5;

export const parDateEnvoi = (a, b) => (
  String(a.uploadedAt || '').localeCompare(String(b.uploadedAt || ''))
  || String(a.filename || '').localeCompare(String(b.filename || ''))
);

/** Les vidéos d'une section fixe, regroupées par pays, dans l'ordre du JT. */
export function blocsParPays(videos, libelle, nomPays) {
  const parPays = new Map();
  for (const video of videos) {
    if (video.reportage !== libelle) continue;
    if (TIROIRS_DU_JT.has(video.countryId)) continue;
    if (video.status === 'rejected') continue;
    if (classifyFile({ name: video.filename || video.name }) !== 'video') continue;
    if (!parPays.has(video.countryId)) parPays.set(video.countryId, []);
    parPays.get(video.countryId).push(video);
  }
  return [...parPays.entries()]
    .map(([id, fichiers]) => ({ id, nom: nomPays(id) || id, fichiers: fichiers.sort(parDateEnvoi) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/**
 * Assemble les rubriques à la suite du déroulé.
 *
 * @param videos    vidéos reçues de la semaine (`reportage`, `countryId`, `filename`…)
 * @param clips     déroulé actuel
 * @param overlays  titres de la piste T1 actuelle
 * @param nomPays   id de pays -> nom affiché
 * @param versClip  fichier -> plan du déroulé (durée déjà connue)
 * @param motDuJt   { orateur, theme } lus dans la rubrique « Mot du JT », ou null
 * @param creerId   générateur d'identifiants de titre
 * @param sons      fichiers audio de la semaine (voix off envoyées avec les annonces…)
 * @param audio     piste son actuelle
 * @param versSon   (fichier, instant) -> son de la piste, ou null
 * @returns { clips, overlays, audio, bilan }
 */
export function assemblerRubriques({
  videos = [], clips = [], overlays = [], nomPays = (id) => id, versClip, motDuJt = null, creerId,
  sons = [], audio = [], versSon = null,
}) {
  const dejaPresents = new Set(clips.map((c) => c.filename));
  const bilan = {
    seminaires: { pays: 0, fichiers: 0, sons: 0 },
    annonces: { pays: 0, fichiers: 0, sons: 0 },
    motDuJt: { fichiers: 0, orateur: false },
    deja: 0,
  };
  const sonsPresents = new Set((audio || []).map((son) => son.filename));
  // Les voix off envoyées par un pays dans la même section, pas encore posées.
  const sonsDuBloc = (libelle, paysId) => (versSon ? sons : [])
    .filter((f) => f.reportage === libelle && f.countryId === paysId && f.status !== 'rejected')
    .filter((f) => classifyFile({ name: f.filename || f.name }) === 'audio' && !sonsPresents.has(f.filename))
    .sort(parDateEnvoi);

  // Une vidéo déjà au déroulé n'est jamais reprise : on le compte, c'est tout.
  const nouveau = (fichier) => {
    if (dejaPresents.has(fichier.filename)) { bilan.deja += 1; return false; }
    dejaPresents.add(fichier.filename);
    return true;
  };

  // Un bloc = un pays ; chaque bloc a ses plans, son bandeau et sa fin.
  const blocs = [];
  const ajouterRubrique = (libelle, cle) => {
    for (const bloc of blocsParPays(videos, libelle, nomPays)) {
      const fichiers = bloc.fichiers.filter(nouveau);
      if (fichiers.length === 0) continue;
      bilan[cle].pays += 1;
      bilan[cle].fichiers += fichiers.length;
      const voix = sonsDuBloc(libelle, bloc.id);
      voix.forEach((f) => sonsPresents.add(f.filename));
      bilan[cle].sons += voix.length;
      blocs.push({
        plans: fichiers.map(versClip),
        bandeau: { texte: `${bloc.nom} · ${libelle}` },
        voix,
      });
    }
  };
  // L'ordre du journal, celui des jingles : les annonces, puis les séminaires.
  ajouterRubrique(LIBELLE_ANNONCES, 'annonces');
  ajouterRubrique(LIBELLE_SEMINAIRES, 'seminaires');

  // Le mot du JT : chaque intervention a son propre bloc, avec le nom et le thème.
  const motsDuJt = videos.filter((v) => v.countryId === TIROIR_MOT_DU_JT).sort(parDateEnvoi);
  for (const video of motsDuJt) {
    if (!nouveau(video)) continue;
    bilan.motDuJt.fichiers += 1;
    const orateur = String(motDuJt?.orateur || '').trim();
    if (orateur) bilan.motDuJt.orateur = true;
    blocs.push({
      plans: [versClip(video)],
      nomOrateur: orateur ? { nom: orateur, fonction: String(motDuJt?.theme || '').trim() } : null,
    });
  }

  if (blocs.length === 0) return { clips, overlays, audio, bilan };
  return { ...poserBlocs({ clips, overlays, audio, blocs, creerId, versSon }), bilan };
}

/** Pas de transition contre un jingle ou un carton : ils sont montés pour couper. */
const transitionEntre = (a, b) => (
  a.genre === 'jingle' || b.genre === 'jingle' || a.genre === 'carton' || b.genre === 'carton'
    ? null
    : TRANSITION_ENTRE_PAYS
);

/**
 * Pose des blocs à la suite d'un déroulé, et cale sur leurs débuts réels les
 * bandeaux, les titres, les noms et les voix off.
 *
 * Un bloc : `{ plans, genre?, bandeau?, titre?, nomOrateur?, voix? }`.
 *   - `genre` : `jingle`, `carton` ou contenu (par défaut) ;
 *   - `bandeau` : la mention qui identifie le pays pendant tout le bloc ;
 *   - `titre` : le titre de reportage, au début du bloc ;
 *   - `nomOrateur` : le nom et la fonction, au début du bloc ;
 *   - `voix` : les fichiers de voix off, posés l'un après l'autre.
 */
export function poserBlocs({ clips = [], overlays = [], audio = [], blocs = [], creerId, versSon = null }) {
  if (blocs.length === 0) return { clips, overlays, audio };
  // Le dernier plan de chaque bloc porte la transition qui mène au suivant.
  const base = clips.length;
  const suite = [...clips];
  blocs.forEach((bloc, i) => {
    const suivant = blocs[i + 1];
    bloc.plans.forEach((plan, k) => {
      const dernierDuBloc = k === bloc.plans.length - 1;
      const transition = dernierDuBloc && suivant ? transitionEntre(bloc, suivant) : null;
      suite.push({
        ...plan,
        overlays: plan.overlays || [],
        ...(transition ? { transition: { ...transition } } : {}),
      });
    });
  });

  // Les bandeaux se calent sur les débuts réels, transitions comprises.
  const layout = computeTimelineLayout(suite);
  const debutDe = (indexGlobal) => layout.items.find((it) => it.index === indexGlobal);
  const titres = [];
  const nouveauxSons = [];
  let indexBloc = base;
  for (const bloc of blocs) {
    const premier = debutDe(indexBloc);
    const dernier = debutDe(indexBloc + bloc.plans.length - 1);
    if (premier && dernier) {
      const debut = premier.start;
      const fin = dernier.start + dernier.duration;
      const titre = (templateId, fields, duree) => titres.push({
        id: creerId('overlay'),
        templateId,
        fields,
        animation: animationRecommandee(templateId),
        startTime: debut,
        duration: duree,
      });
      if (bloc.bandeau) titre('mention_image', { texte: bloc.bandeau.texte }, Math.max(0.3, fin - debut));
      if (bloc.titre) titre('titre_reportage', { titre: bloc.titre.titre, sous_titre: bloc.titre.sous_titre || '' }, Math.min(DUREE_TITRE_REPORTAGE, Math.max(0.3, fin - debut)));
      // Les voix off du pays, l'une après l'autre depuis le début de son bloc.
      let instant = debut;
      for (const fichier of bloc.voix || []) {
        const son = versSon?.(fichier, instant);
        if (!son) continue;
        nouveauxSons.push(son);
        instant += Number(son.sourceDurationSec) || 0;
      }
      if (bloc.nomOrateur) {
        titre('nom_interview', { nom: bloc.nomOrateur.nom, fonction: bloc.nomOrateur.fonction }, Math.min(DUREE_NOM_ORATEUR, Math.max(0.3, fin - debut)));
      }
    }
    indexBloc += bloc.plans.length;
  }

  return {
    clips: suite,
    overlays: [...overlays, ...titres],
    audio: nouveauxSons.length > 0 ? [...(audio || []), ...nouveauxSons] : audio,
  };
}
