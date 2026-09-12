import { Router } from 'express';
import { buildWeeks } from '../data/constants.js';
import { libelleSemaine } from '../data/store.js';

const router = Router();

// Recalculé à chaque requête : le serveur peut tourner plusieurs jours
// sans redémarrer, et la liste évolue à minuit chaque jour (passage
// lun→mar, mar→mer où la précédente disparaît, dim→lun où la suivante
// devient courante).
//
// Deux numérotations coexistent à l'écran : « Semaine 37 » (le numéro ISO,
// qui sert de clé partout) et « Sem. 18 » (le numéro d'édition de la
// rédaction, saisi au planning). C'est la même semaine ; les faire porter
// toutes les deux par la liste évite qu'un écran doive aller chercher le
// planning pour nommer une semaine. `name` ne bouge pas : d'autres vues s'en
// servent déjà.
//
// La fusion se fait ici, et pas dans `buildWeeks` : `store.js` importe
// `constants.js`, l'inverse fermerait le cycle d'import.
router.get('/', (_req, res) => res.json(
  buildWeeks().map((semaine) => ({ ...semaine, libelle: libelleSemaine(semaine.id) })),
));

export default router;
