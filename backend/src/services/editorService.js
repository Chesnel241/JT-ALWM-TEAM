import ffmpeg from '../lib/ffmpeg.js';
import fs from 'fs';
import os from 'os';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { uploadsDir } from '../lib/upload.js';
import { HAS_R2, getR2ReadStream, uploadToR2, getR2PresignedUrl } from '../lib/s3.js';
import logger from '../logger/index.js';
import { generateAssFile } from '../data/overlayTemplates.js';
import { setProgress } from './editorProgress.js';

let isRendering = false;

// ffmpeg/ffprobe configurés dans ../lib/ffmpeg.js (ffmpeg 7.x via ffmpeg-static
// pour les transitions xfade ; ffprobe via @ffprobe-installer).
const checkAudio = (filePath) => new Promise((resolve) => {
  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err || !metadata || !metadata.streams) return resolve(false);
    resolve(metadata.streams.some(s => s.codec_type === 'audio'));
  });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dossier des polices bundlées (Inter, Bebas Neue, Anton, Archivo Black,
// Barlow). Passé au filtre `ass` via fontsdir — INDISPENSABLE sur Render
// (conteneur sans polices système : sans ça libass substitue la police et
// le texte n'apparaît pas). FFmpeg veut des slashes avant.
const FONTS_DIR = path.join(__dirname, '../../fonts').replace(/\\/g, '/');
const HAS_FONTS = fs.existsSync(FONTS_DIR);

// Logo chaîne incrusté (bug) en habillage global.
const LOGO_PATH = path.join(__dirname, '../../assets/logo.png').replace(/\\/g, '/');
const HAS_LOGO = fs.existsSync(LOGO_PATH);

// Trace les polices au démarrage : permet de diagnostiquer depuis les logs
// Render pourquoi le texte n'apparaît pas (dossier absent → libass substitue
// → texte invisible sur conteneur sans polices système).
if (HAS_FONTS) {
  const fontFiles = fs.readdirSync(FONTS_DIR).filter((f) => /\.(ttf|otf)$/i.test(f));
  logger.info(`Polices overlays chargées (${FONTS_DIR})`, { context: { fonts: fontFiles } });
} else {
  logger.error(`Dossier polices INTROUVABLE: ${FONTS_DIR} — overlays sans texte ! Vérifier que backend/fonts est bien déployé.`);
}

// Garde-fous anti-blocage. Si ffmpeg cale (aucune progression) ou dépasse la
// limite absolue, on tue le process : sinon la promesse ne se résout jamais,
// le bloc finally ne s'exécute pas et le verrou isRendering reste bloqué à
// true jusqu'au redémarrage de Render (éditeur HS pour tout le monde).
const STEP_STALL_MS = Number(process.env.EDITOR_STALL_MS) || 4 * 60 * 1000;
const STEP_MAX_MS = Number(process.env.EDITOR_STEP_MAX_MS) || 12 * 60 * 1000;
const IO_TIMEOUT_MS = Number(process.env.EDITOR_IO_TIMEOUT_MS) || 5 * 60 * 1000;

// Résolution/preset de sortie, surchargeables sans redéploiement de code.
const OUT_W = Number(process.env.EDITOR_WIDTH) || 1280;
const OUT_H = Number(process.env.EDITOR_HEIGHT) || 720;
const OUT_FPS = Number(process.env.EDITOR_FPS) || 30;
const PRESET = process.env.EDITOR_PRESET || 'veryfast';
const THREADS = Number(process.env.EDITOR_THREADS) || 1; // 1 = RAM mini (512 Mo)

// Rejette si `promise` ne se règle pas dans `ms` (protège les I/O R2 qui
// peuvent pendre indéfiniment sur coupure réseau).
function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} : délai dépassé (${Math.round(ms / 1000)}s)`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

// Exécute une commande fluent-ffmpeg avec watchdog : surveille la progression
// et tue le process s'il cale ou dépasse la limite. `wire` reçoit la commande
// et les handlers à brancher (start/progress) ; on gère end/error/timeout ici.
function runFfmpegStep(command, label, { onStart, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    let stall;
    let hardCap;
    let settled = false;

    const clearTimers = () => { clearTimeout(stall); clearTimeout(hardCap); };
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimers();
      fn(arg);
    };
    const fail = (msg) => {
      logger.error(`Montage interrompu : ${msg}`);
      try { command.kill('SIGKILL'); } catch { /* déjà mort */ }
      finish(reject, new Error(msg));
    };
    const armStall = () => {
      clearTimeout(stall);
      stall = setTimeout(() => fail(`${label} bloqué (aucune progression depuis ${Math.round(STEP_STALL_MS / 1000)}s)`), STEP_STALL_MS);
    };

    hardCap = setTimeout(() => fail(`${label} dépasse la durée max (${Math.round(STEP_MAX_MS / 1000)}s)`), STEP_MAX_MS);

    command
      .on('start', (cmd) => { armStall(); onStart?.(cmd); })
      .on('progress', (p) => { armStall(); onProgress?.(p); })
      .on('end', () => finish(resolve))
      .on('error', (err) => finish(reject, err));
  });
}

// Transitions xfade autorisées (vidéo) — `acrossfade` côté audio.
export const XFADE_TRANSITIONS = new Set([
  'fade', 'fadeblack', 'fadewhite', 'fadegrays', 'wipeleft', 'wiperight',
  'wipeup', 'wipedown', 'slideleft', 'slideright', 'slideup', 'slidedown',
  'dissolve', 'pixelize', 'circleopen', 'circleclose', 'circlecrop', 'radial',
  'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
  'diagtl', 'diagtr', 'diagbl', 'diagbr',
  'wipetl', 'wipetr', 'wipebl', 'wipebr',
  'squeezeh', 'squeezev', 'zoomin',
  'coverleft', 'coverright', 'coverup', 'coverdown',
  'revealleft', 'revealright', 'revealup', 'revealdown',
]);
// Au-delà, on retombe sur le concat copy (le filtergraph xfade ouvre tous les
// clips à la fois → on borne la RAM sur Render free).
const MAX_XFADE_CLIPS = Number(process.env.EDITOR_MAX_XFADE_CLIPS) || 12;
const KEN_BURNS_MODES = new Set(['in', 'out']);
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;
const KEN_BURNS_IMG_DEFAULT_SEC = 5;

// Valide/normalise une transition reçue du frontend. null si absente/invalide.
function parseTransition(t) {
  if (!t || typeof t !== 'object') return null;
  const type = String(t.type || '').trim();
  if (!XFADE_TRANSITIONS.has(type)) return null;
  let d = Number(t.duration);
  if (!isFinite(d)) d = 0.5;
  d = Math.min(2, Math.max(0.2, d));
  return { type, duration: d };
}

function parseKenBurns(kb) {
  if (!kb || typeof kb !== 'object') return null;
  const mode = String(kb.mode || '').trim();
  if (!KEN_BURNS_MODES.has(mode)) return null;
  return { mode };
}

// Durée (s) d'un fichier média via ffprobe.
function getDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      const d = metadata?.format?.duration;
      resolve(err || !isFinite(d) ? 0 : Number(d));
    });
  });
}

// Filtres Ken Burns (zoom lent centré) pour un clip de durée `durSec`. Pré-scale
// 2x pour un zoom net. Incrément linéaire (pas de min/max → pas de virgule qui
// casserait la chaîne). Retourne des strings (filtergraph).
function kenBurnsFilters(mode, durSec) {
  const frames = Math.max(1, Math.round((durSec || KEN_BURNS_IMG_DEFAULT_SEC) * OUT_FPS));
  const inc = (0.25 / frames).toFixed(6); // zoom max ~1.25
  const z = mode === 'out' ? `1.25-on*${inc}` : `1.0+on*${inc}`;
  return [
    `scale=${OUT_W * 2}:${OUT_H * 2}:force_original_aspect_ratio=increase`,
    `crop=${OUT_W * 2}:${OUT_H * 2}`,
    `zoompan=z=${z}:d=1:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s=${OUT_W}x${OUT_H}:fps=${OUT_FPS}`,
    'setsar=1',
  ];
}

// Télécharge un fichier R2 vers un chemin local. Retourne destPath.
async function downloadFromR2(r2Key, destPath) {  const stream = await getR2ReadStream(r2Key);
  const out = fs.createWriteStream(destPath);
  await pipeline(stream, out);
  return destPath;
}

// Réduit un nom de fichier reçu du client à son basename et rejette toute
// tentative de traversée (`..`, séparateurs). Empêche de lire/écrire hors des
// dossiers uploads/workDir via /concat.
function safeFilename(filename) {
  const base = path.basename(String(filename || ''));
  if (!base || base === '.' || base === '..' || base.includes('/') || base.includes('\\')) {
    throw new Error('Nom de fichier invalide.');
  }
  return base;
}

/**
 * Résout le chemin local d'un clip. En mode R2, télécharge le fichier
 * dans workDir et retourne ce chemin temporaire. Sinon, retourne le
 * chemin local sous uploadsDir.
 */
async function resolveClipPath(filename, workDir) {
  const base = safeFilename(filename);
  if (HAS_R2) {
    const dest = path.join(workDir, base);
    // Timeout : un download R2 qui pend ne doit pas bloquer le verrou isRendering.
    await withTimeout(downloadFromR2(`uploads/${base}`, dest), IO_TIMEOUT_MS, `Téléchargement R2 ${base}`);
    return dest;
  }
  const local = path.join(uploadsDir, base);
  if (!fs.existsSync(local)) {
    throw new Error(`Le fichier "${base}" n'existe pas sur le serveur.`);
  }
  return local;
}

