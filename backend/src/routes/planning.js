import { Router } from 'express';
import {
  getPlanning, ajouterMonteur, retirerMonteur, affecterSemaine,
  majEtatMontage, marquerSujetMonte, isRoleMontage, isEtatMontage,
  getSujets, getWeekUploads,
} from '../data/store.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { globalLimiter } from '../middleware/rateLimiter.js';
import { audit } from '../logger/audit.js';

/**
 * Planning des monteurs.
 *
 * Deux personnes par semaine — une à l'assemblage, une à l'habillage — avec
 * leur propre avancement, et la liste des reportages déjà montés.
 *
 * Lecture comprise, tout passe par `requireAdmin` et non par la portée : le
 * planning est neuf, donc sans contrainte de compatibilité, et il n'a aucune
 * raison d'être lisible tant que REPORTER_ACCESS reste sur `observe` — qui,
 * par construction, ne refuse rien. Les noms des monteurs et leur charge de
 * travail sont des informations internes.
 *
 * Une limite à connaître : l'équipe montage partage un seul mot de passe.
 * L'avancement est donc saisi sous cette identité commune, et le nom affiché
 * vient de l'affectation, pas d'une connexion. Distinguer les monteurs entre
 * eux demanderait de leur donner des liens personnels, comme aux
 * correspondants (lib/reporterToken.js).
 */

const router = Router();

const ID_SEMAINE = /^\d{4}-w\d{1,2}$/;
const semaineValide = (weekId) => ID_SEMAINE.test(String(weekId || ''));

/**
 * Le planning complet — toutes ses semaines, y compris celles que
 * `buildWeeks` n'expose pas. Un planning se regarde deux mois à l'avance,
 * alors que la liste des semaines de travail n'en montre que deux.
 */
router.get('/', requireAdmin, globalLimiter, asyncHandler(async (_req, res) => {
  return res.json(getPlanning());
}));

/**
 * Les sujets de la semaine, tous pays confondus, avec leur état de montage.
 *
 * C'est le conducteur vu par le monteur : ce qu'il reste à monter, et ce qui
 * est fait. `monte` est un axe distinct de l'état éditorial — un sujet validé
 * par la rédaction n'est pas pour autant monté.
 *
 * Chaque sujet porte aussi ce qu'il a REÇU : le nombre de pièces et la somme
 * des durées connues. Sans cela, l'écran listait quinze lignes dont neuf
 * n'avaient aucun fichier, les proposait à la coche, et les comptait dans sa
 * jauge — un sujet sans rush ne peut pourtant pas être monté.
 *
 * Les sujets sont rendus groupés par pays. Ils arrivaient dans l'ordre de
 * création, tous pays mêlés, si bien que le monteur sautait du Cameroun au
 * Sénégal puis au Togo pour revenir au Cameroun.
 */
router.get('/:weekId/sujets', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId } = req.params;
  if (!semaineValide(weekId)) return next(createErrors.notFound('Semaine'));

  const montes = new Set(getPlanning().semaines[weekId]?.sujetsMontes || []);

  // Les fichiers de la semaine, rangés par sujet. Un seul balayage : la
  // semaine peut porter plusieurs centaines de pièces.
  const parSujet = new Map();
  for (const fichiers of Object.values(getWeekUploads(weekId) || {})) {
    if (!Array.isArray(fichiers)) continue;
    for (const f of fichiers) {
      if (!f?.sujetId) continue;
      const compte = parSujet.get(f.sujetId) || { nbPieces: 0, duree: 0, mesures: 0 };
      compte.nbPieces += 1;
      const secondes = Number(f.duree);
      if (Number.isFinite(secondes) && secondes > 0) {
        compte.duree += secondes;
        compte.mesures += 1;
      }
      parSujet.set(f.sujetId, compte);
    }
  }

  const sujets = getSujets(weekId)
    .map((s) => {
      const compte = parSujet.get(s.id) || { nbPieces: 0, duree: 0, mesures: 0 };
      return {
        ...s,
        monte: montes.has(s.id),
        nbPieces: compte.nbPieces,
        // `null` et non `0` quand rien n'a pu être mesuré : une durée nulle
        // ferait croire à un rush vide.
        duree: compte.mesures > 0 ? Math.round(compte.duree * 10) / 10 : null,
      };
    })
    .sort((a, b) => String(a.countryId).localeCompare(String(b.countryId))
      || String(a.creeLe || '').localeCompare(String(b.creeLe || '')));

  return res.json(sujets);
}));

router.post('/monteurs', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const monteur = ajouterMonteur(req.body?.nom);
  if (!monteur) return next(createErrors.badRequest('Nom du monteur requis.'));
  audit('planning.monteur_ajoute', req, { id: monteur.id, nom: monteur.nom });
  return res.status(201).json(monteur);
}));

router.delete('/monteurs/:monteurId', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  if (!retirerMonteur(req.params.monteurId)) return next(createErrors.notFound('Monteur'));
  audit('planning.monteur_retire', req, { id: req.params.monteurId });
  return res.status(204).end();
}));

/** Affecte les deux rôles d'une semaine, et son numéro d'édition. */
router.put('/:weekId', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId } = req.params;
  if (!semaineValide(weekId)) return next(createErrors.notFound('Semaine'));

  const { libelle, assemblage, habillage } = req.body || {};
  const connus = new Set(getPlanning().monteurs.map((m) => m.id));
  for (const [role, valeur] of [['assemblage', assemblage], ['habillage', habillage]]) {
    if (valeur === undefined || valeur === null) continue;
    if (!connus.has(String(valeur))) {
      return next(createErrors.badRequest(`Monteur inconnu pour ${role}.`));
    }
  }

  const semaine = affecterSemaine(weekId, { libelle, assemblage, habillage });
  audit('planning.affectation', req, { weekId, assemblage, habillage });
  return res.json(semaine);
}));

router.patch('/:weekId/:role/etat', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, role } = req.params;
  const { etat } = req.body || {};
  if (!semaineValide(weekId)) return next(createErrors.notFound('Semaine'));
  if (!isRoleMontage(role)) return next(createErrors.badRequest('Rôle inconnu (assemblage ou habillage).'));
  if (!isEtatMontage(etat)) return next(createErrors.badRequest('État inconnu (a_faire, en_cours ou termine).'));

  const semaine = majEtatMontage(weekId, role, etat);
  audit('planning.avancement', req, { weekId, role, etat });
  return res.json(semaine);
}));

router.patch('/:weekId/sujets/:sujetId', requireAdmin, globalLimiter, asyncHandler(async (req, res, next) => {
  const { weekId, sujetId } = req.params;
  if (!semaineValide(weekId)) return next(createErrors.notFound('Semaine'));
  if (typeof req.body?.monte !== 'boolean') {
    return next(createErrors.badRequest('`monte` doit être un booléen.'));
  }

  const semaine = marquerSujetMonte(weekId, sujetId, req.body.monte);
  return res.json(semaine);
}));

export default router;
