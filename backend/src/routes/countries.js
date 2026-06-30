import { Router } from 'express';
import logger from '../logger/index.js';
import { COUNTRIES } from '../data/constants.js';
import { getCustomCountries, addCustomCountry } from '../data/store.js';
import { createLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';
import { audit } from '../logger/audit.js';

const router = Router();

// Limites de validation. Conservateur : id court alphanum, name lisible
// mais borné, code court — évite d'avoir des champs polluant l'UI ou
// des charges utiles inutilement lourdes.
const ID_RE = /^[a-z0-9-]{2,12}$/;
const CODE_RE = /^[A-Z0-9]{2,5}$/;
const NAME_MAX = 60;

function listAllCountries() {
  // Pays par défaut (env COUNTRIES_JSON ou liste statique) + pays
  // ajoutés via l'API. Dedupe par id ; le défaut gagne en cas de
  // collision (un pays "officiel" ne peut pas être écrasé).
  const seen = new Set(COUNTRIES.map((c) => c.id));
  const extras = getCustomCountries().filter((c) => !seen.has(c.id));
  return [...COUNTRIES, ...extras];
}

router.get('/', (_req, res) => res.json(listAllCountries()));

router.post(
  '/',
  createLimiter,
  asyncHandler(async (req, res, next) => {
    const { id, name, code } = req.body || {};

    if (typeof id !== 'string' || typeof name !== 'string' || typeof code !== 'string') {
      return next(createErrors.validationError('id, name et code sont requis (chaînes)'));
    }

    const cleanId = id.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    if (!ID_RE.test(cleanId)) {
      return next(
        createErrors.validationError(
          'id: 2 à 12 caractères, minuscules / chiffres / tirets uniquement'
        )
      );
    }
    if (!cleanName || cleanName.length > NAME_MAX) {
      return next(
        createErrors.validationError(`name: 1 à ${NAME_MAX} caractères`)
      );
    }
    if (!CODE_RE.test(cleanCode)) {
      return next(
        createErrors.validationError(
          'code: 2 à 5 caractères, majuscules / chiffres uniquement'
        )
      );
    }

    const all = listAllCountries();
    if (all.some((c) => c.id === cleanId)) {
      return next(createErrors.badRequest(`Le pays "${cleanId}" existe déjà`));
    }
    if (all.some((c) => c.code === cleanCode)) {
      return next(createErrors.badRequest(`Le code "${cleanCode}" est déjà utilisé`));
    }

    const country = { id: cleanId, name: cleanName, code: cleanCode };
    addCustomCountry(country);

    audit('country.create', req, { country });
    logger.info('Country created', { context: { country, ip: req.ip } });

    return res.status(201).json(country);
  })
);

export default router;
