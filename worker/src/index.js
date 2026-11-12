import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { selectComposition, renderMedia, ensureBrowser, makeCancelSignal, RenderInternals } from '@remotion/renderer';
import { decouper, avancement, avecReprises, messageEchec, reglages, placeNecessaire } from './troncons.js';
import { HAS_R2, presignRead, uploadFile } from './r2.js';
import { argsMesure, lireMesure, filtreCorrection, lireResultat, dansLaNorme } from './sonorite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVE_URL = process.env.REMOTION_SERVE_URL || path.join(__dirname, '../../remotion/build');
const WORKER_KEY = process.env.WORKER_KEY || '';
const PORT = process.env.PORT || 8080;
// Allowlist des origines de callback (anti-SSRF si WORKER_KEY fuite : le
// worker détient les creds R2, on ne le laisse pas POSTer vers un hôte
// arbitraire). Défaut : l'API publique connue + les hôtes internes Docker.
const ALLOWED_RETURN_TO = (process.env.ALLOWED_RETURN_TO
  || process.env.PUBLIC_API_URL
  || 'http://backend:3010')
  .split(',').map((s) => s.trim()).filter(Boolean);

function isAllowedReturnTo(url) {
  if (typeof url !== 'string' || !url) return false;
  return ALLOWED_RETURN_TO.some((allowed) => url === allowed || url.startsWith(`${allowed}/`));
}

const app = express();
// Des centaines de plans, chacun avec ses habillages : 2 Mo ne suffisaient
// pas toujours, et le refus était silencieux côté monteur.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '20mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

// Résout les filenames du payload en URLs présignées R2 lisibles par Chromium.
async function resolveUrls(payload) {
  const p = JSON.parse(JSON.stringify(payload));
  for (const c of p.clips || []) {
    if (c.filename && !c.url) c.url = await presignRead(`uploads/${c.filename}`);
  }
  if (p.music && p.music.filename) p.music.url = await presignRead(`uploads/${p.music.filename}`);
  if (p.voiceover && p.voiceover.filename) p.voiceover.url = await presignRead(`uploads/${p.voiceover.filename}`);
  for (const ov of p.imageOverlays || []) {
    if (ov.filename && !ov.url) ov.url = await presignRead(`uploads/${ov.filename}`);
  }
  return p;
}

async function callback(returnTo, jobId, body, label) {
  if (!returnTo) {
    console.warn(`[callback ${label}] skip: returnTo manquant`, { jobId });
    return;
  }
  if (!jobId) {
    console.warn(`[callback ${label}] skip: jobId manquant`);
    return;
  }
  const url = `${returnTo}/api/editor/internal/progress`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Worker-Key': WORKER_KEY },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error(`[callback ${label}] HTTP ${r.status}`, { jobId, url, body: text.slice(0, 200) });
    }
  } catch (err) {
    console.error(`[callback ${label}] network error`, { jobId, url, error: err.message });
  }
}

async function postProgress(returnTo, jobId, percent, weekId) {
  return callback(returnTo, jobId, { jobId, weekId, percent: Math.round(percent), status: 'encoding' }, 'progress');
}

// Un seul rendu Chromium à la fois (budget mémoire limité). Une 2e demande
// concurrente reçoit 429 → le backend la finalisera en erreur via son
// watchdog, l'utilisateur voit un message clair plutôt qu'un OOM silencieux.
let rendering = false;

