import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { buildWeeks } from '../data/constants.js';

export let metricsData = {
  start_time: Date.now(),
  errors_total: 0,
  uploads_total: 0,
  uploads_successful: 0,
  uploads_failed: 0,
  avg_upload_time_ms: 0,
  request_count: 0,
  last_error: null,
};

let uploadTimes = [];

/**
 * Initialize metrics tracking
 */
export function initMetrics(app) {
  // Track all requests
  app.use((req, res, next) => {
    metricsData.request_count++;
    next();
  });

  console.log('✅ Metrics initialized');
}

/**
 * Record an upload
 */
export function recordUpload(duration_ms, success = true) {
  metricsData.uploads_total++;
  if (success) {
    metricsData.uploads_successful++;
    uploadTimes.push(duration_ms);
    // Keep only last 100 uploads for average calculation
    if (uploadTimes.length > 100) {
      uploadTimes.shift();
    }
    metricsData.avg_upload_time_ms =
      uploadTimes.reduce((a, b) => a + b, 0) / uploadTimes.length;
  } else {
    metricsData.uploads_failed++;
  }
}

/**
 * Record an error
 */
export function recordError(error) {
  metricsData.errors_total++;
  metricsData.last_error = {
    timestamp: new Date().toISOString(),
    message: error.message,
    type: error.name,
  };
}

/**
 * Get disk usage of uploads folder in bytes
 */
function getDiskUsage(uploadsDir) {
  try {
    let totalSize = 0;
    const files = readdirSync(uploadsDir);
    files.forEach((file) => {
      const filePath = join(uploadsDir, file);
      const stat = statSync(filePath);
      totalSize += stat.size;
    });
    return totalSize;
  } catch (error) {
    console.error('Error calculating disk usage:', error);
    return 0;
  }
}

/**
 * Get complete metrics object
 */
export function getMetrics(uploadsDir) {
  const diskUsage = getDiskUsage(uploadsDir);
  const uptime = Math.floor((Date.now() - metricsData.start_time) / 1000);

  return {
    timestamp: new Date().toISOString(),
    uptime_seconds: uptime,
    requests: metricsData.request_count,
    uploads: {
      total: metricsData.uploads_total,
      successful: metricsData.uploads_successful,
      failed: metricsData.uploads_failed,
      avg_time_ms: Math.round(metricsData.avg_upload_time_ms),
    },
    errors: {
      total: metricsData.errors_total,
      last_error: metricsData.last_error,
    },
    disk: {
      usage_bytes: diskUsage,
      usage_mb: Math.round(diskUsage / 1024 / 1024),
      usage_gb: (diskUsage / 1024 / 1024 / 1024).toFixed(2),
    },
    weeks: buildWeeks().length,
  };
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics() {
  // Update properties instead of reassigning to preserve export reference
  Object.assign(metricsData, {
    start_time: Date.now(),
    errors_total: 0,
    uploads_total: 0,
    uploads_successful: 0,
    uploads_failed: 0,
    avg_upload_time_ms: 0,
    request_count: 0,
    last_error: null,
  });
  uploadTimes = [];
}

export default {
  initMetrics,
  recordUpload,
  recordError,
  getMetrics,
  resetMetrics,
};
