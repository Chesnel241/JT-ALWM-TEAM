import logger from './logger/index.js';
import { startAlertMonitoring } from './monitoring/alerts.js';
import { cleanupExpiredUploads, initDb } from './data/store.js';
import { createApp, initSocket } from './app.js';
import { uploadsDir as resolveUploadsDir, pathsDiagnostic } from './lib/paths.js';

const PORT = process.env.PORT || 3010;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsOrigins = CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
const uploadsDir = resolveUploadsDir();

// Trace les chemins effectivement utilisés — facilite le debug
// "pourquoi mes données disparaissent" depuis les logs Render.
logger.info('Persistence paths resolved', { context: pathsDiagnostic() });

const app = createApp({ uploadsDir, corsOrigins });

startAlertMonitoring(uploadsDir);

import { initWebPushDb } from './data/webpushSubscriptions.js';

// Ensure DB is loaded (from Redis or local) before cleanup + listen
await initDb();
await initWebPushDb();

logger.info('Initializing cleanup scheduler', {
  context: { interval: '1 hour', uploadsDir },
});

// Helper qui await cleanup async + log toute exception (sinon
// unhandledRejection silencieux dans setInterval).
async function runCleanup() {
  try {
    await cleanupExpiredUploads(null, uploadsDir);
  } catch (err) {
    logger.error('Error during scheduled cleanup', {
      error: err.message,
      stack: err.stack,
    });
  }
}

runCleanup();
setInterval(runCleanup, 60 * 60 * 1000);

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

// Node >= 18 impose server.requestTimeout = 5 min (délai MAX pour recevoir la
// requête COMPLÈTE, corps inclus). Un master JT Prêt part en UN seul POST
// multipart (deliveries) : 20 Go à 50 Mbps ≈ 55 min → coupé à 5 min. Le
// timeoutMiddleware applicatif (2 h) est INOPÉRANT contre ce timeout socket
// de bas niveau. On le désactive (0 = illimité) ; le contrôle de durée réel
// est fait par timeoutMiddleware par route. headersTimeout/keepAlive ajustés
// pour rester cohérents sur les longues connexions (uploads + SSE de rendu).
server.requestTimeout = Number(process.env.SERVER_REQUEST_TIMEOUT_MS) || 0;
server.headersTimeout = Number(process.env.SERVER_HEADERS_TIMEOUT_MS) || 120000;
server.keepAliveTimeout = Number(process.env.SERVER_KEEPALIVE_TIMEOUT_MS) || 120000;

initSocket(server);

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
