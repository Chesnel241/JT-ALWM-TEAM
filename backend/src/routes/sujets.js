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
} from '../data/store.js';
import { buildWeeks, isCountryAccepted } from '../data/constants.js';
import { getCustomCountries } from '../data/store.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { globalLimiter } from '../middleware/rateLimiter.js';
import { requireAdmin } from '../middleware/auth.js';
import { io } from '../app.js';

const router = Router();

const isValidWeek = (weekId) => buildWeeks().some((w) => w.id === weekId);
const isValidCountry = (countryId) => isCountryAccepted(countryId, getCustomCountries());

// Un titre tient sur une ligne : c'est un intitulé de conducteur, pas un
// synopsis. Le tronquer ici évite qu'il déborde des cartes de la rédaction.
const TITRE_MAX = 120;

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
router.get('/:weekId', globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId } = req.params;
  if (!isValidWeek(weekId)) return next(createErrors.badRequest('Semaine invalide.'));

  const sujets = getSujets(weekId).map((sujet) =>
    decorate(sujet, getCountryUploads(weekId, sujet.countryId))
  );
  return res.json(sujets);
}));

// GET /api/sujets/:weekId/:countryId — les sujets d'un pays
router.get('/:weekId/:countryId', globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return next(createErrors.badRequest('Semaine ou pays invalide.'));
  }
  const files = getCountryUploads(weekId, countryId);
  return res.json(getSujets(weekId, countryId).map((s) => decorate(s, files)));
}));

// POST /api/sujets/:weekId/:countryId — le correspondant ouvre un sujet
router.post('/:weekId/:countryId', globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, countryId } = req.params;
  if (!isValidWeek(weekId) || !isValidCountry(countryId)) {
    return next(createErrors.badRequest('Semaine ou pays invalide.'));
  }

  const titre = cleanTitre(req.body?.titre);
  if (!titre) return next(createErrors.badRequest('Un sujet a besoin d\'un titre.'));

  // Garde-fou de volume : cinq sujets par pays et par semaine, comme
  // l'interface le proposait déjà.
  if (getSujets(weekId, countryId).length >= 5) {
    return next(createErrors.badRequest('Cinq sujets au maximum pour une semaine.'));
  }

  // `auteur` vient du correspondant identifié quand il l'est (lien personnel),
  // sinon il reste vide : on n'invente pas un nom.
  const sujet = createSujet(weekId, countryId, {
    titre,
    auteur: req.correspondant?.nom || '',
  });

  io?.emit('sujet_update', { weekId, countryId });
  return res.status(201).json(decorate(sujet, getCountryUploads(weekId, countryId)));
}));

// PATCH /api/sujets/:weekId/:countryId/:sujetId — renommer
router.patch('/:weekId/:countryId/:sujetId', globalLimiter, asyncHandler(async (req, res, next) => {
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
router.delete('/:weekId/:countryId/:sujetId', globalLimiter, asyncHandler(async (req, res, next) => {
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
