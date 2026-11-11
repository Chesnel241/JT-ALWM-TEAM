import ffmpeg from '../lib/ffmpeg.js';
import fs from 'fs';
import path from 'path';
import logger from '../logger/index.js';
import { VIDEO_EXTENSIONS } from '../lib/upload.js';

// Toutes les extensions vidéo acceptées à l'envoi, pas seulement trois.
// Avant, un .mkv ou un .mts traversait la fabrication de proxy sans rien
// produire : le monteur travaillait alors sur le master selon le téléphone
// du correspondant, sans que rien ne le signale.
const VIDEO_EXTS = new Set(VIDEO_EXTENSIONS);

/**
 * Délai au-delà duquel on considère qu'ffmpeg ne reviendra pas.
 *
 * Sans lui, la promesse d'encodage ne se règle jamais quand ffmpeg reste
 * bloqué — un fichier tronqué par un envoi interrompu, un flux qu'il ne sait
 * pas démuxer — et la file sérielle ne repart plus. Un dimanche soir, le
 * premier fichier pathologique privait de copie légère TOUS les envois
 * suivants, sans rien signaler : les masters restaient saufs, le montage
 * restait possible, et personne ne voyait que le studio était devenu lourd.
 */
const DELAI_MAX_MS = parseInt(process.env.PROXY_TIMEOUT_MS || 30 * 60 * 1000, 10);

/** Nom du proxy associé à un fichier : `<uuid>.proxy.mp4`. */
export function proxyNameFor(filename) {
  const base = path.basename(String(filename || ''));
  const dot = base.lastIndexOf('.');
  return `${dot > 0 ? base.slice(0, dot) : base}.proxy.mp4`;
}

/**
 * Fabrique une copie 720p À CÔTÉ du master, pour l'aperçu et le montage.
 *
 * Le master n'est jamais touché. La version précédente renommait le
 * réencodage par-dessus l'original : un rush 1080p devenait définitivement
 * 720p, et l'export — qui rend en 1080p — repartait de ce 720p, donc
 * l'agrandissait. Ici le master reste intact pour le rendu final, et seul
 * l'aperçu consomme la copie légère, ce qui garde le studio fluide sur une
 * machine modeste et sur une connexion faible.
 *
 * Retourne { compressed, proxyName, newSize } — `newSize` étant la taille du
 * proxy quand il existe, sinon celle du master. Une erreur ffmpeg n'est pas
 * fatale : on repart simplement sans proxy.
 *
 * @param {string} filePath  chemin local du master
 * @param {string} ext       extension du master
 */
export async function compressTo720(filePath, ext) {
  if (!VIDEO_EXTS.has(String(ext).toLowerCase())) {
    return { compressed: false, proxyName: '', newSize: fs.statSync(filePath).size };
  }

  const dir = path.dirname(filePath);
  const proxyName = proxyNameFor(filePath);
  const tmpOut = path.join(dir, `c_${path.basename(filePath)}.mp4`);

  try {
    await new Promise((resolve, reject) => {
      const commande = ffmpeg(filePath)
        // Downscale seulement si hauteur > 720 ; largeur paire (-2).
        // Sinon garde la résolution native.
        .videoFilters("scale='if(gt(ih,720),-2,iw)':'if(gt(ih,720),720,ih)'")
        .outputOptions([
          '-c:v libx264',
          '-crf 28',
          '-preset veryfast',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart',
          '-threads 2',
          '-max_muxing_queue_size 1024'
        ])
        .on('start', () => logger.info(`Compression 720p: ${path.basename(filePath)}`))
        .on('progress', (p) => logger.debug('Compression…', { percent: p.percent }));

      const minuteur = setTimeout(() => {
        logger.warn('Encodage interrompu : délai dépassé', {
          context: { fichier: path.basename(filePath), delaiMs: DELAI_MAX_MS },
        });
        try { commande.kill('SIGKILL'); } catch { /* déjà mort */ }
        reject(new Error(`Encodage interrompu après ${Math.round(DELAI_MAX_MS / 60000)} min`));
      }, DELAI_MAX_MS);
      // `unref` : ce minuteur ne doit pas à lui seul retenir le processus.
      minuteur.unref?.();

      commande
        .on('end', () => { clearTimeout(minuteur); resolve(); })
        .on('error', (err) => { clearTimeout(minuteur); reject(err); })
        .save(tmpOut);
    });

    const origSize = fs.statSync(filePath).size;
    const newSize = fs.statSync(tmpOut).size;

    // Un proxy plus lourd que le master n'apporte rien : on le jette et le
    // montage lira le master, comme avant.
    if (newSize < origSize) {
      fs.renameSync(tmpOut, path.join(dir, proxyName));
      logger.info(`Proxy 720p: ${(origSize / 1e6).toFixed(1)}→${(newSize / 1e6).toFixed(1)} MB (master conservé)`);
      return { compressed: true, proxyName, newSize };
    }
    fs.unlinkSync(tmpOut);
    return { compressed: false, proxyName: '', newSize: origSize };
  } catch (err) {
    logger.warn(`Proxy non fabriqué, le montage lira le master: ${err.message}`);
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch { /* ignore */ }
    return { compressed: false, proxyName: '', newSize: fs.statSync(filePath).size };
  }
}

