import { join } from 'path';
import logger from './logger/index.js';
import { startAlertMonitoring } from './monitoring/alerts.js';
import { cleanupExpiredUploads } from './data/store.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3010;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsOrigins = CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
// UPLOADS_DIR doit pointer vers le disque persistant en production
// (ex: /app/uploads/files sur Render). Sinon les fichiers disparaissent
// à chaque redéploiement.
const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');

const app = createApp({ uploadsDir, corsOrigins });

startAlertMonitoring(uploadsDir);

logger.info('Initializing cleanup scheduler', {
  context: { interval: '1 hour', uploadsDir },
});

try {
  cleanupExpiredUploads(null, uploadsDir);
  setInterval(() => {
    try {
      cleanupExpiredUploads(null, uploadsDir);
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
  server.close(() => {
    logger.info('Server closed due to uncaught exception');
    process.exit(1);
  });
});
