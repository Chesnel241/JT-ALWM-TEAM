import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

/**
 * Initialize Sentry for frontend error tracking
 */
export function initSentryFrontend() {
  const sentryDSN = import.meta.env.VITE_SENTRY_DSN;

  if (!sentryDSN) {
    console.warn('⚠️  VITE_SENTRY_DSN not set - error tracking disabled');
    return null;
  }

  Sentry.init({
    dsn: sentryDSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  console.log('✅ Sentry Frontend initialized');
  return Sentry;
}

/**
 * Wrap React component with Sentry error boundary
 */
export function withSentryErrorBoundary(Component) {
  return Sentry.withErrorBoundary(Component, {
    fallback: <ErrorFallback />,
    showDialog: import.meta.env.MODE !== 'production',
  });
}

/**
 * Error boundary fallback UI
 */
function ErrorFallback() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Oops! Something went wrong</h2>
      <p>Our team has been notified. Please try refreshing the page.</p>
      <button onClick={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  );
}

export default { initSentryFrontend, withSentryErrorBoundary };
