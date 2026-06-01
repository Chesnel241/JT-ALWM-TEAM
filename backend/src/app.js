import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { initSentry, getSentryErrorHandler } from './monitoring/sentry.js';
import { initMetrics } from './monitoring/metrics.js';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import countriesRouter from './routes/countries.js';
import weeksRouter from './routes/weeks.js';
import uploadsRouter from './routes/uploads.js';
import deliveriesRouter from './routes/deliveries.js';
import notificationsRouter from './routes/notifications.js';
import analyticsRouter from './routes/analytics.js';
import authRouter from './routes/auth.js';
import editorRouter from './routes/editor.js';
import webpushRouter from './routes/webpush.js';
import presignedRouter from './routes/presigned.js';
import healthRouter, { metricsRouter } from './routes/health.js';
import { HAS_R2, getR2PresignedUrl, checkR2Exists } from './lib/s3.js';
import { requireAuth, requireAdmin, safeEqual } from './middleware/auth.js';
import logger from './logger/index.js';

import { sanitizerMiddleware } from './middleware/sanitizer.js';
import { globalLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/errorHandler.js';
import { Server } from 'socket.io';

export let io;

export function initSocket(server) {
  io = new Server(server, { cors: { origin: '*' } });
}

// Timeout par requête (en ms). Upload de gros fichiers : 10 min.
// Reste : 30 s. Au-delà, on coupe pour éviter les Slowloris.
const UPLOAD_TIMEOUT_MS = parseInt(process.env.UPLOAD_TIMEOUT_MS || 600000, 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || 30000, 10);

// Allowlist des origines acceptées pour l'URL du master final renvoyée par le
// worker Remotion. Par défaut : R2 Cloudflare + chemins relatifs /uploads/*.
// Surchargeable via RESULT_URL_HOSTS (hôtes séparés par des virgules, ex. un
// CDN custom). Empêche l'injection d'une URL arbitraire dans le lecteur vidéo
// si la WORKER_KEY venait à fuiter.
const RESULT_URL_HOSTS = (process.env.RESULT_URL_HOSTS || '')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

function isAllowedResultUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  // Chemin relatif servi par le backend lui-même (mode local sans R2).
  if (url.startsWith('/uploads/')) return true;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host.endsWith('.r2.cloudflarestorage.com')) return true;
  if (host.endsWith('.r2.dev')) return true;
  return RESULT_URL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

