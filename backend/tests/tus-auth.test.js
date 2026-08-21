import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authorizeTusUpload, validateTusExtension } from '../src/routes/tus.js';

/**
 * Le mot de passe de session global (GLOBAL_PASSWORD) a ete retire (decision
 * produit) : authorizeTusUpload accepte desormais TOUJOURS l'upload
 * (`ok: true` inconditionnel), quel que soit l'etat de GLOBAL_PASSWORD en
 * env -- le check est supprime en code, pas seulement contourne via une
 * variable vide. `isAdmin` (ADMIN_PASSWORD) reste, lui, une protection
 * distincte et pleinement active (bypass cutoff, rubrique `mj`).
 */
describe('authorizeTusUpload -- mot de passe global retire', () => {
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

  it('accepte un upload sans aucun token, meme avec GLOBAL_PASSWORD configure', () => {
    expect(authorizeTusUpload({}).ok).toBe(true);
    expect(authorizeTusUpload({ adminPassword: '' }).ok).toBe(true);
  });

  it('accepte un token quelconque (non compare au mot de passe global)', () => {
    expect(authorizeTusUpload({ adminPassword: 'nimporte-quoi' }).ok).toBe(true);
  });

  it('accepte toujours, meme sans GLOBAL_PASSWORD en env', () => {
    delete process.env.GLOBAL_PASSWORD;
    expect(authorizeTusUpload({}).ok).toBe(true);
  });

  it('marque isAdmin=true si le mot de passe admin est fourni (protection distincte, inchangee)', () => {
    const r = authorizeTusUpload({ adminPassword: 'motdepasse-admin' });
    expect(r.ok).toBe(true);
    expect(r.isAdmin).toBe(true);
  });

  it("n'accorde jamais isAdmin sans le bon mot de passe admin", () => {
    const r = authorizeTusUpload({ adminPassword: 'mauvais' });
    expect(r.ok).toBe(true);
    expect(r.isAdmin).toBe(false);
  });

  it("n'accorde jamais isAdmin si ADMIN_PASSWORD absent", () => {
    delete process.env.ADMIN_PASSWORD;
    const r = authorizeTusUpload({ adminPassword: 'motdepasse-admin' });
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
