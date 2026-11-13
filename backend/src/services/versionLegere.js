/**
 * La version légère du JT publié, pour les téléphones.
 *
 * LE BESOIN : le master sort en 1080p, plusieurs centaines de mégaoctets.
 * Beaucoup de correspondants le regardent sur un téléphone, en données
 * mobiles payées au mégaoctet. Une copie en 480p, à débit modeste, pèse
 * quatre à six fois moins et suffit sur un écran de téléphone ; le master
 * reste à côté, en qualité TV, pour qui le diffuse.
 *
 * La copie se fabrique en arrière-plan, dans la même file que les autres
 * encodages : jamais deux ffmpeg à la fois sur le serveur.
 */
import ffmpeg from '../lib/ffmpeg.js';
import fs from 'fs';
import path from 'path';
import logger from '../logger/index.js';
import { runSerially } from './videoCompress.js';
import { getDelivery, majLivraison, toutesLesLivraisons } from '../data/store.js';
import { nomLeger } from '../lib/leger.js';

export const HAUTEUR_LEGERE = 480;

/** Une copie qui ne fait pas gagner au moins 20 % ne sert à rien. */
const GAIN_MINIMAL = 0.8;
const DELAI_MAX_MS = Number(process.env.LEGER_TIMEOUT_MS) || 2 * 60 * 60 * 1000;

const tailleAffichee = (octets) => `${(octets / (1024 * 1024)).toFixed(1)} MB`;

/** Les réglages d'encodage, exposés pour les tests. */
export const OPTIONS_LEGERES = [
  '-c:v libx264', '-preset veryfast', '-crf 30',
  '-maxrate 800k', '-bufsize 1600k',
  '-pix_fmt yuv420p', '-profile:v main',
  '-c:a aac', '-b:a 64k', '-ac 2',
  // La lecture commence avant la fin du téléchargement.
  '-movflags +faststart',
  '-threads 2', '-max_muxing_queue_size 1024',
  '-f mp4',
];

// Jamais agrandie : un master déjà petit garde sa taille.
export const FILTRE_LEGER = `scale=-2:'min(${HAUTEUR_LEGERE},ih)'`;

const encodages = new Map(); // id de livraison -> commande ffmpeg en cours

/** La durée du JT, pour les statistiques (« durée du JT » semaine par semaine). */
export function dureeDe(chemin) {
  return new Promise((resolve) => {
    try {
      ffmpeg.ffprobe(chemin, (err, m) => {
        const d = Number(m?.format?.duration);
        resolve(!err && Number.isFinite(d) && d > 0 ? Math.round(d * 10) / 10 : null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Fabrique la copie à côté du master.
 *
 * @returns {{ statut: 'pret', filename, octets } | { statut: 'inutile' } | { statut: 'echec' }}
 */
export async function fabriquerVersionLegere(chemin, { id = null, encoder = null } = {}) {
  const dossier = path.dirname(chemin);
  const filename = nomLeger(chemin);
  // `.tmp` : la copie inachevée n'est jamais servie (voir app.js).
  const provisoire = path.join(dossier, `${filename}.tmp`);
  const final = path.join(dossier, filename);
  try {
    if (encoder) {
      await encoder(chemin, provisoire);
    } else {
      await new Promise((resolve, reject) => {
        const commande = ffmpeg(chemin)
          .videoFilters(FILTRE_LEGER)
          .outputOptions(OPTIONS_LEGERES)
          .on('start', () => logger.info(`Version légère du JT : ${path.basename(chemin)}`));
        if (id) encodages.set(id, commande);
        const minuteur = setTimeout(() => {
          try { commande.kill('SIGKILL'); } catch { /* déjà arrêté */ }
          reject(new Error('délai dépassé'));
        }, DELAI_MAX_MS);
        minuteur.unref?.();
        commande
          .on('end', () => { clearTimeout(minuteur); resolve(); })
          .on('error', (err) => { clearTimeout(minuteur); reject(err); })
          .save(provisoire);
      });
    }
    const avant = fs.statSync(chemin).size;
    const apres = fs.statSync(provisoire).size;
    if (!(apres > 0) || apres >= avant * GAIN_MINIMAL) {
      fs.unlinkSync(provisoire);
      return { statut: 'inutile' };
    }
    fs.renameSync(provisoire, final);
    logger.info(`Version légère prête : ${(avant / 1e6).toFixed(0)} → ${(apres / 1e6).toFixed(0)} Mo`);
    return { statut: 'pret', filename, octets: apres };
  } catch (err) {
    logger.warn(`Version légère non fabriquée : ${err.message}`);
    try { if (fs.existsSync(provisoire)) fs.unlinkSync(provisoire); } catch { /* ignore */ }
    return { statut: 'echec' };
  } finally {
    if (id) encodages.delete(id);
  }
}

/**
 * Met la copie d'une livraison en file. Rend `false` pour ce qui n'est pas
 * une vidéo (un document, un son).
 *
 * @param signaler appelé quand l'état change (pour rafraîchir les écrans)
 */
export function planifierVersionLegere(weekId, livraison, { dossier, signaler = () => {}, encoder = null } = {}) {
  if (!livraison || livraison.type !== 'video' || !livraison.filename) return false;
  majLivraison(weekId, livraison.id, { leger: { statut: 'en_cours' } });
  signaler();
  return runSerially(async () => {
    // Retirée entre-temps : rien à fabriquer.
    if (!getDelivery(weekId).some((d) => d.id === livraison.id)) return;
    const chemin = path.join(dossier, livraison.filename);
    const existe = fs.existsSync(chemin);
    const dureeSec = existe ? await dureeDe(chemin) : null;
    const resultat = existe
      ? await fabriquerVersionLegere(chemin, { id: livraison.id, encoder })
      : { statut: 'echec' };
    const leger = resultat.statut === 'pret'
      ? { statut: 'pret', filename: resultat.filename, size: tailleAffichee(resultat.octets), octets: resultat.octets }
      : { statut: resultat.statut };
    const encore = majLivraison(weekId, livraison.id, { leger, ...(dureeSec ? { dureeSec } : {}) });
    // Le JT a été retiré pendant l'encodage : la copie part avec lui.
    if (!encore && resultat.filename) {
      try { fs.unlinkSync(path.join(dossier, resultat.filename)); } catch { /* ignore */ }
    }
    signaler();
  });
}

/** Arrête l'encodage d'un JT qu'on retire. */
export function annulerVersionLegere(id) {
  const commande = encodages.get(id);
  if (!commande) return false;
  try { commande.kill('SIGKILL'); } catch { /* déjà arrêté */ }
  encodages.delete(id);
  return true;
}

/**
 * Au démarrage : les copies interrompues par un redémarrage repartent.
 * Sans cela, la livraison restait « en préparation » pour toujours.
 */
export function reprendreVersionsLegeres({ dossier, signaler } = {}) {
  let n = 0;
  for (const { weekId, livraison } of toutesLesLivraisons()) {
    if (livraison.leger?.statut !== 'en_cours') continue;
    planifierVersionLegere(weekId, livraison, { dossier, signaler });
    n += 1;
  }
  if (n) logger.info(`Versions légères reprises après redémarrage : ${n}`);
  return n;
}