/**
 * Concatène et trim une liste de clips, applique les overlays.
 * Retourne { url } : URL présignée R2 (prod) ou chemin relatif (dev).
 */
// Sélecteur de moteur de rendu : 'remotion' délègue à Cloud Run, sinon
// 'libass' (pipeline ffmpeg/libass local, défaut).
const RENDERER = process.env.RENDERER || 'libass';
const WORKER_URL = process.env.RENDER_WORKER_URL || '';
const WORKER_KEY = process.env.WORKER_KEY || '';
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || '';

// Transforme le payload /concat (globalOverlays array) en props Remotion
// (branding object). Conserve clips + médias.
function buildRemotionPayload(clips, opts) {
  const branding = { logo: !!opts.logo, logoPosition: opts.logoPosition || 'br' };
  if (opts.atmosphere) {
    const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));
    branding.atmosphere = {
      vignette: clamp(opts.atmosphere.vignette),
      grain: clamp(opts.atmosphere.grain),
      sweep: clamp(opts.atmosphere.sweep),
    };
  }
  for (const g of opts.globalOverlays || []) {
    if (g.templateId === 'ticker') {
      branding.ticker = {
        enabled: true,
        categorie: g.fields?.categorie || '',
        texte: g.fields?.texte || '',
        speed: Number(g.fields?.speed) || 3,
      };
    } else if (g.templateId === 'live_badge') {
      branding.live = { enabled: true, label: g.fields?.label || 'LIVE' };
    }
  }
  return {
    clips: clips.map((c) => ({
      filename: c.filename,
      inPoint: c.inPoint,
      outPoint: c.outPoint,
      // Durée du segment (sec) : fournie par le frontend (probe metadata).
      durationSec: c.durationSec != null
        ? c.durationSec
        : (c.outPoint != null ? c.outPoint - (c.inPoint || 0) : (c.duration || 5)),
      overlays: c.overlays || [],
      transition: c.transition,
      kenBurns: c.kenBurns,
      subtitles: c.subtitles,
      subtitleStyle: c.subtitleStyle,
    })),
    branding,
    music: opts.music,
    voiceover: opts.voiceover,
    imageOverlays: opts.imageOverlays || [],
  };
}

