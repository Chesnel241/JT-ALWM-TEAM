import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { selectComposition, renderMedia, ensureBrowser } from '@remotion/renderer';
import { HAS_R2, presignRead, uploadFile } from './r2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVE_URL = process.env.REMOTION_SERVE_URL || path.join(__dirname, '../../remotion/build');
const WORKER_KEY = process.env.WORKER_KEY || '';
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json({ limit: '2mb' }));

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

async function postProgress(returnTo, jobId, percent) {
  return callback(returnTo, jobId, { jobId, percent: Math.round(percent), status: 'encoding' }, 'progress');
}

app.post('/render', async (req, res) => {
  if (WORKER_KEY && req.header('x-worker-key') !== WORKER_KEY) {
    console.warn('[/render] 403 forbidden — X-Worker-Key invalide');
    return res.status(403).json({ error: 'forbidden' });
  }
  const { payload, jobId, returnTo } = req.body || {};
  if (!payload || !Array.isArray(payload.clips) || payload.clips.length === 0) {
    return res.status(400).json({ error: 'payload.clips requis' });
  }
  console.log('[/render] accepté', { jobId, clips: payload.clips.length, returnTo });

  // Réponse immédiate : rendu en arrière-plan (évite timeout HTTP).
  res.status(202).json({ accepted: true });

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-remotion-'));
  const outName = `export_${uuidv4()}.mp4`;
  const outPath = path.join(workDir, outName);
  try {
    await ensureBrowser();
    const inputProps = HAS_R2 ? await resolveUrls(payload) : payload;
    const sharedChromiumOptions = { 
      gl: 'angle',
      enableMultiProcessOnLinux: false,
      disableWebSecurity: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    const composition = await selectComposition({
      serveUrl: SERVE_URL,
      id: 'JTMaster',
      inputProps,
      chromiumOptions: sharedChromiumOptions,
    });
    await renderMedia({
      composition,
      serveUrl: SERVE_URL,
      codec: 'h264',
      outputLocation: outPath,
      inputProps,
      concurrency: 1,
      chromiumOptions: sharedChromiumOptions,
      onProgress: ({ progress }) => postProgress(returnTo, jobId, progress * 100),
    });

    let url = `file://${outPath}`;
    if (HAS_R2) {
      const r2Key = `exports/${outName}`;
      await uploadFile(outPath, r2Key, 'video/mp4');
      url = await presignRead(r2Key, 60 * 60 * 24);
    } else {
      // Local fallback: écrire dans /app/uploads/files/exports pour que
      // express.static (qui sert depuis /app/uploads/files) puisse le trouver.
      const exportsDir = path.join('/app/uploads/files', 'exports');
      fs.mkdirSync(exportsDir, { recursive: true });
      fs.copyFileSync(outPath, path.join(exportsDir, outName));
      url = `/uploads/exports/${outName}`;
    }
    await callback(returnTo, jobId, { jobId, percent: 100, status: 'done', url }, 'done');
  } catch (err) {
    console.error('Render failed', err);
    await callback(returnTo, jobId, { jobId, status: 'error', error: err.message }, 'error');
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

app.listen(PORT, () => console.log(`Render worker on :${PORT} (serveUrl=${SERVE_URL})`));
