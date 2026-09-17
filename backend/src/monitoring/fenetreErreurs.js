/**
 * Le taux d'erreur des dernières minutes.
 *
 * L'INCIDENT
 * ----------
 * `alerts.js` déclarait `ERROR_RATE_WINDOW: 5 * 60 * 1000` — et ne s'en
 * servait nulle part. `checkErrorRate()` divisait les compteurs **cumulés
 * depuis le démarrage** : `errors_total / request_count`.
 *
 * Sur un serveur debout depuis une semaine avec cent mille requêtes au
 * compteur, une rafale d'échecs d'envoi un samedi soir ne déplace pas le ratio
 * de cinq pour cent. **L'alerte ne pouvait pas se déclencher.** Elle était
 * écrite, configurée, journalisée au démarrage — et incapable de partir. C'est
 * précisément le scénario qu'elle devait couvrir : une panne à Douala découverte
 * le dimanche, après la clôture de 10h30.
 *
 * Symétriquement, le cumul est aussi incapable de *s'éteindre* : une fois le
 * seuil franchi, il faudrait des milliers de requêtes saines pour redescendre.
 *
 * CE MODULE
 * ---------
 * Pur, sans horloge : **le temps est passé en argument**, comme dans
 * `semaine.js` et `historiqueMontage.js`. Il se teste comme des mathématiques.
 *
 * Les événements sont groupés par seconde plutôt que retenus un par un : une
 * fenêtre de cinq minutes tient alors en trois cents entrées, quel que soit le
 * trafic. Une seconde de résolution est très au-delà de ce qu'une alerte
 * vérifiée toutes les trente secondes peut exploiter.
 */

export const FENETRE_PAR_DEFAUT_MS = 5 * 60 * 1000;
const SEAU_MS = 1000;

/** Une fenêtre vide. `dureeMs` borne ce dont on se souvient. */
export function creerFenetre(dureeMs = FENETRE_PAR_DEFAUT_MS) {
  const duree = Number(dureeMs);
  return {
    dureeMs: Number.isFinite(duree) && duree > 0 ? duree : FENETRE_PAR_DEFAUT_MS,
    seaux: [],
  };
}

/** Jette ce qui est sorti de la fenêtre. */
function purger(fenetre, maintenant) {
  const limite = maintenant - fenetre.dureeMs;
  while (fenetre.seaux.length && fenetre.seaux[0].seconde * SEAU_MS < limite) {
    fenetre.seaux.shift();
  }
}

/**
 * Enregistre des requêtes et/ou des erreurs à l'instant donné.
 * Mute la fenêtre et la retourne.
 */
export function enregistrer(fenetre, { maintenant, requetes = 0, erreurs = 0 } = {}) {
  if (!fenetre || !Array.isArray(fenetre.seaux)) return fenetre;
  const t = Number(maintenant);
  if (!Number.isFinite(t)) return fenetre;

  const seconde = Math.floor(t / SEAU_MS);
  const dernier = fenetre.seaux[fenetre.seaux.length - 1];
  // Un horodatage qui recule (ajustement d'horloge, NTP) ne doit pas créer un
  // seau hors d'ordre : il rejoint le dernier.
  if (dernier && seconde <= dernier.seconde) {
    dernier.requetes += requetes;
    dernier.erreurs += erreurs;
  } else {
    fenetre.seaux.push({ seconde, requetes, erreurs });
  }

  purger(fenetre, t);
  return fenetre;
}

/**
 * Ce qui s'est passé dans la fenêtre à cet instant.
 * @returns {{requetes: number, erreurs: number, taux: number}}
 */
export function taux(fenetre, maintenant) {
  if (!fenetre || !Array.isArray(fenetre.seaux)) return { requetes: 0, erreurs: 0, taux: 0 };
  const t = Number(maintenant);
  if (Number.isFinite(t)) purger(fenetre, t);

  let requetes = 0;
  let erreurs = 0;
  for (const seau of fenetre.seaux) {
    requetes += seau.requetes;
    erreurs += seau.erreurs;
  }
  // Zéro requête ne divise pas par zéro : il n'y a simplement rien à dire.
  return { requetes, erreurs, taux: requetes > 0 ? erreurs / requetes : 0 };
}

export default { creerFenetre, enregistrer, taux, FENETRE_PAR_DEFAUT_MS };
