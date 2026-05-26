import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { initSentry, getSentryErrorHandler } from './monitoring/sentry.js';
import { initMetrics } from './monitoring/metrics.js';
import cookieParser from 'cookie-parser';
import countriesRouter from './routes/countries.js';
import weeksRouter from './routes/weeks.js';
import uploadsRouter from './routes/uploads.js';
import deliveriesRouter from './routes/deliveries.js';
import notificationsRouter from './routes/notifications.js';
import analyticsRouter from './routes/analytics.js';
import authRouter from './routes/auth.js';
import editorRouter from './routes/editor.js';
import healthRouter, { metricsRouter } from './routes/health.js';
import { HAS_R2, getR2PresignedUrl, checkR2Exists } from './lib/s3.js';
import { requireAuth } from './middleware/auth.js';

import { sanitizerMiddleware } from './middleware/sanitizer.js';
import { globalLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/errorHandler.js';

// Timeout par requête (en ms). Upload de gros fichiers : 10 min.
// Reste : 30 s. Au-delà, on coupe pour éviter les Slowloris.
const UPLOAD_TIMEOUT_MS = parseInt(process.env.UPLOAD_TIMEOUT_MS || 600000, 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || 30000, 10);

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
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
      const providedToken = req.query.adminPassword || req.header('x-admin-password');
      if (ADMIN_PASSWORD && providedToken !== ADMIN_PASSWORD) {
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
        // Ignorer l'erreur et laisser express.static chercher localement
      }
    }
    next();
  });

  app.use('/uploads', express.static(dir));

  app.get('/', (req, res) => res.status(200).send('ALWM Backend API is running.'));

  app.use('/health', healthRouter);
  app.use('/metrics', metricsRouter);

  // Routes auth (login/logout/check) AVANT requireAuth : on doit
  // pouvoir s'authentifier sans être déjà authentifié.
  app.use('/api/auth', authRouter);

  // Toutes les autres routes /api/* exigent un cookie de session valide.
  app.use('/api', requireAuth);

  app.use('/api/countries', countriesRouter);
  app.use('/api/weeks', weeksRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/uploads', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), uploadsRouter);
  app.use('/api/deliveries', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), deliveriesRouter);
  app.use('/api/editor', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), editorRouter);

  app.use(notFoundMiddleware);
  if (enableMonitoring) {
    app.use(getSentryErrorHandler());
  }
  app.use(errorHandlerMiddleware);

  return app;
}