// Réglages du rendu, surchargeables sans redéploiement de code.
// Un tronçon d'une minute (1 800 images) ; chaque tronçon a 30 min pour
// aboutir avant d'être repris — au rythme mesuré, il en demande 3 à 6.
const CHUNK_FRAMES = Number(process.env.RENDER_CHUNK_FRAMES) || 1800;
const CHUNK_TIMEOUT_MS = Number(process.env.RENDER_CHUNK_TIMEOUT_MS) || 30 * 60 * 1000;
const CHUNK_TRIES = Number(process.env.RENDER_CHUNK_TRIES) || 3;
/** La mémoire accordée au conteneur (cgroup), sinon celle de la machine. */
function memoireAccordeeMo() {
  for (const f of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const n = Number(fs.readFileSync(f, 'utf8').trim());
      if (Number.isFinite(n) && n > 0 && n < os.totalmem()) return Math.round(n / 1048576);
    } catch { /* pas ce système de cgroup */ }
  }
  return Math.round(os.totalmem() / 1048576);
}
const MEMOIRE_MO = memoireAccordeeMo();
const { concurrence: CONCURRENCY, cacheMo: CACHE_MO } = reglages({
  memoireMo: MEMOIRE_MO,
  coeurs: os.cpus().length,
  concurrenceVoulue: process.env.RENDER_CONCURRENCY,
  cacheVouluMo: process.env.REMOTION_VIDEO_CACHE_MB,
});
const VIDEO_THREADS = Number(process.env.RENDER_VIDEO_THREADS) || 2;
const X264_PRESET = process.env.RENDER_X264_PRESET || 'veryfast';
// Navigateur fourni par l'hôte (tests, machines sans téléchargement).
const BROWSER = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
// Où poser le master quand il n'y a pas de stockage distant.
const EXPORTS_DIR = process.env.EXPORTS_DIR || path.join('/app/uploads/files', 'exports');

/** `renderMedia`, abandonné proprement s'il dépasse `ms`. */
async function rendreAvecDelai(options, ms, label) {
  const { cancelSignal, cancel } = makeCancelSignal();
  let minuteur;
  const garde = new Promise((_, reject) => {
    minuteur = setTimeout(() => {
      cancel();
      reject(new Error(`${label} : délai dépassé (${Math.round(ms / 60000)} min)`));
    }, ms);
  });
  try {
    return await Promise.race([renderMedia({ ...options, cancelSignal }), garde]);
  } finally {
    clearTimeout(minuteur);
  }
}

