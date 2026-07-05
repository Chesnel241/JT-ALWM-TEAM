import logger from '../logger/index.js';
import * as Sentry from '@sentry/node';
import { getMetrics, metricsData } from './metrics.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

// Alert configuration thresholds
const ALERT_CONFIG = {
  ERROR_RATE_THRESHOLD: 0.05, // 5% errors
  ERROR_RATE_WINDOW: 5 * 60 * 1000, // 5 minutes
  DISK_USAGE_THRESHOLD: 0.8, // 80%
  MEMORY_USAGE_THRESHOLD: 0.9, // 90%
  // Capacité disque de référence pour l'alerte HIGH_DISK_USAGE. Ancienne
  // valeur 500 Mo = héritage Render (petit disque). Sur VPS le volume est
  // bien plus grand → défaut 10 Go, surchargeable via DISK_CAPACITY_MB
  // (ex: DISK_CAPACITY_MB=40960 pour 40 Go). Ce n'est PAS une limite
  // d'upload (celle-ci est MAX_FILE_SIZE dans lib/upload.js) : juste le
  // seuil au-delà duquel on log une alerte de saturation.
  MAX_DISK_CAPACITY_MB: parseInt(process.env.DISK_CAPACITY_MB || '10240', 10), // 10 Go par défaut
};

let alertState = {
  errorRateAlert: false,
  diskUsageAlert: false,
  memoryUsageAlert: false,
  lastAlertTime: {},
};

/**
 * Check error rate over time window
 */
function checkErrorRate() {
  const totalRequests = metricsData.request_count;
  const totalErrors = metricsData.errors_total;

  if (totalRequests === 0) return false;

  const errorRate = totalErrors / totalRequests;
  const isAlert = errorRate > ALERT_CONFIG.ERROR_RATE_THRESHOLD;

  if (isAlert && !alertState.errorRateAlert) {
    triggerAlert(
      'HIGH_ERROR_RATE',
      `Error rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${(ALERT_CONFIG.ERROR_RATE_THRESHOLD * 100).toFixed(2)}%)`,
      {
        error_rate: (errorRate * 100).toFixed(2),
        total_errors: totalErrors,
        total_requests: totalRequests,
      }
    );
    alertState.errorRateAlert = true;
  } else if (!isAlert && alertState.errorRateAlert) {
    clearAlert('HIGH_ERROR_RATE');
    alertState.errorRateAlert = false;
  }

  return isAlert;
}

/**
 * Check disk usage
 */
function checkDiskUsage(uploadsDir) {
  try {
    let totalSize = 0;
    try {
      const files = readdirSync(uploadsDir);
      files.forEach((file) => {
        const filePath = join(uploadsDir, file);
        try {
          const stat = statSync(filePath);
          totalSize += stat.size;
        } catch (err) {
          logger.warn(`Could not stat file: ${file}`);
        }
      });
    } catch (err) {
      logger.warn('Could not read uploads directory', {
        error: err.message,
      });
      return false;
    }

    const diskUsageMB = totalSize / 1024 / 1024;
    const usagePercent = diskUsageMB / ALERT_CONFIG.MAX_DISK_CAPACITY_MB;
    const isAlert = diskUsageMB > ALERT_CONFIG.MAX_DISK_CAPACITY_MB * ALERT_CONFIG.DISK_USAGE_THRESHOLD;

    if (isAlert && !alertState.diskUsageAlert) {
      triggerAlert(
        'HIGH_DISK_USAGE',
        `Disk usage: ${diskUsageMB.toFixed(2)}MB of ${ALERT_CONFIG.MAX_DISK_CAPACITY_MB}MB (${(usagePercent * 100).toFixed(2)}%)`,
        {
          disk_usage_mb: diskUsageMB.toFixed(2),
          disk_limit_mb: ALERT_CONFIG.MAX_DISK_CAPACITY_MB,
          usage_percent: (usagePercent * 100).toFixed(2),
        }
      );
      alertState.diskUsageAlert = true;
    } else if (!isAlert && alertState.diskUsageAlert) {
      clearAlert('HIGH_DISK_USAGE');
      alertState.diskUsageAlert = false;
    }

    return isAlert;
  } catch (error) {
    logger.error('Error checking disk usage', { error: error.message });
    return false;
  }
}

/**
 * Check memory usage
 */