// Délègue le rendu au worker Cloud Run. Le worker pilote la progression via
// POST /api/editor/internal/progress (SSE existant). Retourne { delegated }.
async function delegateToRemotion(clips, jobId, opts) {
  if (!WORKER_URL) throw new Error('RENDER_WORKER_URL non configuré.');
  if (!WORKER_KEY) throw new Error('WORKER_KEY non configuré côté backend.');
  if (!PUBLIC_API_URL) throw new Error('PUBLIC_API_URL non configuré (le worker ne saura pas où renvoyer la progression).');

  // Fail-fast : ping /health avant de payer 30 s de timeout sur /render.
  try {
    const h = await withTimeout(fetch(`${WORKER_URL}/health`), 10 * 1000, 'Health worker');
    if (!h.ok) throw new Error(`HTTP ${h.status}`);
  } catch (err) {
    throw new Error(`Worker Cloud Run injoignable (${WORKER_URL}/health) : ${err.message}`);
  }

  const payload = buildRemotionPayload(clips, opts);
  setProgress(jobId, 5, 'downloading');
  const res = await withTimeout(
    fetch(`${WORKER_URL}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Worker-Key': WORKER_KEY },
      body: JSON.stringify({ payload, jobId, returnTo: PUBLIC_API_URL }),
    }),
    30 * 1000,
    'Appel worker Remotion'
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Worker a refusé le rendu (HTTP ${res.status}) : ${body.slice(0, 200)}`);
  }
  logger.info('Rendu délégué au worker Remotion', { jobId, workerUrl: WORKER_URL, callbackUrl: `${PUBLIC_API_URL}/api/editor/internal/progress` });
  return { delegated: true };
}