function timeoutMiddleware(ms) {
  return (req, res, next) => {
    req.setTimeout(ms, () => {
      if (!res.headersSent) {
        res.status(408).json({
          code: 'REQUEST_TIMEOUT',
          message: `Délai dépassé (${Math.round(ms / 1000)}s)`,
        });
      }
      req.destroy();
    });
    next();
  };
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export function createApp({ uploadsDir, corsOrigins, enableMonitoring = true } = {}) {
  const dir = uploadsDir || join(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });

  const app = express();

  // Render (et la plupart des PaaS) placent un load balancer devant l'app.
  // Configuration propre du trust proxy via variable d'environnement (par défaut on truste les subnets locaux/Cloudflare ou le premier hop)
  app.set('trust proxy', process.env.TRUST_PROXY || 1);

  if (enableMonitoring) {
    initSentry(app);
    initMetrics(app);
  }

  app.use(compression());

  // Helmet : en-têtes de sécurité HTTP (X-Frame-Options, X-Content-Type,
  // Referrer-Policy, etc.). CSP désactivée car le backend ne sert pas
  // de HTML (le frontend Vercel applique sa propre CSP via vercel.json).
  // crossOriginResourcePolicy: 'cross-origin' pour autoriser le front
  // Vercel à télécharger les fichiers via <img>/<a href>.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));

  // credentials:true requis pour que le navigateur envoie/reçoive le
  // cookie d'auth (sameSite=none impose credentials).
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(globalLimiter);
  app.use(timeoutMiddleware(REQUEST_TIMEOUT_MS));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizerMiddleware);

  // Redirection vers Cloudflare R2 pour lire les vidéos, avec sécurisation MOT DU JT
  app.get('/uploads/*', async (req, res, next) => {
    const filename = req.params[0];
    // Vérification de sécurité pour le pays "mj" (MOT DU JT)
    const metadata = (await import('./data/store.js')).getFileMetadata(filename);
    if (metadata && metadata.countryId === 'mj') {
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : undefined;
      let providedToken = req.query.adminPassword || req.header('x-admin-password');
      providedToken = typeof providedToken === 'string' ? providedToken.trim() : providedToken;
      if (ADMIN_PASSWORD && !safeEqual(providedToken, ADMIN_PASSWORD)) {
        return res.status(403).send('Accès protégé : mot de passe administrateur requis pour cette rubrique.');
      }
    }

    if (HAS_R2) {
      try {
        const exists = await checkR2Exists(`uploads/${filename}`);
        if (!exists) {
          return next(); // Passe au static local s'il n'est pas sur R2 ou 404
        }
        if (req.query.proxy === 'true') {
          const { getR2ReadStream } = await import('./lib/s3.js');
          const stream = await getR2ReadStream(`uploads/${filename}`);
          return stream.pipe(res);
        }
        const url = await getR2PresignedUrl(`uploads/${filename}`);
        return res.redirect(302, url);
      } catch (err) {
        const logger = (await import('./logger/index.js')).default;
        logger.error(`Error in R2 get/proxy for ${filename}:`, err);
        // Ignorer l'erreur et laisser express.static chercher localement
      }
    }
    next();
  });

  app.use('/uploads', express.static(dir, { 
    maxAge: '1y', 
    immutable: true,
    setHeaders: (res, path, stat) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      res.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
    }
  }));

  app.get('/', (req, res) => res.status(200).send('ALWM Backend API is running.'));

  app.use('/health', healthRouter);
  // /metrics expose des infos internes (mémoire, compteurs d'erreurs, dernier
  // message d'erreur). Protégé par le mot de passe admin (header) — plus
  // public.
  app.use('/metrics', requireAdmin, metricsRouter);

  // Routes auth (login/logout/check) AVANT requireAuth : on doit
  // pouvoir s'authentifier sans être déjà authentifié.
  app.use('/api/auth', authRouter);

  // Callback du worker de rendu Remotion (Cloud Run) — AVANT requireAuth :
  // le worker s'authentifie par WORKER_KEY, pas par session utilisateur.
  app.post('/api/editor/internal/progress', async (req, res) => {
    const WORKER_KEY = process.env.WORKER_KEY || '';
    const provided = req.header('x-worker-key');
    if (!WORKER_KEY) {
      logger.warn('[internal/progress] 403 — WORKER_KEY non configuré côté backend');
      return res.status(403).json({ error: 'forbidden' });
    }
    // Comparaison à temps constant ; aucune fuite de longueur de clé dans la
    // réponse ni dans les logs (un attaquant lisant les logs ne doit rien
    // apprendre sur le secret).
    if (!safeEqual(provided, WORKER_KEY)) {
      logger.warn('[internal/progress] 403 — X-Worker-Key invalide', { ip: req.ip });
      return res.status(403).json({ error: 'forbidden' });
    }
    const { jobId, percent, status, url } = req.body || {};
    if (!jobId || typeof jobId !== 'string') return res.status(400).json({ error: 'jobId requis' });
    logger.info('[internal/progress] callback reçu', { jobId, percent, status, hasUrl: !!url });
    const { setProgress, finishJob } = await import('./services/editorProgress.js');
    if (status === 'done') {
      // Le worker contrôle le `url` final servi à l'opérateur (<video src>,
      // <a href download>). On n'accepte QUE des URLs vers nos propres
      // origines (R2 / CDN) ou un chemin relatif /uploads/* (mode local) :
      // empêche l'injection d'une URL arbitraire si la WORKER_KEY fuite.
      if (!isAllowedResultUrl(url)) {
        logger.warn('[internal/progress] URL de résultat rejetée (origine non autorisée)', { jobId });
        finishJob(jobId, 'error');
        return res.status(400).json({ error: 'url non autorisée' });
      }
      finishJob(jobId, 'done', url);
    } else if (status === 'error') {
      finishJob(jobId, 'error');
    } else {
      setProgress(jobId, percent ?? 0, status || 'encoding');
    }
    return res.json({ ok: true });
  });

  // Toutes les autres routes /api/* exigent un cookie de session valide.
  app.use('/api', requireAuth);

  app.use('/api/countries', countriesRouter);
  app.use('/api/weeks', weeksRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/uploads', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), uploadsRouter);
  app.use('/api/deliveries', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), deliveriesRouter);
  app.use('/api/editor', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), editorRouter);
  app.use('/api/webpush', webpushRouter);
  app.use('/api/presigned', presignedRouter);

  app.use(notFoundMiddleware);
  if (enableMonitoring) {
    app.use(getSentryErrorHandler());
  }
  app.use(errorHandlerMiddleware);

  return app;
}
