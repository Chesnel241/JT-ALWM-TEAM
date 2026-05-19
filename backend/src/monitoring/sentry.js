import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for error tracking
 * @param {Express.Application} app - Express app instance
 */
export function initSentry(app) {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not set - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
  });

  // Sentry request handler middleware (should be early)
  app.use(Sentry.Handlers.requestHandler());

  // Sentry tracing middleware
  app.use(Sentry.Handlers.tracingHandler());

  console.log('✅ Sentry initialized');
}

/**
 * Capture exception and send to Sentry
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export function captureException(error, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: context,
    });
  }
  console.error('❌ Exception:', error.message, context);
}

/**
 * Capture message and send to Sentry
 * @param {string} message - Message to log
 * @param {string} level - Log level: info, warning, error
 * @param {Object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
  console.log(`📝 [${level.toUpperCase()}] ${message}`, context);
}

/**
 * Get Sentry error handler middleware for Express
 */
export function getSentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

export default { initSentry, captureException, captureMessage, getSentryErrorHandler };
