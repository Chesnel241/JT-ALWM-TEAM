import express from 'express';
import cors from 'cors';
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

export function createApp({ uploadsDir, corsOrigins, enableMonitoring = true } = {}) {
  const dir = uploadsDir || join(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });

  const app = express();

  if (enableMonitoring) {
    initSentry(app);
    initMetrics(app);
  }

  app.use(cors({ origin: corsOrigins }));
  app.use(globalLimiter);
  app.use(express.json());
  app.use(sanitizerMiddleware);
  app.use('/uploads', express.static(dir));

  app.use('/health', healthRouter);
  app.use('/metrics', metricsRouter);
  app.use('/api/countries', countriesRouter);
  app.use('/api/weeks', weeksRouter);
  app.use('/api/uploads', uploadLimiter, uploadsRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
