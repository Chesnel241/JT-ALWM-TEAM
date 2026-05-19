import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { initSentry } from './monitoring/sentry.js';
import { initMetrics } from './monitoring/metrics.js';
import countriesRouter from './routes/countries.js';
import weeksRouter from './routes/weeks.js';
import uploadsRouter from './routes/uploads.js';
import healthRouter, { metricsRouter } from './routes/health.js';

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

export function createApp({ uploadsDir, corsOrigins, enableMonitoring = true } = {}) {
  const dir = uploadsDir || join(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });

  const app = express();

  // Render (et la plupart des PaaS) placent un load balancer devant
  // l'app. Sans `trust proxy`, req.ip vaut l'IP du LB et le rate
  // limiter bloque tout le monde sous une seule clé.
  app.set('trust proxy', 1);

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

  app.use(cors({ origin: corsOrigins }));
  app.use(globalLimiter);
  app.use(timeoutMiddleware(REQUEST_TIMEOUT_MS));
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitizerMiddleware);
  app.use('/uploads', express.static(dir));

  app.use('/health', healthRouter);
  app.use('/metrics', metricsRouter);
  app.use('/api/countries', countriesRouter);
  app.use('/api/weeks', weeksRouter);
  app.use('/api/uploads', uploadLimiter, timeoutMiddleware(UPLOAD_TIMEOUT_MS), uploadsRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
