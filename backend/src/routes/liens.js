import { Router } from 'express';
import { randomUUID } from 'crypto';
import { issueReporterToken, isReporterTokenConfigured } from '../lib/reporterToken.js';
import { isCountryAccepted } from '../data/constants.js';
import { getCustomCountries, enregistrerLien, revoquerLien, listerLiens } from '../data/store.js';
import { BUCKETS_REDACTION, niveauAcces } from '../middleware/portee.js';
import { lireEtat } from '../services/porteeStats.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { createLimiter } from '../middleware/rateLimiter.js';
import { audit } from '../logger/audit.js';

const router = Router();

/**
 * Émission d'un lien personnel de correspondant, depuis l'espace montage.
 *
 * Le lien est rendu une fois, à la personne qui le demande, et n'est jamais
 * relu : c'est un secret porteur. Le serveur n'en garde que l'identifiant,
 * ce qui suffit à le révoquer plus tard (DELETE ci-dessous) sans jamais
 * pouvoir le reconstituer.
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
  // `mj` et `tj` sont des rangements de la rédaction, pas des pays de
  // correspondant : un lien personnel n'y donnerait accès à personne (la
  // portée les refuse), autant ne pas laisser en émettre un.
  if (BUCKETS_REDACTION.has(paysPropre)) {
    return next(createErrors.badRequest(
      'Ce chutier appartient à la rédaction : aucun lien de correspondant ne peut y être émis.'
    ));
  }

  const id = randomUUID();
  const token = issueReporterToken({ pays: paysPropre, nom, id });
  enregistrerLien({ id, pays: paysPropre, nom });
  audit('lien.emis', req, { id, pays: paysPropre, nom: String(nom || '').trim() });

  return res.status(201).json({
    id,
    pays: paysPropre,
    nom: String(nom || '').trim(),
    token,
    // Le chemin que la rédaction colle dans WhatsApp. L'origine est ajoutée
    // par le navigateur, qui seul connaît le domaine servi.
    chemin: `/journalistes/${paysPropre}?k=${encodeURIComponent(token)}`,
  });
}));

/**
 * Révoque un lien. C'est le geste à faire quand un téléphone est perdu ou
 * qu'un correspondant quitte l'équipe — avant, la seule option était de
 * changer REPORTER_TOKEN_SECRET, ce qui coupait tout le monde.
 */
router.delete('/:id', requireAdmin, asyncHandler(async (req, res, next) => {
  const lien = revoquerLien(String(req.params.id || ''));
  if (!lien) return next(createErrors.notFound('Lien'));
  audit('lien.revoque', req, { id: lien.id, pays: lien.pays });
  return res.json(lien);
}));

/**
 * Peut-on passer la portée en `strict` ?
 *
 * C'est la seule question que pose le cran `observe`, et voici sa réponse :
 * les pays qui ont encore été vus travailler sans lien personnel. Tant que
 * cette liste n'est pas vide, basculer couperait quelqu'un.
 *
 * Les compteurs vivent en mémoire et repartent à zéro au redémarrage : ils
 * mesurent une campagne de distribution, pas un historique.
 */
router.get('/etat', requireAdmin, asyncHandler(async (req, res) => {
  const liens = listerLiens();
  return res.json({
    niveau: niveauAcces(),
    secretConfigure: isReporterTokenConfigured(),
    liens: {
      actifs: liens.filter((l) => !l.revoqueLe).length,
      revoques: liens.filter((l) => l.revoqueLe).length,
      // Les pays qui ont au moins un lien actif. En `strict`, un pays absent
      // de cette liste ne pourra plus rien envoyer.
      paysAvecLien: [...new Set(liens.filter((l) => !l.revoqueLe).map((l) => l.pays))].sort(),
      detail: liens,
    },
    acces: lireEtat(),
  });
}));

export default router;
