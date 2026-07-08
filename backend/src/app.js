import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { join, resolve, normalize, basename } from 'path';
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
import themesRouter from './routes/themes.js';
import authRouter from './routes/auth.js';
import editorRouter from './routes/editor.js';
import delaysRouter from './routes/delays.js';
import webpushRouter from './routes/webpush.js';
import healthRouter, { metricsRouter } from './routes/health.js';
import { requireAuth, requireAdmin, safeEqual } from './middleware/auth.js';
import logger from './logger/index.js';

import { sanitizerMiddleware } from './middleware/sanitizer.js';
import { globalLimiter, uploadLimiter, archiveLimiter } from './middleware/rateLimiter.js';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/errorHandler.js';
import { Server } from 'socket.io';
import { createHash, timingSafeEqual } from 'crypto';

export let io;

function normalizeWsToken(s) {
  if (typeof s !== 'string') return '';
  return s.normalize('NFC').replace(/[\u0009\u00A0\u1680\u2000-\u200D\u202F\u205F\u2060\u3000\uFEFF]/g, '').trim().toLowerCase();
}

function safeEqualToken(a, b) {
  if (a == null || b == null) return false;
  const ha = createHash('sha256').update(normalizeWsToken(a)).digest();
  const hb = createHash('sha256').update(normalizeWsToken(b)).digest();
  return timingSafeEqual(ha, hb);
}

export function initSocket(server) {
  const allow = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const corsOpts = allow.length === 0 || allow.includes('*')
    ? { origin: true, credentials: false }
    : { origin: allow, credentials: false };

  io = new Server(server, {
    cors: corsOpts,
    transports: ['websocket'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth && socket.handshake.auth.token) || socket.handshake.headers['x-app-password'];
    const GLOBAL = process.env.GLOBAL_PASSWORD;
    const ADMIN = process.env.ADMIN_PASSWORD;
    if (!GLOBAL) return next();
    if (!token) return next(new Error('unauthorized'));
    if (safeEqualToken(token, GLOBAL) || (ADMIN && safeEqualToken(token, ADMIN))) {
      return next();
    }
    return next(new Error('unauthorized'));
  });
}

// 2 h : un upload delivery de 20 Go en connexion moyenne (50 Mbps) prend
// ~55 min — l'ancien défaut de 10 min coupait la requête en plein transfert.
const UPLOAD_TIMEOUT_MS = parseInt(process.env.UPLOAD_TIMEOUT_MS || 2 * 60 * 60 * 1000, 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || 30000, 10);

const RESULT_URL_HOSTS = (process.env.RESULT_URL_HOSTS || '')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

function isAllowedResultUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (url.startsWith('/uploads/')) return true;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
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

// NB: le handler `unhandledRejection` vit dans src/index.js (point d'entrée
// serveur) et se contente de LOGGER. On n'enregistre PLUS ici un second
// handler qui appelait process.exit(1) : Node exécute TOUS les handlers
// d'un même event, donc ce process.exit(1) tuait le serveur (et tous les
// uploads/rendus/SSE en cours) à la moindre promesse non gérée, écrasant le
// comportement gracieux voulu côté index.js. Les routes sont déjà protégées
// individuellement (asyncHandler + errorHandlerMiddleware).