export async function concatenateVideos(clips, jobId = null, opts = {}) {
  if (!clips || clips.length === 0) {
    throw new Error('Aucune vidéo fournie pour le montage.');
  }

  // Chemin Remotion : délégué à Cloud Run (le worker gère le rendu + SSE).
  if (RENDERER === 'remotion') {
    return delegateToRemotion(clips, jobId, opts);
  }

  if (isRendering) {
    const error = new Error('Le serveur est déjà en train de monter une vidéo, veuillez patienter.');
    error.status = 429;
    throw error;
  }
  isRendering = true;

  // Support legacy API: array of strings → objects.
  const normalizedClips = clips.map((c) =>
    typeof c === 'string' ? { filename: c } : c
  );

  // Répertoire de travail temporaire (toujours disque local — ffmpeg
  // ne lit pas le réseau).
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-editor-'));
  const outputFilename = `export_${uuidv4()}.mp4`;
  const outputPath = path.join(workDir, outputFilename);

  try {
    // Phase 1 (0→20%) : téléchargement/résolution des clips.
    const localPaths = [];
    for (let i = 0; i < normalizedClips.length; i++) {
      localPaths.push(await resolveClipPath(normalizedClips[i].filename, workDir));
      setProgress(jobId, ((i + 1) / normalizedClips.length) * 20, 'downloading');
    }

    // Phase 2 (20→70%) : normalisation des clips.
    const normPaths = await runFfmpeg(normalizedClips, localPaths, outputPath, (pct) => {
      setProgress(jobId, 20 + (pct / 100) * 50, 'encoding');
    });

    // Phase 3 (70→90%) : assemblage + habillage + mix audio en UNE passe.
    const finalPath = await assembleMaster(normPaths, normalizedClips, opts, outputPath, workDir, (pct) => {
      setProgress(jobId, 70 + (pct / 100) * 20, 'encoding');
    });
    setProgress(jobId, 90, 'uploading');

    // Mode R2 : push le rendu sur R2 + URL présignée 24h. Timeout pour ne
    // pas pendre indéfiniment si le réseau R2 décroche (sinon isRendering
    // resterait bloqué).
    if (HAS_R2) {
      const r2Key = `exports/${outputFilename}`;
      logger.info('Upload du master vers R2', { r2Key });
      await withTimeout(uploadToR2(finalPath, r2Key, 'video/mp4'), IO_TIMEOUT_MS, 'Upload R2 du master');
      const url = await withTimeout(getR2PresignedUrl(r2Key, 60 * 60 * 24), 30 * 1000, 'URL présignée R2');
      logger.info('Master uploadé sur R2 avec succès', { r2Key });
      return { url };
    }

    // Mode local (dev) : déplace le rendu dans uploadsDir/exports.
    const exportsDir = path.join(uploadsDir, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    fs.copyFileSync(finalPath, path.join(exportsDir, outputFilename));
    return { url: `/uploads/exports/${outputFilename}` };
  } finally {
    isRendering = false;
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Lance ffmpeg : trim + scale/letterbox + overlays + concat.
 */
async function runFfmpeg(normalizedClips, localPaths, outputPath, onProgress) {
  const workDir = path.dirname(outputPath);
  const normPaths = [];
  
  // Phase 1 : Normalisation séquentielle de chaque clip
  for (let i = 0; i < normalizedClips.length; i++) {
    const { inPoint, outPoint, overlays = [], kenBurns, subtitles, subtitleStyle } = normalizedClips[i];
    const normPath = path.join(workDir, `norm_${i}.mp4`);
    normPaths.push(normPath);

    const isImage = IMAGE_EXT.test(normalizedClips[i].filename || '');
    const kb = parseKenBurns(kenBurns);
    const hasAudio = !isImage && await checkAudio(localPaths[i]);

    const command = ffmpeg(localPaths[i]);
    const trimIn = inPoint != null ? inPoint : 0;
    const trimOut = outPoint != null ? outPoint : 9999999;
    const hasTrim = !isImage && (inPoint != null || outPoint != null);

    // Image fixe → boucle sur une durée donnée pour produire un segment vidéo.
    let imgDur = 0;
    if (isImage) {
      imgDur = outPoint != null ? outPoint : (Number(normalizedClips[i].duration) || KEN_BURNS_IMG_DEFAULT_SEC);
      // -r OUT_FPS sur l'entrée image : sinon le loop tourne à 25 fps par défaut
      // et la durée de sortie (à 30 fps) ne correspond pas.
      command.inputOptions(['-loop 1', `-r ${OUT_FPS}`, `-t ${imgDur}`]);
    }

    // On assemble TOUT en filter_complex (string) : ça évite l'entrée
    // `-f lavfi` que fluent-ffmpeg rejette sous ffmpeg 7 (lavfi = device). Le
    // son muet des clips sans audio est généré par la SOURCE anullsrc.
    const vParts = [];
    if (hasTrim) vParts.push(`trim=${trimIn}:${trimOut}`, 'setpts=PTS-STARTPTS');

    if (kb) {
      // Calibre la vitesse du zoom sur la durée du segment.
      let durSec = imgDur;
      if (!durSec) {
        durSec = (inPoint != null || outPoint != null)
          ? (outPoint != null ? outPoint : await getDuration(localPaths[i])) - (inPoint || 0)
          : await getDuration(localPaths[i]);
      }
      vParts.push(...kenBurnsFilters(kb.mode, durSec));
    } else {
      // 720p par défaut : ~2,2x moins de pixels que le 1080p → encodage bien
      // plus rapide et moins de RAM sur Render free. Les overlays ASS restent
      // en PlayRes 1920x1080 et sont mis à l'échelle par libass.
      vParts.push(
        `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease`,
        `pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2`,
        'setsar=1',
        `fps=${OUT_FPS}`
      );
    }
    vParts.push('format=yuv420p');

    // Sous-titres (relatifs au fichier d'origine) → calés sur le clip trimé :
    // décalés de -trimIn, filtrés hors [trimIn, trimOut].
    let subs = null;
    if (Array.isArray(subtitles) && subtitles.length > 0) {
      const inP = trimIn;
      const outP = outPoint != null ? outPoint : Infinity;
      subs = subtitles
        .filter((s) => s && s.text && s.end > inP && s.start < outP)
        .map((s) => ({ start: Math.max(0, s.start - inP), end: s.end - inP, text: s.text }));
    }

    // Overlays + sous-titres libass dans un seul fichier ASS (un seul filtre).
    if ((overlays && overlays.length > 0) || (subs && subs.length > 0)) {
      try {
        const assPath = generateAssFile(overlays, workDir, {}, subs, subtitleStyle);
        vParts.push(HAS_FONTS
          ? `ass=filename=${assPath}:fontsdir=${FONTS_DIR}`
          : `ass=filename=${assPath}`);
      } catch (err) {
        logger.warn(`Overlays/sous-titres ignorés: ${err.message}`);
      }
    }

    const filters = [`[0:v]${vParts.join(',')}[v]`];
    if (hasAudio) {
      const aParts = [];
      if (hasTrim) aParts.push(`atrim=${trimIn}:${trimOut}`, 'asetpts=PTS-STARTPTS');
      aParts.push('aresample=48000', 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo');
      filters.push(`[0:a]${aParts.join(',')}[a]`);
    } else {
      // Source de silence (filtre lavfi, pas d'entrée -f lavfi).
      filters.push('anullsrc=r=48000:cl=stereo[a]');
    }

    command.complexFilter(filters, ['v', 'a']);

    // veryfast bat ultrafast ici : plus rapide ET ~3x plus petit à
    // -threads 1. ref/rc-lookahead réduits = moins de RAM (Render 512 Mo).
    const outOpts = [
      '-c:v libx264',
      `-preset ${PRESET}`,
      '-crf 23',
      '-pix_fmt yuv420p',
      '-x264-params', 'rc-lookahead=10:ref=2:sliced-threads=0',
      '-g 60',
      '-c:a aac',
      '-b:a 128k',
      '-ar 48000',
      '-movflags +faststart',
      '-threads 1', // Empreinte mémoire minimale par clip
      '-max_muxing_queue_size 1024',
    ];
    if (!hasAudio) outOpts.push('-shortest'); // anullsrc infini → calé sur la vidéo
    command.outputOptions(outOpts);

    // Watchdog branché AVANT save() pour ne manquer aucun event.
    const stepPromise = runFfmpegStep(command, `Normalisation clip ${i + 1}/${normalizedClips.length}`, {
      onStart: (cmd) => logger.info(`Normalisation du clip ${i + 1}/${normalizedClips.length}`, { command: cmd }),
      onProgress: (p) => {
        // On répartit la progression sur 90% (Pass 1)
        const baseProgress = (i / normalizedClips.length) * 90;
        const clipProgress = (Math.max(0, Math.min(100, p.percent || 0)) / 100) * (90 / normalizedClips.length);
        if (typeof onProgress === 'function') {
          onProgress(baseProgress + clipProgress);
        }
      },
    });
    command.save(normPath);
    await stepPromise;
  }

  return normPaths;
}

// Positions de coin pour le logo / les incrustations images.
const OVERLAY_POS = {
  tl: '34:34', tr: 'W-w-34:34', bl: '34:H-h-34',
  br: 'W-w-34:H-h-104', center: '(W-w)/2:(H-h)/2',
};

// Concat demuxer copy (rapide, ~0 RAM) quand aucun ré-encodage n'est requis.
async function assembleConcatCopy(normPaths, outputPath, onProgress) {
  logger.info('Assemblage final avec le concat demuxer (copy)...');
  const workDir = path.dirname(outputPath);
  const listPath = path.join(workDir, 'list.txt');
  const listContent = normPaths.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listContent);
  const cmd = ffmpeg().input(listPath).inputOptions(['-f concat', '-safe 0']).outputOptions(['-c copy']);
  const pr = runFfmpegStep(cmd, 'Concaténation finale', {
    onStart: (c) => logger.info('Démarrage concat rapide', { command: c }),
  });
  cmd.save(outputPath);
  await pr;
  if (typeof onProgress === 'function') onProgress(100);
  logger.info('Concaténation vidéo terminée avec succès');
}

/**
 * Assemble le master en UNE passe (perf) : montage (concat filter ou xfade) +
 * habillage global ASS + logo + incrustations images + mix audio (musique avec
 * ducking, voix-off). Chemin rapide concat-copy conservé quand aucun
 * ré-encodage n'est nécessaire. Écrit dans outputPath, le retourne.
 */
async function assembleMaster(normPaths, normalizedClips, opts, outputPath, workDir, onProgress) {
  const transitions = normalizedClips.slice(0, -1).map((c) => parseTransition(c.transition));
  const wantsTransitions = normPaths.length >= 2 && normPaths.length <= MAX_XFADE_CLIPS && transitions.some(Boolean);
  if (transitions.some(Boolean) && normPaths.length > MAX_XFADE_CLIPS) {
    logger.warn(`Trop de clips (${normPaths.length} > ${MAX_XFADE_CLIPS}) — transitions ignorées.`);
  }

  const globalOverlays = Array.isArray(opts.globalOverlays) ? opts.globalOverlays : [];
  const useLogo = !!opts.logo && HAS_LOGO;
  const music = opts.music && opts.music.filename ? opts.music : null;
  const voiceover = opts.voiceover && opts.voiceover.filename ? opts.voiceover : null;
  const imageOverlays = (Array.isArray(opts.imageOverlays) ? opts.imageOverlays : [])
    .filter((o) => o && o.filename).slice(0, 6);
  const needsFinalize = globalOverlays.length > 0 || useLogo || music || voiceover || imageOverlays.length > 0;

  // Chemin rapide : ni transition ni incrustation → concat demuxer copy.
  if (!wantsTransitions && !needsFinalize) {
    await assembleConcatCopy(normPaths, outputPath, onProgress);
    return outputPath;
  }

  const durations = [];
  for (const p of normPaths) durations.push(await getDuration(p));
  const n = normPaths.length;

  const cmd = ffmpeg();
  normPaths.forEach((p) => cmd.input(p)); // inputs 0..n-1
  let nextInput = n;
  const filters = [];

  // 1) Assemblage vidéo + audio.
  let vlabel; let alabel; let masterDur;
  if (wantsTransitions) {
    let lastV = '0:v'; let lastA = '0:a'; let accLen = durations[0];
    for (let i = 1; i < n; i++) {
      const t = transitions[i - 1] || { type: 'fade', duration: 0.5 };
      const off = Math.max(0.1, accLen - t.duration).toFixed(3);
      const vO = `vx${i}`; const aO = `ax${i}`;
      filters.push(`[${lastV}][${i}:v]xfade=transition=${t.type}:duration=${t.duration}:offset=${off}[${vO}]`);
      filters.push(`[${lastA}][${i}:a]acrossfade=d=${t.duration}[${aO}]`);
      lastV = vO; lastA = aO;
      accLen = accLen + durations[i] - t.duration;
    }
    vlabel = lastV; alabel = lastA; masterDur = accLen;
  } else if (n > 1) {
    const ins = Array.from({ length: n }, (_, i) => `[${i}:v][${i}:a]`).join('');
    filters.push(`${ins}concat=n=${n}:v=1:a=1[vcat][acat]`);
    vlabel = 'vcat'; alabel = 'acat';
    masterDur = durations.reduce((s, d) => s + d, 0);
  } else {
    vlabel = '0:v'; alabel = '0:a'; masterDur = durations[0] || 0;
  }

  // 2) Habillage global ASS (ticker / LIVE) sur toute la durée.
  if (globalOverlays.length > 0) {
    const mapped = globalOverlays.map((o) => ({ ...o, startTime: 0, duration: masterDur }));
    const assPath = generateAssFile(mapped, workDir, { durSec: masterDur });
    filters.push(`[${vlabel}]ass=filename=${assPath}${HAS_FONTS ? `:fontsdir=${FONTS_DIR}` : ''}[vass]`);
    vlabel = 'vass';
  }

  // 3) Logo + incrustations images (overlay, opacité + timing).
  const imgs = [];
  if (useLogo) {
    cmd.input(LOGO_PATH);
    // Position du logo réglable ; si ticker actif et position basse → surélevé.
    const tickerOn = globalOverlays.some((o) => o.templateId === 'ticker');
    const bottomY = tickerOn ? 'H-h-104' : 'H-h-34';
    const LOGO_POS = {
      tl: '34:34', tr: 'W-w-34:34', center: '(W-w)/2:(H-h)/2',
      bl: `34:${bottomY}`, br: `W-w-34:${bottomY}`,
    };
    const logoPos = LOGO_POS[opts.logoPosition] || LOGO_POS.br;
    imgs.push({ idx: nextInput++, scaleH: 64, pos: logoPos, start: 0, dur: masterDur, opacity: 1 });
  }
  for (const ov of imageOverlays) {
    cmd.input(await resolveClipPath(ov.filename, workDir));
    const scale = Math.min(1, Math.max(0.05, Number(ov.scale) || 0.25));
    const pos = (ov.position && typeof ov.position === 'object')
      ? `${Math.round(Number(ov.position.x) || 0)}:${Math.round(Number(ov.position.y) || 0)}`
      : (OVERLAY_POS[ov.position] || OVERLAY_POS.tr);
    imgs.push({
      idx: nextInput++, scaleW: Math.round(scale * OUT_W), pos,
      start: Number(ov.startTime) || 0,
      dur: ov.duration != null ? Number(ov.duration) : masterDur,
      opacity: ov.opacity != null ? Math.min(1, Math.max(0, Number(ov.opacity))) : 1,
    });
  }
  for (const im of imgs) {
    const sz = im.scaleH ? `-1:${im.scaleH}` : `${im.scaleW}:-1`;
    const op = im.opacity < 1 ? `,format=rgba,colorchannelmixer=aa=${im.opacity}` : '';
    const lbl = `ov${im.idx}`;
    filters.push(`[${im.idx}:v]scale=${sz}${op}[${lbl}]`);
    const start = im.start.toFixed(2);
    const end = (im.start + im.dur).toFixed(2);
    const outL = `vo${im.idx}`;
    filters.push(`[${vlabel}][${lbl}]overlay=${im.pos}:enable='between(t,${start},${end})'[${outL}]`);
    vlabel = outL;
  }

  // 4) Mix audio : musique (ducking) + voix-off.
  const AFMT = 'aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
  const extraMix = [];
  let baseAudio = alabel;
  if (music) {
    const midx = nextInput++;
    cmd.input(await resolveClipPath(music.filename, workDir));
    cmd.inputOptions(['-stream_loop', '-1']); // boucle la musique (entrée précédente)
    const mvol = music.volume != null ? Math.min(1, Math.max(0, Number(music.volume))) : 0.2;
    const fIn = Number(music.fadeIn) || 0;
    const fOut = Number(music.fadeOut) || 0;
    let mchain = `[${midx}:a]volume=${mvol},${AFMT}`;
    if (fIn) mchain += `,afade=t=in:st=0:d=${fIn}`;
    if (fOut) mchain += `,afade=t=out:st=${Math.max(0, masterDur - fOut).toFixed(2)}:d=${fOut}`;
    filters.push(`${mchain}[mraw]`);
    if (music.duck) {
      filters.push(`[${baseAudio}]asplit=2[amain][aside]`);
      filters.push(`[mraw][aside]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[mduck]`);
      baseAudio = 'amain';
      extraMix.push('mduck');
    } else {
      extraMix.push('mraw');
    }
  }
  if (voiceover) {
    const vidx = nextInput++;
    cmd.input(await resolveClipPath(voiceover.filename, workDir));
    const vvol = voiceover.volume != null ? Math.min(2, Math.max(0, Number(voiceover.volume))) : 1;
    const delayMs = Math.round((Number(voiceover.startTime) || 0) * 1000);
    filters.push(`[${vidx}:a]adelay=${delayMs}|${delayMs},volume=${vvol},${AFMT}[vo]`);
    extraMix.push('vo');
  }
  if (extraMix.length > 0) {
    const ins = [baseAudio, ...extraMix].map((l) => `[${l}]`).join('');
    filters.push(`${ins}amix=inputs=${extraMix.length + 1}:duration=first:normalize=0[aout]`);
    alabel = 'aout';
  } else {
    alabel = baseAudio;
  }

  // complexFilter mappe les labels en pads ([x]) ; un flux d'entrée brut
  // (ex: '0:a' quand 1 clip sans mix) deviendrait `-map [0:a]` → invalide.
  // On force un pad via passthrough.
  if (/^\d+:v$/.test(vlabel)) { filters.push(`[${vlabel}]null[voutp]`); vlabel = 'voutp'; }
  if (/^\d+:a$/.test(alabel)) { filters.push(`[${alabel}]anull[aoutp]`); alabel = 'aoutp'; }

  logger.info('Assemblage master (passe unique)', {
    context: { clips: n, transitions: wantsTransitions, globals: globalOverlays.length, images: imgs.length, music: !!music, voiceover: !!voiceover },
  });
  cmd.complexFilter(filters, [vlabel, alabel]);
  cmd.outputOptions([
    '-c:v', 'libx264', '-preset', PRESET, '-crf', '23', '-pix_fmt', 'yuv420p',
    '-x264-params', 'rc-lookahead=10:ref=2:sliced-threads=0', '-g', '60',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
    '-movflags', '+faststart', '-threads', String(THREADS), '-max_muxing_queue_size', '1024',
  ]);
  const pr = runFfmpegStep(cmd, 'Assemblage master', {
    onStart: (c) => logger.info('Démarrage assemblage master', { command: c }),
    onProgress: (p) => { if (typeof onProgress === 'function') onProgress(Math.max(0, Math.min(100, p.percent || 0))); },
  });
  cmd.save(outputPath);
  await pr;
  if (typeof onProgress === 'function') onProgress(100);
  logger.info('Assemblage master terminé avec succès');
  return outputPath;
}
