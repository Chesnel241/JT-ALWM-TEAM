import { Router } from 'express';
import { issueReporterToken, isReporterTokenConfigured } from '../lib/reporterToken.js';
import { isCountryAccepted } from '../data/constants.js';
import { getCustomCountries } from '../data/store.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { createLimiter } from '../middleware/rateLimiter.js';
import { audit } from '../logger/audit.js';

const router = Router();

/**
 * Émission d'un lien personnel de correspondant, depuis l'espace montage.
 *
 * Le lien est rendu une fois, à la personne qui le demande, et n'est jamais
 * relu : c'est un secret porteur. Le régénérer pour un correspondant est la
 * façon de révoquer l'ancien, dès lors que le secret d'environnement change
 * ou qu'on cesse de diffuser le précédent.
 */
router.post('/', requireAdmin, createLimiter, asyncHandler(async (req, res, next) => {
  if (!isReporterTokenConfigured()) {
    // Sans secret configuré, un jeton signé n'aurait aucune valeur : on
    // préfère le dire que d'émettre un lien qui n'identifie personne.
    return next(createErrors.forbidden(
      'Émission impossible : REPORTER_TOKEN_SECRET n\'est pas configuré sur le serveur.'
    ));
  }

  const { pays, nom } = req.body || {};
  const paysPropre = String(pays || '').trim().toLowerCase();
  if (!isCountryAccepted(paysPropre, getCustomCountries())) {
    return next(createErrors.badRequest('Pays inconnu.'));
  }

  const token = issueReporterToken({ pays: paysPropre, nom });
  audit('lien.emis', req, { pays: paysPropre, nom: String(nom || '').trim() });

  return res.status(201).json({
    pays: paysPropre,
    nom: String(nom || '').trim(),
    token,
    // Le chemin que la rédaction colle dans WhatsApp. L'origine est ajoutée
    // par le navigateur, qui seul connaît le domaine servi.
    chemin: `/journalistes/${paysPropre}?k=${encodeURIComponent(token)}`,
  });
}));

export default router;