function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  // Render Free tier has 512MB RAM. Calculate usage against 512MB.
  const SYSTEM_MEMORY_LIMIT_MB = 512;
  const usagePercent = (memUsage.rss / 1024 / 1024) / SYSTEM_MEMORY_LIMIT_MB;
  const isAlert = usagePercent > ALERT_CONFIG.MEMORY_USAGE_THRESHOLD;

  if (isAlert && !alertState.memoryUsageAlert) {
    triggerAlert(
      'HIGH_MEMORY_USAGE',
      `Memory usage: ${(usagePercent * 100).toFixed(2)}% (threshold: ${(ALERT_CONFIG.MEMORY_USAGE_THRESHOLD * 100).toFixed(2)}%)`,
      {
        heap_used_mb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heap_total_mb: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        usage_percent: (usagePercent * 100).toFixed(2),
      }
    );
    alertState.memoryUsageAlert = true;
  } else if (!isAlert && alertState.memoryUsageAlert) {
    clearAlert('HIGH_MEMORY_USAGE');
    alertState.memoryUsageAlert = false;
  }

  return isAlert;
}

/**
 * Trigger an alert
 */
function triggerAlert(alertType, message, context = {}) {
  // Rate limit alerts: don't send same alert twice within 15 minutes
  const now = Date.now();
  const lastAlert = alertState.lastAlertTime[alertType] || 0;
  const fifteenMinutes = 15 * 60 * 1000;

  if (now - lastAlert < fifteenMinutes) {
    return; // Skip if we already sent this alert recently
  }

  alertState.lastAlertTime[alertType] = now;

  // Log the alert
  logger.error(`🚨 ALERT: ${alertType}`, {
    context: {
      message,
      timestamp: new Date().toISOString(),
      ...context,
    },
  });

  // Send to Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(`🚨 ALERT: ${alertType} - ${message}`, 'warning');
  }

  // Send to Discord/Slack if webhook is configured
  if (process.env.ALERT_WEBHOOK_URL) {
    sendWebhookNotification(alertType, message, context).catch((err) => {
      logger.error('Failed to send webhook notification', {
        error: err.message,
      });
    });
  }

  // Send email if configured
  if (process.env.ALERT_EMAIL) {
    // Placeholder for email integration (e.g., using nodemailer)
    logger.info(`📧 Email notification would be sent to: ${process.env.ALERT_EMAIL}`);
  }
}

/**
 * Clear an alert
 */
function clearAlert(alertType) {
  logger.info(`✅ ALERT CLEARED: ${alertType}`, {
    context: { timestamp: new Date().toISOString() },
  });
}

/**
 * Send webhook notification (Discord/Slack)
 */
async function sendWebhookNotification(alertType, message, context) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    content: `🚨 **ALERT: ${alertType}**\n${message}`,
    embeds: [
      {
        title: alertType,
        description: message,
        color: 0xff6b6b,
        fields: Object.entries(context).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true,
        })),
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  } catch (error) {
    logger.error('Failed to send webhook', { error: error.message });
    throw error;
  }
}

/**
 * Start alert monitoring interval
 */
export function startAlertMonitoring(uploadsDir) {
  // Check alerts every 30 seconds
  const checkInterval = 30 * 1000;

  const intervalId = setInterval(() => {
    try {
      checkErrorRate();
      checkDiskUsage(uploadsDir);
      checkMemoryUsage();
    } catch (error) {
      logger.error('Error in alert monitoring', {
        error: error.message,
        stack: error.stack,
      });
    }
  }, checkInterval);

  // Clean up on process exit
  process.on('exit', () => clearInterval(intervalId));

  logger.info('✅ Alert monitoring started', {
    context: {
      check_interval_seconds: checkInterval / 1000,
      error_rate_threshold: `${(ALERT_CONFIG.ERROR_RATE_THRESHOLD * 100).toFixed(0)}%`,
      disk_threshold: `${(ALERT_CONFIG.DISK_USAGE_THRESHOLD * 100).toFixed(0)}%`,
      memory_threshold: `${(ALERT_CONFIG.MEMORY_USAGE_THRESHOLD * 100).toFixed(0)}%`,
    },
  });
}

/**
 * Get current alert state
 */
export function getAlertState() {
  return {
    ...alertState,
    config: ALERT_CONFIG,
  };
}

export default {
  startAlertMonitoring,
  getAlertState,
  checkErrorRate,
  checkDiskUsage,
  checkMemoryUsage,
};
