import { Router } from 'express';
import { buildWeeks } from '../data/constants.js';

const router = Router();

// Recalculé à chaque requête : le serveur peut tourner plusieurs jours
// sans redémarrer, et la liste évolue à minuit chaque jour (passage
// lun→mar, mar→mer où la précédente disparaît, dim→lun où la suivante
// devient courante).
router.get('/', (_req, res) => res.json(buildWeeks()));

export default router;