export function createApp({ uploadsDir, corsOrigins, enableMonitoring = true } = {}) {
  const dir = uploadsDir || join(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });

  const app = express();

  app.set('trust proxy', process.env.TRUST_PROXY || 1);

  if (enableMonitoring) {
    initSentry(app);
    initMetrics(app);
  }

  // Compression : exclure /uploads (les vidéos sont déjà compressées, gzip
  // ajoute uniquement de la latence et brûle du CPU sur des MP4/MP3 de
  // plusieurs Mo). On garde compression pour les réponses JSON.
  app.use(compression({
    filter: (req, res) => {
      if (req.path.startsWith('/uploads')) return false;
      return compression.filter(req, res);
    },
  }));

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));

  app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range, x-admin-password');
    res.header('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(cors({ 
    origin: corsOrigins, 
    credentials: true,
    exposedHeaders: ['Tus-Resumable', 'Upload-Length', 'Upload-Metadata', 'Location', 'Upload-Offset', 'Upload-Concat', 'Content-Type', 'Upload-Defer-Length'],
    allowedHeaders: ['Tus-Resumable', 'Upload-Length', 'Upload-Metadata', 'Location', 'Upload-Offset', 'Content-Type', 'Upload-Concat', 'Authorization', 'x-admin-password', 'x-worker-key']
  }));
  app.use(globalLimiter);
  app.use((req, res, next) => {
    // Ne pas appliquer le timeout global de 30s aux envois TUS pour les grosses vidéos
    if (req.path.startsWith('/api/tus')) {
      return next();
    }
    return timeoutMiddleware(REQUEST_TIMEOUT_MS)(req, res, next);
  });

  // Mount TUS server before body parsers. uploadLimiter appliqué AVANT le
  // handler TUS pour fermer le bypass : sans ça, /api/uploads était limité à
  // 10/h mais /api/tus acceptait des uploads illimités.
  app.all('/api/tus/*', uploadLimiter, (req, res, next) => {
    import('./routes/tus.js').then(({ tusServer }) => {
      tusServer.handle(req, res);
    }).catch(next);
  });

  // 2 Mo : le payload /concat d'un montage de 30 min (30+ clips, sous-titres
  // auto par clip, overlays) dépasse facilement 100 ko — l'ancienne limite
  // faisait un 413 silencieux sur les gros montages. 2 Mo reste une borne
  // saine contre les abus (les fichiers passent par multer/TUS, pas ici).
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));
  app.use(cookieParser());
  app.use(sanitizerMiddleware);

  app.get('/uploads/*', async (req, res, next) => {
    try {
      const filename = req.params[0];
      const metadata = (await import('./data/store.js')).getFileMetadata(filename);
      if (metadata && metadata.countryId === 'mj') {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : undefined;
        // Accepte uniquement l'en-tête X-Admin-Password OU un dl_token signé.
        // Avant : le mot de passe admin pouvait être passé en ?adminPassword=...
        // et se retrouvait loggé en clair (errorHandler logge req.originalUrl,
        // historique navigateur, proxy intermédiaires). Le frontend doit
        // désormais demander un dl_token via POST /api/uploads/download-token
        // (HMAC, 1 h, lié au filename).
        let providedToken = req.header('x-admin-password');
        let dlToken = req.query.dl_token;

        let isValidToken = false;
        if (ADMIN_PASSWORD) {
          if (typeof providedToken === 'string' && safeEqual(providedToken.trim(), ADMIN_PASSWORD)) {
            isValidToken = true;
          } else if (typeof dlToken === 'string') {
            const { verifyDownloadToken } = await import('./lib/downloadTokens.js');
            if (verifyDownloadToken(dlToken, filename)) {
              isValidToken = true;
            }
          }
        } else {
          isValidToken = true;
        }

        if (!isValidToken && ADMIN_PASSWORD) {
          return res.status(403).send('Accès protégé : authentification requise pour cette rubrique.');
        }
      }

      if (req.query.dl === '1') {
        const safePath = normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = join(dir, safePath);
        if (fullPath.startsWith(resolve(dir))) {
          return res.download(fullPath, metadata?.name || basename(safePath));
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  });

  // Servi en static. nosniff + attachment force pour les types non-média :
  // un upload .txt/.docx/.zip pourrait sinon être chargé inline et son
  // contenu sniffé en HTML/SVG → stored XSS. On garde inline pour audio/
  // vidéo/image (lecture du master + chutiers).
  const INLINE_EXT = /\.(mp4|mov|webm|mkv|mp3|wav|m4a|ogg|jpg|jpeg|png|webp|gif|bmp|heic|svg)$/i;
  app.use('/uploads', express.static(dir, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, p) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!INLINE_EXT.test(p)) {
        // Force le téléchargement plutôt que l'affichage inline.
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  }));

  app.get('/', (req, res) => res.status(200).send('ALWM Backend API is running.'));

  app.use('/health', healthRouter);
  app.use('/metrics', requireAdmin, metricsRouter);
  app.use('/api/auth', authRouter);

  app.post('/api/editor/internal/progress', async (req, res, next) => {
    try {
      const WORKER_KEY = process.env.WORKER_KEY || '';
      const provided = req.header('x-worker-key');
      if (!WORKER_KEY) {
        logger.warn('[internal/progress] 403 — WORKER_KEY non configuré côté backend');
        return res.status(403).json({ error: 'forbidden' });
      }
      if (!safeEqual(provided, WORKER_KEY)) {
        logger.warn('[internal/progress] 403 — X-Worker-Key invalide', { ip: req.ip });
        return res.status(403).json({ error: 'forbidden' });
      }
      const { jobId, percent, status, url } = req.body || {};
      if (!jobId || typeof jobId !== 'string') return res.status(400).json({ error: 'jobId requis' });
      logger.info('[internal/progress] callback reçu', { jobId, percent, status, hasUrl: !!url });
      const { setProgress, finishJob } = await import('./services/editorProgress.js');
      if (status === 'done') {
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
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', requireAuth);
  app.use('/api/countries', countriesRouter);
  app.use('/api/weeks', weeksRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/themes', themesRouter);
  app.use('/api/uploads', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), uploadsRouter);
  app.use('/api/deliveries', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), deliveriesRouter);
  // Le flux SSE de progression (/api/editor/progress/:jobId) reste ouvert
  // toute la durée d'un rendu (jusqu'à 1 h+) : on NE lui applique PAS le
  // timeout requête, sinon req.destroy() coupe le flux en plein encodage
  // (EventSource reconnecte, mais ça spamme et perd des events).
  app.use('/api/editor', uploadLimiter, (req, res, next) => {
    if (req.path.startsWith('/progress/')) return next();
    return timeoutMiddleware(UPLOAD_TIMEOUT_MS)(req, res, next);
  }, editorRouter);
  app.use('/api/delays', globalLimiter, timeoutMiddleware(REQUEST_TIMEOUT_MS), delaysRouter);
  app.use('/api/webpush', webpushRouter);
  
  app.use(notFoundMiddleware);
  if (enableMonitoring) {
    app.use(getSentryErrorHandler());
  }
  app.use(errorHandlerMiddleware);

  return app;
}
