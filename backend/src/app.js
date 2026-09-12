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
import sujetsRouter from './routes/sujets.js';
import liensRouter from './routes/liens.js';
import planningRouter from './routes/planning.js';
import rubriquesRouter from './routes/rubriques.js';
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
import { readReporter, requireAuth, requireAdmin, safeEqual } from './middleware/auth.js';
import logger from './logger/index.js';

import { sanitizerMiddleware } from './middleware/sanitizer.js';
import { globalLimiter, uploadLimiter, archiveLimiter } from './middleware/rateLimiter.js';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/errorHandler.js';
import { Server } from 'socket.io';
import { setProgressIo } from './services/editorProgress.js';

export let io;

// Le canal WebSocket ne fait que pousser des signaux de rafraîchissement UI
// (upload_update) — rien de sensible. Le mot de passe de session global a
// été retiré (décision produit, voir middleware/auth.js) ; gate les sockets
// derrière lui n'aurait plus de sens alors que le reste de l'API est ouvert.
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

  setProgressIo(io);

  io.on('connection', (socket) => {
    socket.on('join_week', (weekId) => {
      if (weekId && typeof weekId === 'string') {
        const roomName = `week:${weekId}`;
        socket.join(roomName);
        const room = io.sockets.adapter.rooms.get(roomName);
        const count = room ? room.size : 1;
        io.to(roomName).emit('editor_presence', { weekId, count });
      }
    });

    socket.on('leave_week', (weekId) => {
      if (weekId && typeof weekId === 'string') {
        const roomName = `week:${weekId}`;
        socket.leave(roomName);
        const room = io.sockets.adapter.rooms.get(roomName);
        const count = room ? room.size : 0;
        io.to(roomName).emit('editor_presence', { weekId, count });
      }
    });

    socket.on('disconnecting', () => {
      for (const roomName of socket.rooms) {
        if (roomName.startsWith('week:')) {
          const weekId = roomName.replace('week:', '');
          const room = io.sockets.adapter.rooms.get(roomName);
          const count = room ? Math.max(0, room.size - 1) : 0;
          io.to(roomName).emit('editor_presence', { weekId, count });
        }
      }
    });
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
    // `x-reporter-token` et `x-app-password` manquaient : le navigateur les
    // retirait donc dès que l'API n'était pas servie sur la même origine que
    // l'interface. Invisible en production, où un seul proxy sert les deux,
    // mais un correspondant aurait perdu son lien personnel sur toute autre
    // topologie — sans le moindre message.
    allowedHeaders: ['Tus-Resumable', 'Upload-Length', 'Upload-Metadata', 'Location', 'Upload-Offset', 'Content-Type', 'Upload-Concat', 'Authorization', 'x-admin-password', 'x-worker-key', 'x-reporter-token', 'x-app-password', 'x-client-id']
  }));
  // globalLimiter (500 req/min/IP) NE doit PAS compter les PATCH TUS : un
  // upload de 20 Go en chunks de 5 Mo = ~4096 PATCH ; sur lien rapide ou
  // plusieurs monteurs derrière un même NAT, on dépasse 500/min → 429 que
  // tus-js-client ne réessaie pas par défaut → upload avorté. On saute donc
  // TUS (le rate-limit d'ouverture d'upload reste porté par uploadLimiter
  // sur le POST initial).
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/tus')) return next();
    return globalLimiter(req, res, next);
  });
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

  const serveUploadDownload = async (req, res, next) => {
    try {
      const filename = req.params[0];
      const metadata = (await import('./data/store.js')).getFileMetadata(filename);
      if (metadata && metadata.countryId === 'mj') {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? String(process.env.ADMIN_PASSWORD).trim() : undefined;
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
          return res.download(fullPath, metadata?.name || basename(safePath), (err) => {
            if (err && !res.headersSent) next(err);
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };

  app.get('/uploads/*', serveUploadDownload);
  app.get('/api/uploads/files/*', serveUploadDownload);

  // Servi en static. nosniff + attachment force pour les types non-média :
  // un upload .txt/.docx/.zip pourrait sinon être chargé inline et son
  // contenu sniffé en HTML/SVG → stored XSS. On garde inline pour audio/
  // vidéo/image (lecture du master + chutiers).
  const INLINE_EXT = /\.(mp4|mov|webm|mkv|mp3|wav|m4a|ogg|jpg|jpeg|png|webp|gif|bmp|heic|svg)$/i;
  const staticConfig = {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, p) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!INLINE_EXT.test(p)) {
        // Force le téléchargement plutôt que l'affichage inline.
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  };
  app.use('/uploads', express.static(dir, staticConfig));
  app.use('/api/uploads/files', express.static(dir, staticConfig));

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
  // Attribue un envoi à son auteur quand le lien personnel est présent. Ne
  // bloque jamais : l'accès reste ouvert (voir readReporter).
  app.use('/api', readReporter);
  app.use('/api/countries', countriesRouter);
  app.use('/api/weeks', weeksRouter);
  app.use('/api/sujets', sujetsRouter);
  app.use('/api/liens', liensRouter);
  app.use('/api/planning', planningRouter);
  app.use('/api/rubriques', rubriquesRouter);
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
