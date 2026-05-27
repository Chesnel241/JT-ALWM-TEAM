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
const XFADE_TRANSITIONS = new Set([
  'fade', 'fadeblack', 'wipeleft', 'wiperight', 'slideleft', 'slideright',
  'dissolve', 'circleopen', 'circleclose', 'pixelize',
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

/**
 * Résout le chemin local d'un clip. En mode R2, télécharge le fichier
 * dans workDir et retourne ce chemin temporaire. Sinon, retourne le
 * chemin local sous uploadsDir.
 */
async function resolveClipPath(filename, workDir) {
  if (HAS_R2) {
    const dest = path.join(workDir, filename);
    await downloadFromR2(`uploads/${filename}`, dest);
    return dest;
  }
  const local = path.join(uploadsDir, filename);
  if (!fs.existsSync(local)) {
    throw new Error(`Le fichier "${filename}" n'existe pas sur le serveur.`);
  }
  return local;
}

/**
 * Concatène et trim une liste de clips, applique les overlays.
 * Retourne { url } : URL présignée R2 (prod) ou chemin relatif (dev).
 */
export async function concatenateVideos(clips, jobId = null) {
  if (!clips || clips.length === 0) {
    throw new Error('Aucune vidéo fournie pour le montage.');
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

    // Phase 2 (20→90%) : encodage ffmpeg.
    await runFfmpeg(normalizedClips, localPaths, outputPath, (pct) => {
      setProgress(jobId, 20 + (pct / 100) * 70, 'encoding');
    });
    setProgress(jobId, 90, 'uploading');

    // Mode R2 : push le rendu sur R2 + URL présignée 24h. Timeout pour ne
    // pas pendre indéfiniment si le réseau R2 décroche (sinon isRendering
    // resterait bloqué).
    if (HAS_R2) {
      const r2Key = `exports/${outputFilename}`;
      logger.info('Upload du master vers R2', { r2Key });
      await withTimeout(uploadToR2(outputPath, r2Key, 'video/mp4'), IO_TIMEOUT_MS, 'Upload R2 du master');
      const url = await withTimeout(getR2PresignedUrl(r2Key, 60 * 60 * 24), 30 * 1000, 'URL présignée R2');
      logger.info('Master uploadé sur R2 avec succès', { r2Key });
      return { url };
    }

    // Mode local (dev) : déplace le rendu dans uploadsDir/exports.
    const exportsDir = path.join(uploadsDir, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    fs.copyFileSync(outputPath, path.join(exportsDir, outputFilename));
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
    const { inPoint, outPoint, overlays = [], kenBurns } = normalizedClips[i];
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

    // Overlays libass. Chemins sans espaces/`:` côté serveur → insertion directe.
    if (overlays && overlays.length > 0) {
      try {
        const assPath = generateAssFile(overlays, workDir);
        vParts.push(HAS_FONTS
          ? `ass=filename=${assPath}:fontsdir=${FONTS_DIR}`
          : `ass=filename=${assPath}`);
      } catch (err) {
        logger.warn(`Overlays skipped: ${err.message}`);
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

  // Phase 2 : assemblage. Transitions xfade si demandées (et nombre de clips
  // raisonnable), sinon concat demuxer rapide (0 ré-encodage).
  const transitions = normalizedClips.slice(0, -1).map((c) => parseTransition(c.transition));
  const wantsTransitions = transitions.some(Boolean);
  const useXfade = normPaths.length >= 2 && normPaths.length <= MAX_XFADE_CLIPS && wantsTransitions;

  if (useXfade) {
    await assembleWithTransitions(normPaths, transitions, outputPath, onProgress);
  } else {
    if (wantsTransitions && normPaths.length > MAX_XFADE_CLIPS) {
      logger.warn(`Trop de clips (${normPaths.length} > ${MAX_XFADE_CLIPS}) — transitions ignorées, concat simple.`);
    }
    await assembleWithConcat(normPaths, outputPath, onProgress);
  }
}

// Assemblage rapide par concat demuxer : copie de flux, ~0 RAM. Tous les
// norm_i sont déjà uniformes (720p/30/aac) donc la copie est sûre.
async function assembleWithConcat(normPaths, outputPath, onProgress) {
  logger.info('Assemblage final avec le concat demuxer...');
  const workDir = path.dirname(outputPath);
  const listPath = path.join(workDir, 'list.txt');
  const listContent = normPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listContent);

  const concatCmd = ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy']);

  const concatPromise = runFfmpegStep(concatCmd, 'Concaténation finale', {
    onStart: (cmd) => logger.info('Démarrage concat rapide', { command: cmd }),
  });
  concatCmd.save(outputPath);
  await concatPromise;
  if (typeof onProgress === 'function') onProgress(100);
  logger.info('Concaténation vidéo terminée avec succès');
}

// Assemblage avec transitions xfade (vidéo) + acrossfade (audio) en une passe
// filter_complex. Offset cumulatif standard : offset_k = Σdurées − Σtransitions.
async function assembleWithTransitions(normPaths, transitions, outputPath, onProgress) {
  const durations = [];
  for (const p of normPaths) durations.push(await getDuration(p));

  const cmd = ffmpeg();
  normPaths.forEach((p) => cmd.input(p));

  const vf = [];
  const af = [];
  let lastV = '0:v';
  let lastA = '0:a';
  let accLen = durations[0];
  for (let i = 1; i < normPaths.length; i++) {
    const t = transitions[i - 1] || { type: 'fade', duration: 0.5 };
    const off = Math.max(0.1, accLen - t.duration).toFixed(3);
    const last = i === normPaths.length - 1;
    const vOut = last ? 'vout' : `vx${i}`;
    const aOut = last ? 'aout' : `ax${i}`;
    vf.push(`[${lastV}][${i}:v]xfade=transition=${t.type}:duration=${t.duration}:offset=${off}[${vOut}]`);
    af.push(`[${lastA}][${i}:a]acrossfade=d=${t.duration}[${aOut}]`);
    lastV = vOut;
    lastA = aOut;
    accLen = accLen + durations[i] - t.duration;
  }

  logger.info('Assemblage avec transitions xfade...', { context: { clips: normPaths.length } });
  cmd.complexFilter([...vf, ...af], [lastV, lastA]);
  cmd.outputOptions([
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
    '-threads 1',
    '-max_muxing_queue_size 1024',
  ]);

  const pr = runFfmpegStep(cmd, 'Assemblage transitions', {
    onStart: (c) => logger.info('Démarrage xfade', { command: c }),
    onProgress: (p) => {
      if (typeof onProgress === 'function') onProgress(Math.max(0, Math.min(100, p.percent || 0)));
    },
  });
  cmd.save(outputPath);
  await pr;
  if (typeof onProgress === 'function') onProgress(100);
  logger.info('Assemblage transitions terminé avec succès');
}