// ── L'allègement des masters trop lourds ───────────────────────────────────

/**
 * Seuil au-delà duquel un rush est examiné, et débit au-delà duquel il est
 * réellement trop lourd pour ce qu'il montre.
 */
const SEUIL_OCTETS = (Number(process.env.ALLEGER_SEUIL_MO) || 200) * 1024 * 1024;
const DEBIT_CIBLE_BPS = (Number(process.env.ALLEGER_DEBIT_MBPS) || 12) * 1e6;
const CONTENEURS = { '.mp4': 'mp4', '.m4v': 'mp4', '.mov': 'mov', '.mkv': 'matroska' };

/**
 * Faut-il alléger ce rush, et comment ?
 *
 * LE BESOIN : des correspondants envoient trente secondes qui pèsent un
 * gigaoctet — un téléphone réglé en 4K, à 250 Mbit/s. Le JT sort en 1080p à
 * moins de 10 Mbit/s : tout ce débit est stocké, relu et rendu pour rien.
 *
 * On ne juge pas sur le poids seul. Un reportage de vingt minutes pèse plus
 * d'un gigaoctet à un débit tout à fait raisonnable : le réencoder l'abîmerait
 * sans rien gagner. On allège donc un fichier qui dépasse le seuil ET dont le
 * débit excède nettement ce que le JT peut montrer, ou dont l'image dépasse
 * le 1080p.
 *
 * L'image n'est jamais agrandie, jamais descendue sous le 1080p, et la
 * qualité visée (CRF 20, débit plafonné) est celle d'un fichier de diffusion :
 * la version précédente écrasait le master par du 720p, ce que le rendu
 * devait ensuite ré-agrandir.
 *
 * @returns {null | { coteCourtMax: number, images30: boolean }}
 */
export function deciderAllegement({ tailleOctets, dureeSec, largeur, hauteur, imagesParSeconde, extension }) {
  if (!CONTENEURS[String(extension || '').toLowerCase()]) return null;
  if (!(tailleOctets > SEUIL_OCTETS) || !(dureeSec > 0)) return null;
  const debit = (tailleOctets * 8) / dureeSec;
  const coteCourt = Math.min(Number(largeur) || 0, Number(hauteur) || 0);
  const tropGrand = coteCourt > 1080;
  // 1,5 fois la cible : en dessous, le gain ne vaut pas une génération de plus.
  if (!tropGrand && debit < DEBIT_CIBLE_BPS * 1.5) return null;
  return { coteCourtMax: 1080, images30: Number(imagesParSeconde) > 31 };
}

function sonder(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, m) => {
      if (err || !m) return resolve(null);
      const v = (m.streams || []).find((x) => x.codec_type === 'video');
      if (!v) return resolve(null);
      const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
      // Un téléphone tenu debout enregistre couché, avec une rotation : c'est
      // l'image redressée qu'ffmpeg réencode.
      const rotation = Math.abs(Number(v.rotation ?? v.tags?.rotate ?? (v.side_data_list || []).find((x) => x.rotation != null)?.rotation) || 0);
      const couche = rotation === 90 || rotation === 270;
      resolve({
        dureeSec: Number(m.format?.duration) || 0,
        largeur: couche ? v.height : v.width,
        hauteur: couche ? v.width : v.height,
        imagesParSeconde: d ? n / d : 0,
      });
    });
  });
}

/**
 * Remplace un master trop lourd par une version de diffusion, sous le même
 * nom de fichier. L'original n'est supprimé qu'après vérification : même
 * durée à une demi-seconde près, une image lisible, et un vrai gain de place.
 * Au moindre doute, on garde l'original.
 *
 * @returns {{ allege: boolean, avant: number, apres: number }}
 */
