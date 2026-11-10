/**
 * Le rendu d'un master par tronçons.
 *
 * L'INCIDENT (mesuré, pas supposé) : le rendu avance à 5–10 images par
 * seconde. Un JT de 30 minutes — 54 000 images — demande donc 1 h 30 à 3 h.
 * Rendu d'un seul tenant, il cumulait trois fragilités :
 *   - un incident à la 170e minute (plan illisible, navigateur figé, mémoire)
 *     faisait tout perdre, sans reprise possible ;
 *   - chaque rush était copié sur le disque du moteur et y restait jusqu'à la
 *     fin : des centaines de rushes, des dizaines de gigaoctets ;
 *   - le navigateur de rendu tournait trois heures sans jamais être relancé.
 *
 * Le master est donc rendu par tronçons d'une minute, chacun repris jusqu'à
 * trois fois s'il échoue ; le son y reste non compressé, pour être recollé à
 * l'échantillon près et encodé une seule fois ; l'image est assemblée sans
 * réencodage. Un incident ne coûte plus qu'une minute de rendu.
 *
 * Ce fichier ne contient que le calcul, sans dépendance : il se teste seul.
 */

/** Les plages d'images [debut, fin] (bornes incluses) couvrant `total`. */
export function decouper(total, pas) {
  const n = Math.max(1, Math.floor(Number(total)) || 1);
  const p = Math.max(1, Math.floor(Number(pas)) || 1);
  const plages = [];
  for (let debut = 0; debut < n; debut += p) {
    plages.push([debut, Math.min(n, debut + p) - 1]);
  }
  return plages;
}

/**
 * L'avancement global, de 0 à 100 : les tronçons comptent pour 96 %,
 * l'assemblage final pour le reste. 100 n'est annoncé qu'avec le lien.
 */
export function avancement({ phase, fraction = 0, tronconsFaits = 0, nbTroncons = 1 }) {
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (phase === 'troncons') return 96 * ((tronconsFaits + f) / Math.max(1, nbTroncons));
  if (phase === 'assemblage') return 96 + 3 * f;
  return 0;
}

/** Recommence `fn` jusqu'à `essais` fois ; rend la dernière erreur sinon. */
export async function avecReprises(fn, essais = 3, surEchec = () => {}) {
  let derniere;
  for (let i = 1; i <= essais; i += 1) {
    try {
      return await fn(i);
    } catch (err) {
      derniere = err;
      surEchec(err, i);
    }
  }
  throw derniere;
}

function minutage(images, fps) {
  const s = Math.floor(images / fps);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Ce que lit le monteur quand un passage résiste à toutes les reprises :
 * l'endroit du montage, puis la cause technique en une ligne.
 */
export function messageEchec(debut, fin, fps, essais, err) {
  const cause = String(err?.message || err || '').split('\n')[0].slice(0, 160);
  return `Le passage de ${minutage(debut, fps)} à ${minutage(fin + 1, fps)} n'a pas pu être rendu, malgré ${essais} essais. `
    + `Vérifiez les plans de ce passage (un fichier abîmé, le plus souvent), puis relancez. Détail : ${cause}`;
}

/**
 * Combien d'images rendre à la fois, selon la mémoire réellement accordée.
 *
 * Mesuré en 1080p (mémoire que le noyau ne peut pas reprendre) : 1,4 Go avec
 * un rendu à la fois et un cache vidéo de 256 Mo ; 2,1 Go avec deux rendus de
 * front et un cache de 512 Mo. Dans un conteneur limité à 2 Go, deux rendus de
 * front faisaient tuer le moteur par le noyau, en plein rendu et sans message.
 * On ne rend donc à deux que si la mémoire le permet (3,5 Go et plus).
 * Une valeur imposée par la configuration reste prioritaire.
 */
export function reglages({ memoireMo, coeurs, concurrenceVoulue, cacheVouluMo }) {
  const mem = Number(memoireMo) > 0 ? Number(memoireMo) : 2048;
  const large = mem >= 3500;
  const auto = large && Number(coeurs) >= 2 ? 2 : 1;
  return {
    concurrence: Number(concurrenceVoulue) > 0 ? Math.floor(Number(concurrenceVoulue)) : auto,
    cacheMo: Number(cacheVouluMo) > 0 ? Number(cacheVouluMo) : (large ? 512 : 256),
  };
}

/**
 * La place qu'il faut sur le disque avant de commencer, en octets.
 *
 * Mesuré : un master en 1080p pèse environ 72 Mo par minute. Il existe deux
 * fois le temps de l'assemblage (les tronçons, puis le fichier final), avec un
 * son non compressé dans les tronçons. Mieux vaut refuser tout de suite que
 * d'échouer à l'assemblage, après trois heures de rendu.
 */
export function placeNecessaire(images, fps) {
  const minutes = Math.max(1, Number(images) / Math.max(1, Number(fps)) / 60);
  const parMinute = 72e6 + 11.5e6; // image + son non compressé (48 kHz stéréo)
  return Math.ceil(minutes * (parMinute + 72e6) * 1.25 + 200e6);
}
