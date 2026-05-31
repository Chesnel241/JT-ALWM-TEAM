import { Router } from 'express';
import logger from '../logger/index.js';
import { getMetrics } from '../monitoring/metrics.js';
import { getAlertState } from '../monitoring/alerts.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadsDir as resolveUploadsDir } from '../lib/paths.js';

const router = Router();

/**
 * GET /health
 * Health check endpoint pour monitoring et load balancer
 */
router.get('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const uploadsDir = resolveUploadsDir();
    const responseTime = Date.now() - startTime;
    const metrics = getMetrics(uploadsDir);
    const memUsage = process.memoryUsage();

    const healthData = {
      success: true,
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      metrics: {
        requests: metrics.requests,
        errors: {
          total: metrics.errors.total,
          rate: metrics.requests > 0 ? (metrics.errors.total / metrics.requests * 100).toFixed(2) + '%' : '0%',
        },
        uploads: {
          total: metrics.uploads.total,
          successful: metrics.uploads.successful,
          failed: metrics.uploads.failed,
          avgTimeMs: metrics.uploads.avg_time_ms,
        },
        disk: {
          usageMB: metrics.disk.usage_mb,
          usageGB: metrics.disk.usage_gb,
        },
        memory: {
          heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
          heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
          heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(2) + '%',
        },
      },
    };

    logger.healthCheck(healthData);
    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message,
      stack: error.stack,
    });

    res.status(503).json({
      success: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Service temporarily unavailable',
    });
  }
}));

/**
 * GET /metrics - Extended metrics endpoint
 * Note: monté séparément dans index.js pour exposer /metrics à la racine.
 */
export const metricsRouter = Router();
metricsRouter.get('/', asyncHandler(async (req, res) => {
  try {
    const uploadsDir = resolveUploadsDir();
    const metrics = getMetrics(uploadsDir);
    const memUsage = process.memoryUsage();
    const alertState = getAlertState();
    
    const metricsData = {
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      ...metrics,
      memory: {
        rss_mb: (memUsage.rss / 1024 / 1024).toFixed(2),
        heap_used_mb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heap_total_mb: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        external_mb: (memUsage.external / 1024 / 1024).toFixed(2),
        heap_usage_percent: (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(2),
      },
      alerts: {
        error_rate: alertState.errorRateAlert,
        disk_usage: alertState.diskUsageAlert,
        memory_usage: alertState.memoryUsageAlert,
      },
    };

    res.status(200).json(metricsData);
  } catch (error) {
    logger.error('Metrics retrieval failed', {
      error: error.message,
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics',
      timestamp: new Date().toISOString(),
    });
  }
}));

export default router;
