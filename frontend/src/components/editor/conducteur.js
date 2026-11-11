/**
 * Le déroulé du JT : la liste ordonnée des plans, telle qu'un monteur la pense.
 *
 * LE CONSTAT : le studio était une table de montage de professionnel — une
 * piste horizontale graduée en secondes, une lame, un aimant, un zoom en
 * pixels. Un JT hebdomadaire, lui, se fabrique en trois gestes : choisir les
 * rushes, les mettre dans l'ordre, raccourcir le début et la fin. Sur la piste,
 * trois plans de trente secondes n'étaient même pas visibles sans faire
 * défiler, et les rushes vivaient dans un autre onglet. L'outil n'a donc
 * jamais vraiment servi.
 *
 * Ce fichier ne contient que le calcul, sans React : il se teste seul.
 */
import { computeTimelineLayout } from './timelineModel.js';

const identifiant = (clip, index) => clip?.instanceId || clip?.id || String(index);

/** « 45 s », « 1 min 20 », « 1 h 04 min » : une durée comme on la dit. */
export function dureeParlee(secondes) {
  const s = Math.max(0, Math.round(Number(secondes) || 0));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  return r ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`;
}

/** « 0:07 », « 12:40 », « 1:02:05 » : l'instant où un plan commence. */
export function instant(secondes) {
  const s = Math.max(0, Math.floor(Number(secondes) || 0));
  const deux = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return h ? `${h}:${deux(Math.floor((s % 3600) / 60))}:${deux(s % 60)}` : `${Math.floor(s / 60)}:${deux(s % 60)}`;
}

/**
 * Les plans du déroulé, chacun avec son rang, son début dans le JT et sa
 * durée. S'appuie sur le même calcul que la piste et que le rendu : ce que la
 * liste annonce est ce qui sera diffusé.
 */
export function deroule(clips = []) {
  const layout = computeTimelineLayout(clips);
  return {
    total: layout.total,
    plans: layout.items.map((item) => ({
      id: item.id,
      rang: item.index + 1,
      clip: item.clip,
      debut: item.start,
      duree: item.duration,
    })),
  };
}

/** Le plan qui passe à l'écran à l'instant `secondes`. */
export function planALInstant(plans, secondes) {
  let courant = null;
  for (const plan of plans) {
    if (plan.debut <= secondes + 1e-6) courant = plan;
    else break;
  }
  return courant;
}

/** Déplace le plan `id` d'un rang (`-1` monte, `+1` descend) ou à `vers`. */
export function deplacer(clips, id, { pas = 0, vers = null } = {}) {
  const de = clips.findIndex((c, i) => identifiant(c, i) === id);
  if (de < 0) return clips;
  const cible = Math.max(0, Math.min(clips.length - 1, vers ?? de + pas));
  if (cible === de) return clips;
  const suite = clips.slice();
  const [plan] = suite.splice(de, 1);
  suite.splice(cible, 0, plan);
  return suite;
}

/** Retire le plan `id`. */
export function retirer(clips, id) {
  const suite = clips.filter((c, i) => identifiant(c, i) !== id);
  return suite.length === clips.length ? clips : suite;
}

/** Copie le plan `id` juste après lui, sous un nouvel identifiant. */
export function dupliquer(clips, id, nouvelId) {
  const index = clips.findIndex((c, i) => identifiant(c, i) === id);
  if (index < 0) return clips;
  const suite = clips.slice();
  suite.splice(index + 1, 0, { ...clips[index], instanceId: nouvelId });
  return suite;
}

/**
 * Place `clip` juste après le plan `apresId` — le plan sélectionné — ou à la
 * fin. Le monteur construit son JT dans l'ordre : le rush qu'il ajoute va là
 * où il regarde, pas au bout d'une liste de deux cents plans.
 */
export function inserer(clips, clip, apresId = null) {
  const index = apresId == null ? -1 : clips.findIndex((c, i) => identifiant(c, i) === apresId);
  if (index < 0) return [...clips, clip];
  const suite = clips.slice();
  suite.splice(index + 1, 0, clip);
  return suite;
}

const sansAccent = (texte) => String(texte || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Les rushes vidéo de la semaine, rangés par pays puis par reportage, filtrés
 * par la recherche, avec le nombre de fois où chacun sert déjà dans le JT.
 *
 * @param videos    fichiers vidéo ({ filename, name, countryId, reportage, status })
 * @param clips     plans du déroulé
 * @param options   { nomPays(id), recherche, masquerRefuses }
 */
export function rangerRushes(videos = [], clips = [], { nomPays = (id) => id, recherche = '', masquerRefuses = true } = {}) {
  const emplois = new Map();
  for (const c of clips) emplois.set(c.filename, (emplois.get(c.filename) || 0) + 1);
  const cherche = sansAccent(recherche).trim();

  const pays = new Map();
  for (const v of videos) {
    if (masquerRefuses && v.status === 'rejected') continue;
    const nom = nomPays(v.countryId) || v.countryId;
    const reportage = (v.reportage || '').trim();
    if (cherche && !sansAccent(`${v.name} ${reportage} ${nom}`).includes(cherche)) continue;
    if (!pays.has(v.countryId)) pays.set(v.countryId, { id: v.countryId, nom, reportages: new Map(), nombre: 0 });
    const groupe = pays.get(v.countryId);
    if (!groupe.reportages.has(reportage)) groupe.reportages.set(reportage, []);
    groupe.reportages.get(reportage).push({ ...v, emplois: emplois.get(v.filename) || 0 });
    groupe.nombre += 1;
  }
  return [...pays.values()]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map((g) => ({
      id: g.id,
      nom: g.nom,
      nombre: g.nombre,
      reportages: [...g.reportages.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'fr'))
        .map(([titre, rushes]) => ({ titre, rushes })),
    }));
}
