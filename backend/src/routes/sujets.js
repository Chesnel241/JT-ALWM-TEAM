import { Router } from 'express';
import {
  getSujets,
  getSujet,
  createSujet,
  renameSujet,
  updateSujetEtat,
  deleteSujet,
  getCountryUploads,
  isEtatSujet,
  etatDeduit,
  rattacherOrphelins,
  numeroDeRepli,
} from '../data/store.js';
import { estRubrique, estHorsSujet } from '../data/rubriques.js';
import { buildWeeks, isCountryAccepted } from '../data/constants.js';
import { getCustomCountries } from '../data/store.js';
import { asyncHandler, createErrors, AppError } from '../middleware/errorHandler.js';
import { globalLimiter } from '../middleware/rateLimiter.js';
import { requireAdmin } from '../middleware/auth.js';
import { porteeCountry, porteeRedaction } from '../middleware/portee.js';
import { io } from '../app.js';

const router = Router();

const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);
const isValidCountry = (countryId) => isCountryAccepted(countryId, getCustomCountries());

// Un titre tient sur une ligne : c'est un intitulé de conducteur, pas un
// synopsis. Le tronquer ici évite qu'il déborde des cartes de la rédaction.
const TITRE_MAX = 120;

// Cinq reportages par pays et par semaine : le plafond de l'interface, tenu
// ici aussi pour qu'aucun client ne le contourne.
const MAX_SUJETS = 5;

function cleanTitre(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, TITRE_MAX);
}

/**
 * Le sujet renvoyé porte le compte de ses pièces et son état effectif.
 * L'état stocké fait foi dès qu'un monteur l'a fixé ; sinon il se déduit des
 * fichiers, pour qu'un sujet créé puis rempli n'ait pas à être touché à la
 * main pour cesser d'être « attendu ».
 */
function decorate(sujet, files) {
  const pieces = files.filter((f) => f?.sujetId === sujet.id);
  const deduit = etatDeduit(pieces);
  const fixeParUnMonteur = sujet.etat === 'valide' || sujet.etat === 'au_conducteur';
  return {
    ...sujet,
    nbPieces: pieces.length,
    etat: fixeParUnMonteur ? sujet.etat : deduit,
  };
}

// GET /api/sujets/:weekId — toute la semaine (rédaction)
router.get('/:weekId', porteeRedaction(), globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId } = req.params;
  if (!isValidWeek(weekId)) return next(createErrors.badRequest('Semaine invalide.'));

  const sujets = getSujets(weekId).map((sujet) =>
    decorate(sujet, getCountryUploads(weekId, sujet.countryId))
  );
  return res.json(sujets);
}));

// GET /api/sujets/:weekId/:countryId — les sujets d'un pays
router.get('/:weekId/:countryId', porteeCountry(), globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return next(createErrors.badRequest('Semaine ou pays invalide.'));
  }
  const files = getCountryUploads(weekId, countryId);
  return res.json(getSujets(weekId, countryId).map((s) => decorate(s, files)));
}));

// POST /api/sujets/:weekId/:countryId — le correspondant ouvre un sujet
router.post('/:weekId/:countryId', porteeCountry(), globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return next(createErrors.badRequest('Semaine ou pays invalide.'));
  }

  const titre = cleanTitre(req.body?.titre);
  if (!titre) return next(createErrors.badRequest('Un sujet a besoin d\'un titre.'));

  // Garde-fou de volume : cinq sujets par pays et par semaine, comme
  // l'interface le proposait déjà.
  if (getSujets(weekId, countryId).length >= MAX_SUJETS) {
    return next(createErrors.badRequest('Cinq sujets au maximum pour une semaine.'));
  }

  // `auteur` vient du correspondant identifié quand il l'est (lien personnel),
  // sinon il reste vide : on n'invente pas un nom.
  const sujet = createSujet(weekId, countryId, {
    titre,
    auteur: req.correspondant?.nom || '',
  });
  // Les fichiers déposés avant qu'un sujet existe ne doivent pas disparaître
  // de l'écran au moment où le premier apparaît. Voir `rattacherOrphelins`.
  rattacherOrphelins(weekId, countryId);

  io?.emit('sujet_update', { weekId, countryId });
  return res.status(201).json(decorate(getSujet(weekId, sujet.id), getCountryUploads(weekId, countryId)));
}));

/**
 * PUT /api/sujets/:weekId/:countryId — fixer les reportages de la semaine.
 *
 * Le correspondant dit **combien** de reportages il envoie et comment ils
 * s'appellent, en une seule fois. C'est la réponse au parcours d'avant, où
 * l'on ajoutait les reportages un par un par un bouton que plusieurs
 * correspondants ne comprenaient pas.
 *
 * Une seule requête, et non une création par reportage : sur un réseau mobile
 * qui décroche, trois requêtes s'arrêtent volontiers après la deuxième, et le
 * correspondant se retrouve avec un nombre de reportages qu'il n'a pas choisi.
 * Ici, tout est vérifié avant la première écriture — la demande passe
 * entière, ou pas du tout.
 *
 * Corps : `{ reportages: [{ id?, titre }] }`, dans l'ordre d'affichage.
 * - un `id` connu renomme ce reportage ;
 * - une entrée sans `id` en crée un ;
 * - un reportage existant absent de la liste est retiré, **s'il est vide**.
 *
 * Les reportages conservés gardent leur ordre et les nouveaux viennent après
 * eux : la position d'un reportage est son ordre de création, et c'est aussi
 * l'ordre que lit la rédaction.
 */
