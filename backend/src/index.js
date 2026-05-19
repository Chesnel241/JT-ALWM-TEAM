import express from 'express';
import cors from 'cors';
import { mkdirSync } from 'fs';
import { join } from 'path';
import logger from './logger/index.js';
import { initSentry } from './monitoring/sentry.js';
import { initMetrics } from './monitoring/metrics.js';
import { startAlertMonitoring } from './monitoring/alerts.js';
import countriesRouter from './routes/countries.js';
import weeksRouter from './routes/weeks.js';
import uploadsRouter from './routes/uploads.js';
import healthRouter from './routes/health.js';
import { WEEKS } from './data/constants.js';
import { cleanupExpiredUploads } from './data/store.js';

// Middlewares
import { sanitizerMiddleware } from './middleware/sanitizer.js';
import { globalLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/errorHandler.js';

// Creer les dossiers nécessaires
const uploadsDir = join(process.cwd(), 'uploads');
mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3010;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ========== INITIALIZE MONITORING ==========
initSentry(app); // Initialize Sentry error tracking FIRST (before other middleware)
initMetrics(app); // Initialize metrics tracking
startAlertMonitoring(uploadsDir); // Start alert monitoring

// ========== MIDDLEWARES ==========
app.use(cors({ origin: CORS_ORIGIN }));
app.use(globalLimiter); // Rate limiting global
app.use(express.json());
app.use(sanitizerMiddleware); // Sanitization des inputs
app.use('/uploads', express.static('uploads'));

// Routes API
app.use('/health', healthRouter);
app.use('/api/countries', countriesRouter);
app.use('/api/weeks', weeksRouter);
app.use('/api/uploads', uploadLimiter, uploadsRouter); // Rate limiting spécifique pour uploads

// Middleware 404 (après toutes les routes)
app.use(notFoundMiddleware);

// Middleware d'erreur global (DOIT être le dernier)
app.use(errorHandlerMiddleware);

// Nettoyage periodique des uploads (48h apres fin de semaine archivee)
logger.info('Initializing cleanup scheduler', {
  context: { interval: '1 hour', uploadsDir },
});

try {
  cleanupExpiredUploads(WEEKS, uploadsDir);
  setInterval(() => {
    try {
      cleanupExpiredUploads(WEEKS, uploadsDir);
    } catch (err) {
      logger.error('Error during scheduled cleanup', {
        error: err.message,
        stack: err.stack,
      });
    }
  }, 60 * 60 * 1000);
} catch (err) {
  logger.error('Error initializing cleanup', {
    error: err.message,
    stack: err.stack,
  });
}

const server = app.listen(PORT, () => {
  logger.info(`✅ Backend JT ALWM démarré`, {
    context: {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      uploadsDir,
      timestamp: new Date().toISOString(),
    },
  });
  console.log(`✅ Backend JT ALWM démarré sur http://localhost:${PORT}`);
  console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💊 Health: http://localhost:${PORT}/health`);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    context: { promise: String(promise) },
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
  });
  // Graceful shutdown
  server.close(() => {
    logger.info('Server closed due to uncaught exception');
    process.exit(1);
  });
});
