import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authorizeTusUpload, validateTusExtension } from '../src/routes/tus.js';

/**
 * Régression sécurité : la route /api/tus est montée AVANT requireAuth
 * (app.js — les body-parsers casseraient le protocole TUS). L'auth se fait
 * donc dans onUploadCreate via authorizeTusUpload. Historique : aucune
 * vérification du mot de passe global → upload anonyme par n'importe qui.
 */
describe('authorizeTusUpload — auth TUS fail-closed', () => {
  let prevGlobal;
  let prevAdmin;

  beforeEach(() => {
    prevGlobal = process.env.GLOBAL_PASSWORD;
    prevAdmin = process.env.ADMIN_PASSWORD;
    process.env.GLOBAL_PASSWORD = 'motdepasse-global';
    process.env.ADMIN_PASSWORD = 'motdepasse-admin';
  });

  afterEach(() => {
    if (prevGlobal === undefined) delete process.env.GLOBAL_PASSWORD;
    else process.env.GLOBAL_PASSWORD = prevGlobal;
    if (prevAdmin === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevAdmin;
  });

  it('refuse un upload sans token quand GLOBAL_PASSWORD est configuré', () => {
    expect(authorizeTusUpload({}).ok).toBe(false);
    expect(authorizeTusUpload({ adminPassword: '' }).ok).toBe(false);
  });

  it('refuse un token invalide', () => {
    expect(authorizeTusUpload({ adminPassword: 'mauvais' }).ok).toBe(false);
  });

  it('accepte le mot de passe global (token de session journaliste)', () => {
    const r = authorizeTusUpload({ adminPassword: 'motdepasse-global' });
    expect(r.ok).toBe(true);
    expect(r.isAdmin).toBe(false);
  });

  it('accepte le mot de passe admin et le marque isAdmin (bypass cutoff)', () => {
    const r = authorizeTusUpload({ adminPassword: 'motdepasse-admin' });
    expect(r.ok).toBe(true);
    expect(r.isAdmin).toBe(true);
  });

  it('normalise le token comme requireAuth (casse + espaces invisibles)', () => {
    const r = authorizeTusUpload({ adminPassword: '  MOTDEPASSE-GLOBAL ' });
    expect(r.ok).toBe(true);
  });

  it('laisse passer en dev local sans GLOBAL_PASSWORD', () => {
    delete process.env.GLOBAL_PASSWORD;
    expect(authorizeTusUpload({}).ok).toBe(true);
  });

  it("n'accorde jamais isAdmin si ADMIN_PASSWORD absent", () => {
    delete process.env.ADMIN_PASSWORD;
    const r = authorizeTusUpload({ adminPassword: 'motdepasse-global' });
    expect(r.ok).toBe(true);
    expect(r.isAdmin).toBe(false);
  });
});

describe('namingFunction — préservation extension (détection de type aval)', () => {
  it("préserve l'extension allowlistée en lowercase", async () => {
    const { tusServer } = await import('../src/routes/tus.js');
    const name = tusServer.options.namingFunction(null, { filename: 'reportage.MP4' });
    expect(name).toMatch(/\.mp4$/);
    expect(name).toMatch(/^\d+-[0-9a-f-]{36}\.mp4$/);
  });

  it("refuse les extensions hors allowlist (pas d'injection possible)", async () => {
    const { tusServer } = await import('../src/routes/tus.js');
    for (const fname of ['evil.html', 'x.svg', '../../etc/passwd', 'noext']) {
      const name = tusServer.options.namingFunction(null, { filename: fname });
      expect(name).toMatch(/^\d+-[0-9a-f-]{36}$/);
    }
  });
});

describe('validateTusExtension — allowlist alignée sur multer', () => {
  it('accepte les extensions média et documents autorisés', () => {
    for (const name of ['clip.mp4', 'rush.MOV', 'voix.mp3', 'script.docx', 'photo.jpg', 'audio.aac']) {
      expect(validateTusExtension(name)).toBe(true);
    }
  });

  it('refuse les extensions dangereuses ou inconnues', () => {
    for (const name of ['evil.html', 'payload.svg', 'script.js', 'run.exe', 'noext', '', null, undefined]) {
      expect(validateTusExtension(name)).toBe(false);
    }
  });
});
