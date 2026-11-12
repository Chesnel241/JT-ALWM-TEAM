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

/** Un nom de rubrique ou de pays n'est jamais plus long que le bandeau. */
const DUREE_NOM_ORATEUR = 8;

const parDateEnvoi = (a, b) => (
  String(a.uploadedAt || '').localeCompare(String(b.uploadedAt || ''))
  || String(a.filename || '').localeCompare(String(b.filename || ''))
);

/** Les vidéos d'une section fixe, regroupées par pays, dans l'ordre du JT. */
function blocsParPays(videos, libelle, nomPays) {
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
  ajouterRubrique(LIBELLE_SEMINAIRES, 'seminaires');
  ajouterRubrique(LIBELLE_ANNONCES, 'annonces');

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

  // Les plans à ajouter : le dernier plan de chaque bloc (sauf le tout dernier
  // du JT) porte la transition qui mène au bloc suivant.
  const base = clips.length;
  const suite = [...clips];
  blocs.forEach((bloc, i) => {
    bloc.plans.forEach((plan, k) => {
      const dernierDuBloc = k === bloc.plans.length - 1;
      const dernierDeTout = i === blocs.length - 1 && dernierDuBloc;
      suite.push({
        ...plan,
        overlays: plan.overlays || [],
        ...(dernierDuBloc && !dernierDeTout ? { transition: { ...TRANSITION_ENTRE_PAYS } } : {}),
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
      if (bloc.bandeau) {
        titres.push({
          id: creerId('overlay'),
          templateId: 'mention_image',
          fields: { texte: bloc.bandeau.texte },
          animation: animationRecommandee('mention_image'),
          startTime: debut,
          duration: Math.max(0.3, fin - debut),
        });
      }
      // Les voix off du pays, l'une après l'autre depuis le début de son bloc.
      let instant = debut;
      for (const fichier of bloc.voix || []) {
        const son = versSon(fichier, instant);
        if (!son) continue;
        nouveauxSons.push(son);
        const duree = Number(son.sourceDurationSec) || 0;
        instant += duree;
      }
      if (bloc.nomOrateur) {
        titres.push({
          id: creerId('overlay'),
          templateId: 'nom_interview',
          fields: { nom: bloc.nomOrateur.nom, fonction: bloc.nomOrateur.fonction },
          animation: animationRecommandee('nom_interview'),
          startTime: debut,
          duration: Math.min(DUREE_NOM_ORATEUR, Math.max(0.3, fin - debut)),
        });
      }
    }
    indexBloc += bloc.plans.length;
  }

  return {
    clips: suite,
    overlays: [...overlays, ...titres],
    audio: nouveauxSons.length > 0 ? [...(audio || []), ...nouveauxSons] : audio,
    bilan,
  };
}
