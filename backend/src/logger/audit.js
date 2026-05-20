/**
 * Audit log persistant.
 *
 * Trace les opérations sensibles (création de pays, upload, suppression)
 * dans un fichier dédié `audit.log` sur le disque persistant Render.
 * Format JSON Lines : 1 event par ligne, facile à parser/analyser.
 *
 * En l'absence d'authentification, l'audit log est le seul moyen
 * d'identifier un abus a posteriori (créations en masse, suppressions
 * suspectes, etc.).
 */

import winston from 'winston';
import path from 'path';
import { mkdirSync } from 'fs';
import { logsDir as resolveLogsDir } from '../lib/paths.js';

const auditDir = resolveLogsDir();
mkdirSync(auditDir, { recursive: true });

const isDev = process.env.NODE_ENV !== 'production';

const auditTransports = [];
if (isDev) {
  auditTransports.push(
    new winston.transports.File({
      filename: path.join(auditDir, 'audit.log'),
      maxsize: 20 * 1024 * 1024, // 20 MB
      maxFiles: 10,              // ~200 MB max
      tailable: true,
    })
  );
} else {
  // En production sans disque persistant, on envoie l'audit sur stdout
  // dans un format JSON Lines que l'infrastructure de log pourra parser.
  auditTransports.push(new winston.transports.Console());
}

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: auditTransports,
});

/**
 * Émet un événement d'audit.
 * @param {string} action - ex: 'country.create', 'upload.create', 'upload.delete'
 * @param {import('express').Request} req
 * @param {object} details - payload additionnel (id, filename, etc.)
 */
export function audit(action, req, details = {}) {
  auditLogger.info(action, {
    action,
    ip: req?.headers?.['x-forwarded-for'] || req?.ip || 'unknown',
    userAgent: req?.headers?.['user-agent'] || 'unknown',
    method: req?.method,
    path: req?.originalUrl || req?.path,
    details,
  });
}
