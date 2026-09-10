import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

const SECRET = 'un-secret-de-test';
let jeton;

beforeAll(async () => {
  process.env.REPORTER_TOKEN_SECRET = SECRET;
  vi.resetModules();
  jeton = await import('../src/lib/reporterToken.js');
});

afterAll(() => { delete process.env.REPORTER_TOKEN_SECRET; });

describe('lien personnel du correspondant', () => {
  it('émet un jeton relisible', () => {
    const t = jeton.issueReporterToken({ pays: 'sn', nom: 'Awa Diop' });
    const lu = jeton.readReporterToken(t);
    expect(lu.pays).toBe('sn');
    expect(lu.nom).toBe('Awa Diop');
    expect(lu.id).toBeTruthy();
  });

  it('refuse un jeton falsifié', () => {
    const t = jeton.issueReporterToken({ pays: 'sn' });
    // Charge modifiée, signature d'origine : c'est l'attaque évidente.
    const [corps] = t.split('.');
    const autreCorps = Buffer.from(JSON.stringify({ v: 1, id: 'x', pays: 'cm', nom: 'Intrus' }))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(jeton.readReporterToken(`${autreCorps}.${t.split('.')[1]}`)).toBeNull();
    expect(jeton.readReporterToken(`${corps}.signature-inventee`)).toBeNull();
  });

  it('refuse ce qui n\'est pas un jeton', () => {
    for (const mauvais of ['', null, undefined, 'abc', 'a.b.c', 'x'.repeat(3000)]) {
      expect(jeton.readReporterToken(mauvais)).toBeNull();
    }
  });

  it('refuse un pays mal formé dans la charge', async () => {
    const corps = Buffer.from(JSON.stringify({ v: 1, id: 'x', pays: '../etc', nom: '' }))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    // Même signé correctement, un pays invalide ne passe pas.
    const { createHmac } = await import('crypto');
    const sig = createHmac('sha256', SECRET).update(corps).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(jeton.readReporterToken(`${corps}.${sig}`)).toBeNull();
  });

  it('n\'émet rien et ne croit personne sans secret configuré', async () => {
    delete process.env.REPORTER_TOKEN_SECRET;
    vi.resetModules();
    const sansSecret = await import('../src/lib/reporterToken.js');
    expect(sansSecret.isReporterTokenConfigured()).toBe(false);
    expect(sansSecret.issueReporterToken({ pays: 'sn' })).toBe('');
    // Un jeton valide ailleurs ne doit pas être cru ici.
    expect(sansSecret.readReporterToken(jeton.issueReporterToken({ pays: 'sn' }))).toBeNull();
    process.env.REPORTER_TOKEN_SECRET = SECRET;
  });
});
