/**
 * Où en est la rédaction du journal cette semaine ?
 *
 * LE BESOIN : le rédacteur en chef ouvrait le conducteur et le Mot du JT à
 * l'aveugle, pour vérifier ce qui manquait. L'accueil dit maintenant, pour
 * chaque rubrique, ce qui est prêt et ce qui reste à faire — comme le
 * conducteur d'un vrai journal, où chaque élément a son état.
 *
 * Pur : reçoit ce que l'API a rendu (`api.getRubriques`, et les fichiers des
 * tiroirs `tj` et `mj`), ne lit ni l'heure ni le réseau.
 */

const rempli = (valeur) => typeof valeur === 'string' && valeur.trim().length > 0;
const aDesFichiers = (liste) => Array.isArray(liste) && liste.length > 0;

/** La plus récente des dates : celle du texte, ou celle du dernier fichier déposé. */
function derniereModif(rubrique, fichiers) {
  const dates = [rubrique?.majLe, ...(Array.isArray(fichiers) ? fichiers.map((f) => f?.uploadedAt) : [])]
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter(Number.isFinite);
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
}

function resumer(elements) {
  const faits = elements.filter((e) => e.fait).length;
  const etat = faits === 0 ? 'vide' : faits === elements.length ? 'pret' : 'partiel';
  return { elements, faits, total: elements.length, etat };
}

/**
 * @param {object} donnees
 * @param {object|null} donnees.rubriques  `{ conducteur: {...}, motDuJt: {...} }`, ou null si illisible
 * @param {Array|null} donnees.fichiersConducteur  fichiers du tiroir `tj`
 * @param {Array|null} donnees.fichiersMot  fichiers du tiroir `mj`
 */
export function etatRedaction({ rubriques = null, fichiersConducteur = null, fichiersMot = null } = {}) {
  const inconnu = !rubriques || typeof rubriques !== 'object';
  const conducteur = (inconnu ? {} : rubriques.conducteur) || {};
  const mot = (inconnu ? {} : rubriques.motDuJt) || {};

  return {
    inconnu,
    conducteur: {
      ...resumer([
        { cle: 'texte', fait: rempli(conducteur.texte) },
        { cle: 'texteVoixOff', fait: rempli(conducteur.texteVoixOff) },
        { cle: 'voixOff', fait: aDesFichiers(fichiersConducteur) },
      ]),
      majLe: derniereModif(conducteur, fichiersConducteur),
    },
    motDuJt: {
      ...resumer([
        { cle: 'video', fait: aDesFichiers(fichiersMot) },
        { cle: 'orateur', fait: rempli(mot.orateur) },
        // Le pays de l'orateur passe à l'antenne, dans le bandeau du titre.
        { cle: 'pays', fait: rempli(mot.pays) },
        { cle: 'theme', fait: rempli(mot.theme) },
      ]),
      orateur: rempli(mot.orateur) ? mot.orateur.trim() : '',
      majLe: derniereModif(mot, fichiersMot),
    },
  };
}

/** Le total des éléments prêts, toutes rubriques confondues. */
export function avancementRedaction(etat) {
  const faits = (etat?.conducteur?.faits || 0) + (etat?.motDuJt?.faits || 0);
  const total = (etat?.conducteur?.total || 0) + (etat?.motDuJt?.total || 0);
  return { faits, total, part: total ? faits / total : 0 };
}
