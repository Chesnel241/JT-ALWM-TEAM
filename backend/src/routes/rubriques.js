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

  // `revision` et `majLe` relèvent du protocole d'écriture, pas du contenu du
  // journal : ils sortent de `champs` pour que la saisie ne les prenne jamais
  // pour des champs à afficher.
  const { revision, majLe, ...champs } = getRubrique(req.params.weekId, rubrique.cle);
  return res.json({ rubrique, champs, revision, majLe });
}));

/**
 * Écrit les champs d'une rubrique.
 *
 * La portée lit le TIROIR de la rubrique (`tj` ou `mj`), pas sa clé : c'est
 * lui qui sert d'identifiant partout ailleurs, et qui dit à `porteeCountry`
 * qu'un lien valide suffit, quel que soit son pays.
 *
 * `baseRevision` est la révision sur laquelle l'auteur a travaillé. Fournie et
 * périmée, l'écriture est refusée et l'état courant rendu : c'est ce qui
 * empêche deux rédacteurs du conducteur de s'effacer sans le savoir. Absente,
 * l'écriture passe comme avant — un client plus ancien continue de marcher.
 *
 * Elle ne peut pas être confondue avec un champ du journal : `nettoyerChamps`
 * ne garde que les clés déclarées par la rubrique.
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

    const { baseRevision } = req.body || {};
    const etat = setRubrique(req.params.weekId, rubrique.cle, champs, { baseRevision });

    // 409 : la demande était légitime, c'est l'état du serveur qui a changé.
    // Le corps porte la version à jour, pour que l'écran puisse la proposer
    // sans un aller-retour de plus.
    return res.status(etat.conflit ? 409 : 200).json(etat);
  }),
);

export default router;