app.post('/render', async (req, res) => {
  if (WORKER_KEY && req.header('x-worker-key') !== WORKER_KEY) {
    console.warn('[/render] 403 forbidden — X-Worker-Key invalide');
    return res.status(403).json({ error: 'forbidden' });
  }
  const { payload, jobId, returnTo, weekId = null } = req.body || {};
  if (!payload || !Array.isArray(payload.clips) || payload.clips.length === 0) {
    return res.status(400).json({ error: 'payload.clips requis' });
  }
  if (returnTo && !isAllowedReturnTo(returnTo)) {
    console.warn('[/render] 400 returnTo non autorisé (anti-SSRF)', { jobId, returnTo });
    return res.status(400).json({ error: 'returnTo non autorisé' });
  }
  if (rendering) {
    console.warn('[/render] 429 busy — un rendu est déjà en cours', { jobId });
    return res.status(429).json({ error: 'busy' });
  }
  console.log('[/render] accepté', { jobId, clips: payload.clips.length, returnTo });

  // Réponse immédiate : rendu en arrière-plan (évite timeout HTTP).
  res.status(202).json({ accepted: true });

  rendering = true;
  const workDir = fs.mkdtempSync(path.join(process.env.RENDER_WORK_DIR || os.tmpdir(), 'jt-remotion-'));
  const outName = `export_${uuidv4()}.mp4`;
  try {
    if (!BROWSER) await ensureBrowser();
    const inputProps = HAS_R2 ? await resolveUrls(payload) : payload;
    // disableWebSecurity n'est PAS activé par défaut. Le pipeline normal
    // (URLs servies via backend same-origin) n'en a pas besoin. Si ton
    // bucket R2 refuse les requêtes cross-origin de Chromium, configure
    // CORS sur le bucket (méthode propre) plutôt que désactiver la sécu
    // Chromium. Opt-in via env si vraiment nécessaire (rendu test rapide).
    const sharedChromiumOptions = {
      gl: 'angle',
      ...(process.env.CHROMIUM_DISABLE_WEB_SECURITY === 'true' ? { disableWebSecurity: true } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
    const composition = await selectComposition({
      serveUrl: SERVE_URL,
      id: 'JTMaster',
      inputProps,
      chromiumOptions: sharedChromiumOptions,
      browserExecutable: BROWSER,
    });

    let dernierEnvoi = 0;
    let dernierPourcent = -1;
    const dire = (etat) => {
      const pct = Math.round(avancement(etat));
      const maintenant = Date.now();
      // Un point d'avancement au moins toutes les 2 min, même sans changement
      // de pourcentage : le serveur croit le rendu mort après 10 min de silence.
      if ((pct !== dernierPourcent && maintenant - dernierEnvoi > 500) || maintenant - dernierEnvoi > 120000) {
        dernierEnvoi = maintenant;
        dernierPourcent = pct;
        postProgress(returnTo, jobId, pct, weekId);
      }
    };

    const commun = {
      composition,
      serveUrl: SERVE_URL,
      inputProps,
      concurrency: CONCURRENCY,
      // Plafonne le cache d'images vidéo du compositor. Par défaut, Remotion le
      // dimensionne sur la RAM de l'hôte, pas sur la limite du conteneur :
      // le compositor dépassait et était tué (SIGKILL).
      offthreadVideoCacheSizeInBytes: CACHE_MO * 1024 * 1024,
      offthreadVideoThreads: VIDEO_THREADS,
      chromiumOptions: sharedChromiumOptions,
      browserExecutable: BROWSER,
      // Par image : au-delà, l'image est déclarée bloquée et le tronçon repris.
      timeoutInMilliseconds: Number(process.env.RENDER_FRAME_TIMEOUT_MS) || 120000,
    };

    const total = composition.durationInFrames;
    const plages = decouper(total, CHUNK_FRAMES);
    console.log('[/render] plan', { jobId, images: total, troncons: plages.length });

    // Assez de place pour aller au bout ? (Tronçons et master final coexistent
    // le temps de l'assemblage.)
    try {
      const { bavail, bsize } = fs.statfsSync(workDir);
      const libre = Number(bavail) * Number(bsize);
      const besoin = placeNecessaire(total, composition.fps);
      if (libre < besoin) {
        throw Object.assign(new Error(
          `Il n'y a plus assez de place sur le serveur pour ce master : il faut environ ${Math.ceil(besoin / 1e9)} Go libres, il en reste ${(libre / 1e9).toFixed(1)}. Prévenez la personne qui gère le serveur.`,
        ), { place: true });
      }
    } catch (err) {
      if (err.place) throw err; // sinon : disque illisible, on tente quand même
    }

    // 1. Tronçon par tronçon, image et son ensemble. Le son reste non
    // compressé dans chaque tronçon : recollé à l'échantillon près, il n'est
    // encodé qu'une fois, à l'assemblage — un son compressé par morceaux
    // claque à chaque jointure. (Une passe « son seul » a été mesurée : elle
    // avance à 13 images/s et doublait presque la durée du rendu.)
    const parts = [];
    for (let i = 0; i < plages.length; i += 1) {
      const [debut, fin] = plages[i];
      const part = path.join(workDir, `t${String(i).padStart(5, '0')}.mkv`);
      await avecReprises(
        () => {
          try { fs.rmSync(part, { force: true }); } catch { /* rien à effacer */ }
          return rendreAvecDelai({
            ...commun,
            codec: 'h264-mkv',
            audioCodec: 'pcm-16',
            enforceAudioTrack: true,
            pixelFormat: 'yuv420p',
            x264Preset: X264_PRESET,
            frameRange: [debut, fin],
            outputLocation: part,
            onProgress: ({ progress }) => dire({ phase: 'troncons', fraction: progress, tronconsFaits: i, nbTroncons: plages.length }),
          }, CHUNK_TIMEOUT_MS, `Tronçon ${i + 1}/${plages.length}`);
        },
        CHUNK_TRIES,
        (err, essai) => console.error(`[/render] tronçon ${i + 1}/${plages.length} : essai ${essai} échoué`, { jobId, error: err.message }),
      ).catch((err) => {
        // Le monteur doit savoir OÙ regarder dans son montage.
        throw new Error(messageEchec(debut, fin, composition.fps, CHUNK_TRIES, err));
      });
      parts.push(part);
    }

    // 2. L'assemblage, sans réencoder l'image : directement là où le master sera
    // servi, pour ne pas recopier 2 Go d'un disque à l'autre.
    dire({ phase: 'assemblage', fraction: 0 });
    const finalDir = HAS_R2 ? workDir : EXPORTS_DIR;
    fs.mkdirSync(finalDir, { recursive: true });
    const finalPath = path.join(finalDir, outName);
    const liste = path.join(workDir, 'liste.txt');
    fs.writeFileSync(liste, parts.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    const ff = (args) => RenderInternals.callFf({
      bin: 'ffmpeg', indent: false, logLevel: 'error', binariesDirectory: null, cancelSignal: undefined, args,
    });
    const assembler = (filtreSon) => ff([
      '-hide_banner', '-nostats',
      '-y', '-f', 'concat', '-safe', '0', '-i', liste,
      '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
      ...(filtreSon ? ['-af', filtreSon] : []),
      '-c:a', 'aac', '-b:a', '192k',
      // L'index en tête : le master se lit et se télécharge par morceaux
      // sans attendre la fin du fichier.
      '-movflags', '+faststart',
      finalPath,
    ]);

    // Le niveau sonore, à la norme de diffusion (voir sonorite.js) : une passe
    // de mesure — le son seul, rapide — puis l'assemblage applique le gain.
    // Le son ne doit jamais faire échouer un rendu de deux heures : en cas de
    // problème, le master sort au niveau d'origine et on le dit.
    let mesure = null;
    try {
      mesure = lireMesure((await ff(argsMesure(liste, { concat: true }))).stderr);
    } catch (err) {
      console.error('[/render] mesure du son impossible', { jobId, error: String(err.message || err).slice(0, 300) });
    }
    dire({ phase: 'assemblage', fraction: 0.3 });
    let son = null;
    try {
      const sortie = await assembler(mesure ? filtreCorrection(mesure) : null);
      const resultat = mesure ? lireResultat(sortie.stderr) : null;
      if (mesure && resultat) {
        son = {
          avant: mesure.integre,
          apres: resultat.integre,
          crete: resultat.crete,
          mode: resultat.mode,
          norme: dansLaNorme(resultat.integre),
        };
      }
    } catch (err) {
      if (!mesure) throw err;
      console.error('[/render] correction du son échouée, assemblage sans correction', { jobId, error: String(err.message || err).slice(0, 300) });
      await assembler(null);
    }
    const taille = fs.statSync(finalPath).size;
    if (!taille) throw new Error('Master vide après assemblage.');
    console.log('[/render] master prêt', { jobId, Mo: Math.round(taille / 1e6), troncons: parts.length, son });

    let url = `/uploads/exports/${outName}`;
    if (HAS_R2) {
      const r2Key = `exports/${outName}`;
      await uploadFile(finalPath, r2Key, 'video/mp4');
      url = await presignRead(r2Key, 60 * 60 * 24);
    }
    await callback(returnTo, jobId, { jobId, weekId, percent: 100, status: 'done', url, son }, 'done');
  } catch (err) {
    console.error('Render failed', err);
    await callback(returnTo, jobId, { jobId, weekId, status: 'error', error: String(err.message || err).slice(0, 400) }, 'error');
  } finally {
    rendering = false;
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

app.listen(PORT, () => console.log(`Render worker on :${PORT} (serveUrl=${SERVE_URL}, mémoire=${MEMOIRE_MO} Mo, rendus de front=${CONCURRENCY}, cache vidéo=${CACHE_MO} Mo)`));
