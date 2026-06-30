import { createHmac, timingSafeEqual } from 'crypto';

// Secret de signature. En production on EXIGE un vrai secret (sinon les
// tokens de download seraient forgeables) ; fallback toléré en dev/test.
const DOWNLOAD_TOKEN_SECRET = process.env.WORKER_KEY || process.env.GLOBAL_PASSWORD
  || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('FATAL: WORKER_KEY ou GLOBAL_PASSWORD requis pour signer les tokens de download'); })()
    : 'default_secret_for_dev_only');
// Token validity in milliseconds (e.g. 1 hour)
const TOKEN_VALIDITY_MS = 3600000;

export function generateDownloadToken(filename) {
  const expiresAt = Date.now() + TOKEN_VALIDITY_MS;
  const payload = `${filename}:${expiresAt}`;
  const signature = createHmac('sha256', DOWNLOAD_TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

export function verifyDownloadToken(token, filename) {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  
  const [tokenFilename, expiresAtStr, signature] = parts;
  
  // Verify filename matches
  if (tokenFilename !== filename) return false;
  
  // Verify expiration
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
  
  // Verify signature (comparaison à temps constant — anti-timing).
  const expectedPayload = `${tokenFilename}:${expiresAtStr}`;
  const expectedSignature = createHmac('sha256', DOWNLOAD_TOKEN_SECRET).update(expectedPayload).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  return a.length === b.length && timingSafeEqual(a, b);
}