router.put('/:weekId/:countryId', porteeCountry(), globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return next(createErrors.badRequest('Semaine ou pays invalide.'));
  }
  if (estRubrique(countryId)) {
    return next(createErrors.badRequest('Une rubrique n\'a pas de reportages.'));
  }

  const demandes = req.body?.reportages;
  if (!Array.isArray(demandes)) {
    return next(createErrors.badRequest('Liste de reportages attendue.'));
  }
  if (demandes.length > MAX_SUJETS) {
    return next(createErrors.badRequest('Cinq reportages au maximum pour une semaine.'));
  }

  const voulus = demandes.map((d) => ({
    id: typeof d?.id === 'string' && d.id ? d.id : null,
    titre: cleanTitre(d?.titre),
  }));
  if (voulus.some((v) => !v.titre)) {
    return next(createErrors.badRequest('Chaque reportage a besoin d\'un titre.'));
  }

  const existants = getSujets(weekId, countryId);
  const parId = new Map(existants.map((s) => [s.id, s]));
  const gardes = voulus.filter((v) => v.id).map((v) => v.id);
  if (gardes.some((id) => !parId.has(id))) return next(createErrors.notFound('Sujet'));
  if (new Set(gardes).size !== gardes.length) {
    return next(createErrors.badRequest('Un reportage apparaît deux fois.'));
  }

  // Les conservés d'abord, dans leur ordre actuel, puis les nouveaux.
  const premierNouveau = voulus.findIndex((v) => !v.id);
  const conservesEnTete = premierNouveau === -1 || voulus.slice(premierNouveau).every((v) => !v.id);
  const ordreActuel = existants.filter((s) => gardes.includes(s.id)).map((s) => s.id);
  if (!conservesEnTete || ordreActuel.join('|') !== gardes.join('|')) {
    return next(createErrors.badRequest('Les reportages existants gardent leur ordre ; les nouveaux viennent après.'));
  }

  // Rien ne se perd. Un reportage retiré doit être vide — y compris un
  // reportage de repli, tant qu'aucun sujet n'existait, qui ne se voit que
  // par l'étiquette « Reportage k » de ses fichiers.
  const fichiers = getCountryUploads(weekId, countryId);
  const retires = existants.filter((s) => !gardes.includes(s.id));
  const pleins = retires.filter((s) => fichiers.some((f) => f?.sujetId === s.id)).map((s) => `« ${s.titre} »`);
  for (const f of fichiers) {
    if (!f || f.sujetId || estHorsSujet(f.reportage)) continue;
    const k = numeroDeRepli(f.reportage);
    if (k > voulus.length && !pleins.includes(`« ${f.reportage} »`)) pleins.push(`« ${f.reportage} »`);
  }
  if (pleins.length > 0) {
    const message = `${pleins.join(', ')} ${pleins.length > 1 ? 'contiennent' : 'contient'} déjà des fichiers : supprimez-les d'abord, ou gardez ce reportage.`;
    return next(new AppError(message, 409, message));
  }

  for (const s of retires) deleteSujet(weekId, s.id);
  for (const v of voulus) {
    if (v.id) {
      if (parId.get(v.id).titre !== v.titre) renameSujet(weekId, v.id, v.titre);
    } else {
      createSujet(weekId, countryId, { titre: v.titre, auteur: req.correspondant?.nom || '' });
    }
  }
  const rattaches = rattacherOrphelins(weekId, countryId);

  io?.emit('sujet_update', { weekId, countryId });
  const apres = getCountryUploads(weekId, countryId);
  return res.json({
    sujets: getSujets(weekId, countryId).map((s) => decorate(s, apres)),
    rattaches,
  });
}));

// PATCH /api/sujets/:weekId/:countryId/:sujetId — renommer
router.patch('/:weekId/:countryId/:sujetId', porteeCountry(), globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId, sujetId } = req.params;
  const existant = getSujet(weekId, sujetId);
  if (!existant || existant.countryId !== countryId) return next(createErrors.notFound('Sujet'));

  const titre = cleanTitre(req.body?.titre);
  if (!titre) return next(createErrors.badRequest('Un sujet a besoin d\'un titre.'));

  const sujet = renameSujet(weekId, sujetId, titre);
  io?.emit('sujet_update', { weekId, countryId });
  return res.json(decorate(sujet, getCountryUploads(weekId, countryId)));
}));

// PATCH /api/sujets/:weekId/:countryId/:sujetId/etat — la rédaction décide
router.patch('/:weekId/:countryId/:sujetId/etat', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId, sujetId } = req.params;
  const existant = getSujet(weekId, sujetId);
  if (!existant || existant.countryId !== countryId) return next(createErrors.notFound('Sujet'));

  const { etat } = req.body || {};
  if (!isEtatSujet(etat)) return next(createErrors.badRequest('État de sujet inconnu.'));

  const sujet = updateSujetEtat(weekId, sujetId, etat);
  io?.emit('sujet_update', { weekId, countryId });
  return res.json(decorate(sujet, getCountryUploads(weekId, countryId)));
}));

// DELETE /api/sujets/:weekId/:countryId/:sujetId — seulement s'il est vide
router.delete('/:weekId/:countryId/:sujetId', porteeCountry(), globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId, sujetId } = req.params;
  const existant = getSujet(weekId, sujetId);
  if (!existant || existant.countryId !== countryId) return next(createErrors.notFound('Sujet'));

  // Supprimer un sujet qui porte des fichiers les rendrait inatteignables :
  // c'est exactement le défaut qu'on vient de corriger côté correspondant.
  const pieces = getCountryUploads(weekId, countryId).filter((f) => f?.sujetId === sujetId);
  if (pieces.length > 0) {
    return next(createErrors.badRequest('Ce sujet contient des fichiers : supprimez-les d\'abord.'));
  }

  deleteSujet(weekId, sujetId);
  io?.emit('sujet_update', { weekId, countryId });
  return res.status(204).end();
}));

export default router;
