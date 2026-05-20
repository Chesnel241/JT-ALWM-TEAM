import winston from 'winston';
import path from 'path';
import { mkdirSync } from 'fs';
import { logsDir as resolveLogsDir } from '../lib/paths.js';

const logsDir = resolveLogsDir();
mkdirSync(logsDir, { recursive: true });

const isDev = process.env.NODE_ENV !== 'production';

// Format personnalisé pour les logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, context, error, stack, ...meta }) => {
    let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (context) {
      log += ` | context: ${JSON.stringify(context)}`;
    }
    
    if (error) {
      log += ` | error: ${error}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += ` | ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// Transport pour console (toujours actif)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    customFormat
  ),
  level: isDev ? 'debug' : 'info',
});

// Transport pour fichier (logs généraux, rotation quotidienne)
const fileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'app.log'),
  format: customFormat,
  maxsize: 10 * 1024 * 1024, // 10 MB
  maxFiles: 7, // 7 fichiers max
  level: 'info',
});

// Transport pour fichier d'erreurs
const errorFileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'error.log'),
  format: customFormat,
  maxsize: 10 * 1024 * 1024,
  maxFiles: 14,
  level: 'error',
});

// Créer le logger avec les transports conditionnels
const transports = [consoleTransport];
const exceptionHandlers = [];
const rejectionHandlers = [];

if (isDev) {
  transports.push(fileTransport);
  transports.push(errorFileTransport);
  exceptionHandlers.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: customFormat,
    })
  );
  rejectionHandlers.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: customFormat,
    })
  );
}

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: customFormat,
  transports,
  exceptionHandlers,
  rejectionHandlers,
});

// Ajouter des raccourcis pour les logs courants
logger.uploadReceived = (weekId, countryId, filename, size) => {
  logger.info('File uploaded successfully', {
    context: { weekId, countryId, filename, size },
  });
};

logger.uploadFailed = (weekId, countryId, filename, error) => {
  logger.error(`Upload failed for ${filename}`, {
    context: { weekId, countryId, filename },
    error: error.message,
  });
};

logger.healthCheck = (metrics) => {
  logger.debug('Health check performed', {
    context: metrics,
  });
};

logger.cleanupExecuted = (removedCount, details) => {
  logger.info(`Cleanup executed: ${removedCount} files removed`, {
    context: details,
  });
};

export default logger;