export async function allegerMaster(filePath, ext) {
  const avant = fs.statSync(filePath).size;
  const rien = { allege: false, avant, apres: avant };
  if (avant <= SEUIL_OCTETS) return rien;
  const source = await sonder(filePath);
  if (!source) return rien;
  const plan = deciderAllegement({ tailleOctets: avant, extension: ext, ...source });
  if (!plan) return rien;

  const dir = path.dirname(filePath);
  const tmpOut = path.join(dir, `leger_${path.basename(filePath)}`);
  const ancien = `${filePath}.origine`;
  // On ne réduit que si le petit côté dépasse 1080 : un plan vertical garde
  // sa forme, un plan 1080p garde sa taille.
  const m = plan.coteCourtMax;
  const filtres = [`scale=w='if(gt(iw,ih),-2,min(iw,${m}))':h='if(gt(iw,ih),min(ih,${m}),-2)'`];
  if (plan.images30) filtres.push('fps=30');

  try {
    await new Promise((resolve, reject) => {
      const commande = ffmpeg(filePath)
        .videoFilters(filtres)
        .outputOptions([
          '-c:v libx264', '-crf 20', '-preset fast',
          `-maxrate ${Math.round(DEBIT_CIBLE_BPS / 1000)}k`, `-bufsize ${Math.round(DEBIT_CIBLE_BPS / 500)}k`,
          '-pix_fmt yuv420p',
          '-c:a aac', '-b:a 192k',
          '-movflags +faststart', '-threads 2', '-max_muxing_queue_size 1024',
          `-f ${CONTENEURS[String(ext).toLowerCase()]}`,
        ])
        .on('start', () => logger.info(`Allègement du master: ${path.basename(filePath)} (${(avant / 1e6).toFixed(0)} Mo)`));
      const minuteur = setTimeout(() => {
        try { commande.kill('SIGKILL'); } catch { /* déjà mort */ }
        reject(new Error(`Allègement interrompu après ${Math.round(DELAI_MAX_MS / 60000)} min`));
      }, DELAI_MAX_MS);
      minuteur.unref?.();
      commande
        .on('end', () => { clearTimeout(minuteur); resolve(); })
        .on('error', (err) => { clearTimeout(minuteur); reject(err); })
        .save(tmpOut);
    });

    const apres = fs.statSync(tmpOut).size;
    const resultat = await sonder(tmpOut);
    const dureeFidele = resultat && Math.abs(resultat.dureeSec - source.dureeSec) <= 0.5;
    // Moins de 30 % de gain : on garde l'original plutôt qu'une génération de plus.
    if (!dureeFidele || !(apres < avant * 0.7)) {
      fs.unlinkSync(tmpOut);
      logger.info(`Master conservé tel quel: ${path.basename(filePath)} (gain insuffisant ou durée différente)`);
      return rien;
    }
    // L'original reste sur le disque jusqu'à ce que le remplaçant soit en place.
    fs.renameSync(filePath, ancien);
    try {
      fs.renameSync(tmpOut, filePath);
    } catch (err) {
      fs.renameSync(ancien, filePath);
      throw err;
    }
    fs.unlinkSync(ancien);
    logger.info(`Master allégé: ${(avant / 1e6).toFixed(0)}→${(apres / 1e6).toFixed(0)} Mo (${path.basename(filePath)})`);
    return { allege: true, avant, apres };
  } catch (err) {
    logger.warn(`Master non allégé, l'original est conservé: ${err.message}`);
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch { /* ignore */ }
    try { if (!fs.existsSync(filePath) && fs.existsSync(ancien)) fs.renameSync(ancien, filePath); } catch { /* ignore */ }
    return rien;
  }
}

/**
 * File d'attente sérielle des compressions.
 *
 * ffmpeg sature un cœur par encodage. Vingt correspondants qui envoient leur
 * rush le dimanche soir lanceraient autant d'encodages simultanés et le VPS
 * ne répondrait plus. Les compressions s'exécutent donc une par une, en
 * arrière-plan : le correspondant a déjà reçu sa confirmation, et le monteur
 * voit le fichier apparaître immédiatement.
 */
let queue = Promise.resolve();
let pending = 0;
let debutTacheCourante = null;

/**
 * Enchaîne une tâche derrière les précédentes. Exporté pour être testable
 * sans invoquer ffmpeg : c'est la sérialisation qui compte ici, pas
 * l'encodage.
 */
export function runSerially(task) {
  pending += 1;
  queue = queue
    .then(() => { debutTacheCourante = Date.now(); return task(); })
    .catch((err) => {
      // Une compression ratée ne doit jamais bloquer les suivantes : le
      // fichier original est conservé, c'est le comportement voulu.
      logger.warn(`Compression ignorée: ${err.message}`);
    })
    .finally(() => {
      pending -= 1;
      if (pending === 0) debutTacheCourante = null;
    });
  return queue;
}

export function queueCompression(filePath, ext, onDone, onAllege) {
  return runSerially(async () => {
    // D'abord le master, s'il est trop lourd : l'aperçu se fabrique ensuite
    // à partir du fichier allégé, bien plus vite qu'à partir d'un 4K.
    const leger = await allegerMaster(filePath, ext);
    if (leger.allege && typeof onAllege === 'function') {
      try { await onAllege(leger); } catch (err) { logger.warn(`Suivi d'allègement échoué: ${err.message}`); }
    }
    const result = await compressTo720(filePath, ext);
    if (typeof onDone === 'function') {
      try {
        await onDone(result);
      } catch (err) {
        logger.warn(`Suivi de compression échoué: ${err.message}`);
      }
    }
  });
}

/** Nombre de compressions en attente ou en cours (diagnostic). */
export function pendingCompressions() {
  return pending;
}

/**
 * État de la file, pour /health. Une file qui grossit ou une tâche dont
 * l'âge dépasse le délai maximum est le premier signe d'un fichier
 * pathologique — c'est ce qu'on veut voir avant que le studio ne rame.
 */
export function etatFileCompression() {
  return {
    enAttente: pending,
    ageTacheCouranteMs: debutTacheCourante ? Date.now() - debutTacheCourante : 0,
    delaiMaxMs: DELAI_MAX_MS,
  };
}
