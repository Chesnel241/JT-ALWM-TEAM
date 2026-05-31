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

  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Ne pas envoyer les PII par défaut (IP, cookies) automatiquement.
      sendDefaultPii: false,
      // Scrubbing : on retire les en-têtes d'authentification et les cookies
      // des événements avant envoi (X-App-Password, X-Admin-Password,
      // X-Worker-Key, Authorization, Cookie). Évite que des secrets se
      // retrouvent dans Sentry.
      beforeSend(event) {
        try {
          const h = event.request && event.request.headers;
          if (h) {
            for (const k of Object.keys(h)) {
              if (/^(x-app-password|x-admin-password|x-worker-key|authorization|cookie)$/i.test(k)) {
                h[k] = '[redacted]';
              }
            }
          }
          // Les query strings peuvent contenir ?adminPassword= / ?pwd= .
          if (event.request && typeof event.request.query_string === 'string') {
            event.request.query_string = event.request.query_string
              .replace(/(adminPassword|pwd)=[^&]*/gi, '$1=[redacted]');
          }
        } catch { /* best effort, ne jamais bloquer l'envoi */ }
        return event;
      },
    });

    if (Sentry.setupExpressErrorHandler) {
      // Sentry v8+
      Sentry.setupExpressErrorHandler(app);
    } else if (Sentry.Handlers) {
      // Sentry v7
      app.use(Sentry.Handlers.requestHandler());
      app.use(Sentry.Handlers.tracingHandler());
    }
    console.log('✅ Sentry initialized');
  } catch (err) {
    console.error('⚠️ Sentry init failed:', err.message);
  }
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
  if (Sentry.Handlers && Sentry.Handlers.errorHandler) {
    return Sentry.Handlers.errorHandler();
  }
  return (err, req, res, next) => next(err);
}

export default { initSentry, captureException, captureMessage, getSentryErrorHandler };
