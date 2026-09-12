import path from 'path';
import ffmpeg from '../lib/ffmpeg.js';
import logger from '../logger/index.js';
import { setFileDuration } from '../data/store.js';
import { uploadsDir } from '../lib/paths.js';

/**
 * Durée des rushes reçus.
 *
 * Le serveur mesurait déjà chaque fichier au moment de fabriquer le master,
 * puis jetait le chiffre. C'est pourtant le premier que cherche un monteur :
 * combien dure ce rush, combien pèse ce pays, où en est le journal par rapport
 * à sa durée cible. On le mesure donc à l'arrivée, une fois pour toutes.
 *
 * La mesure ne fait jamais attendre l'envoi : le correspondant a déjà sa
 * confirmation quand ffprobe démarre. Si elle échoue, la durée reste `null`
 * et l'écran dit « durée inconnue » — ce n'est pas une raison de refuser un
 * fichier qui est bien arrivé.
 */

// ffprobe ne lit que l'en-tête : c'est rapide, mais un fichier tronqué ou un
// conteneur exotique peut le faire chercher longtemps. Au-delà, on renonce.
const DELAI_MAX_MS = Number(process.env.PROBE_TIMEOUT_MS) || 30 * 1000;

// Deux sondes à la fois : le conteneur de production tient dans 512 Mo, et une
// salve de trente envois le dimanche matin ne doit pas lancer trente process.
const PARALLELE_MAX = Number(process.env.PROBE_CONCURRENCY) || 2;

let enCours = 0;
const attente = [];

/**
 * Durée en secondes d'un fichier média, ou `null` si elle est indéterminable
 * (fichier texte, image, conteneur illisible, ffprobe absent).
 */
export function mesurerDuree(cheminAbsolu) {
  return new Promise((resolve) => {
    let repondu = false;
    const repondre = (valeur) => {
      if (repondu) return;
      repondu = true;
      clearTimeout(minuteur);
      resolve(valeur);
    };

    const minuteur = setTimeout(() => {
      logger.warn('Mesure de durée abandonnée (délai dépassé)', {
        context: { fichier: path.basename(cheminAbsolu), delaiMs: DELAI_MAX_MS },
      });
      repondre(null);
    }, DELAI_MAX_MS);

    try {
      ffmpeg.ffprobe(cheminAbsolu, (err, metadata) => {
        if (err) return repondre(null);
        const secondes = Number(metadata?.format?.duration);
        if (!Number.isFinite(secondes)) return repondre(null);
        // On arrondit AVANT de juger : une image fixe est annoncée par
        // ffprobe comme une image d'un quarantième de seconde, ce qui passe
        // un test « supérieur à zéro » pour retomber sur 0 après arrondi.
        // Afficher « 0 s » ferait croire à un fichier vide au monteur qui
        // parcourt la liste ; on préfère dire qu'on ne sait pas.
        const arrondie = Math.round(secondes * 10) / 10;
        repondre(arrondie > 0 ? arrondie : null);
      });
    } catch {
      repondre(null);
    }
  });
}

function suivant() {
  if (enCours >= PARALLELE_MAX) return;
  const tache = attente.shift();
  if (!tache) return;
  enCours += 1;
  tache().finally(() => {
    enCours -= 1;
    suivant();
  });
}

/**
 * Mesure un fichier déjà rangé et pose sa durée dans le store.
 *
 * Appelée sans `await` : elle rend la main tout de suite. `onMesure` est
 * appelée uniquement quand une durée a réellement été écrite, pour que
 * l'appelant puisse prévenir les écrans ouverts.
 */
export function planifierMesure(weekId, countryId, fileId, nomFichier, onMesure) {
  if (!weekId || !countryId || !fileId || !nomFichier) return;

  attente.push(async () => {
    try {
      const duree = await mesurerDuree(path.join(uploadsDir, nomFichier));
      if (duree === null) return;
      if (setFileDuration(weekId, countryId, fileId, duree)) {
        onMesure?.(duree);
      }
    } catch (err) {
      logger.warn('Mesure de durée en échec', {
        context: { weekId, countryId, fileId, erreur: err.message },
      });
    }
  });

  suivant();
}

/** État de la file, exposé par /health au même titre que la compression. */
export function etatFileMesure() {
  return { enCours, enAttente: attente.length };
}
