import { Router } from 'express';
import { getRubriques, getRubrique, setRubrique } from '../data/store.js';
import { LISTE_RUBRIQUES, trouverRubrique, nettoyerChamps } from '../data/rubriques.js';
import { buildWeeks } from '../data/constants.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { porteeCountry } from '../middleware/portee.js';
import { globalLimiter } from '../middleware/rateLimiter.js';

/**
 * Les deux rubriques du journal : le conducteur et le Mot du JT.
 *
 * Ce ne sont pas des pays, et elles n'appartiennent à aucun correspondant :
 * tout lien personnel valide y donne accès, quel que soit son pays. C'est la
 * portée qui l'applique — `porteeCountry` reconnaît un identifiant de
 * rubrique et se contente alors d'exiger une identité.
 *
 * Seuls les CHAMPS passent par ici. Les fichiers — la voix off, la vidéo de
 * l'intervenant — empruntent le chemin d'envoi habituel vers les tiroirs
 * `tj` et `mj`.
 */

const router = Router();
const semaineValide = (weekId) => buildWeeks().some((w) => w.id === weekId);

/** La description des deux rubriques : leurs champs, ce qu'on y dépose. */
router.get('/', globalLimiter, asyncHandler(async (_req, res) => {
  return res.json(LISTE_RUBRIQUES);
}));

router.get('/:weekId', globalLimiter, asyncHandler(async (req, res, next) => {
  if (!semaineValide(req.params.weekId)) return next(createErrors.notFound('Semaine'));
  return res.json(getRubriques(req.params.weekId));
}));

router.get('/:weekId/:cle', globalLimiter, asyncHandler(async (req, res, next) => {
  const rubrique = trouverRubrique(req.params.cle);
  if (!rubrique) return next(createErrors.notFound('Rubrique'));
  if (!semaineValide(req.params.weekId)) return next(createErrors.notFound('Semaine'));
  return res.json({ rubrique, champs: getRubrique(req.params.weekId, rubrique.cle) });
}));

/**
 * Écrit les champs d'une rubrique.
 *
 * La portée lit le TIROIR de la rubrique (`tj` ou `mj`), pas sa clé : c'est
 * lui qui sert d'identifiant partout ailleurs, et qui dit à `porteeCountry`
 * qu'un lien valide suffit, quel que soit son pays.
 */
router.put(
  '/:weekId/:cle',
  porteeCountry((req) => trouverRubrique(req.params.cle)?.bin),
  globalLimiter,
  asyncHandler(async (req, res, next) => {
    const rubrique = trouverRubrique(req.params.cle);
    if (!rubrique) return next(createErrors.notFound('Rubrique'));
    if (!semaineValide(req.params.weekId)) return next(createErrors.notFound('Semaine'));

    const champs = nettoyerChamps(rubrique, req.body);
    if (Object.keys(champs).length === 0) {
      return next(createErrors.badRequest(
        `Aucun champ connu. Attendus : ${rubrique.champs.map((c) => c.cle).join(', ')}.`,
      ));
    }

    return res.json(setRubrique(req.params.weekId, rubrique.cle, champs));
  }),
);

export default router;
