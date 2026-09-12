import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * La file de compression ne doit jamais se figer.
 *
 * Elle est sérielle par choix — vingt encodages simultanés mettraient le VPS
 * à genoux un dimanche soir. Le revers, c'est qu'une seule tâche qui ne se
 * termine jamais bloque toutes les suivantes. Un fichier tronqué par un
 * envoi interrompu suffit à mettre ffmpeg dans cet état.
 */

afterEach(() => { vi.resetModules(); vi.restoreAllMocks(); });

describe('délai maximum de l’encodage', () => {
  it('abandonne un ffmpeg qui ne répond jamais, et le tue', async () => {
    vi.useFakeTimers();
    const tuer = vi.fn();

    // Un ffmpeg qui n'émet ni « end » ni « error » : exactement le cas qui
    // figeait la file. Le minuteur est la seule issue.
    vi.doMock('../src/lib/ffmpeg.js', () => ({
      default: () => {
        const commande = {
          videoFilters: () => commande,
          outputOptions: () => commande,
          on: () => commande,
          save: () => commande,
          kill: tuer,
        };
        return commande;
      },
    }));
    vi.doMock('fs', async () => {
      const vrai = await vi.importActual('fs');
      return { ...vrai, default: { ...vrai.default, statSync: () => ({ size: 42 }), existsSync: () => false } };
    });

    process.env.PROXY_TIMEOUT_MS = '1000';
    const { compressTo720 } = await import('../src/services/videoCompress.js');

    const promesse = compressTo720('/tmp/bloque.mp4', '.mp4');
    await vi.advanceTimersByTimeAsync(1500);
    const resultat = await promesse;

    expect(tuer).toHaveBeenCalled();
    // L'échec n'est pas fatal : le master reste, le montage le lira.
    expect(resultat.compressed).toBe(false);
    vi.useRealTimers();
    delete process.env.PROXY_TIMEOUT_MS;
  });
});

describe('la file repart toujours', () => {
  it('une tâche qui échoue ne bloque pas les suivantes', async () => {
    const { runSerially, pendingCompressions } = await import('../src/services/videoCompress.js');
    const ordre = [];

    const a = runSerially(async () => { ordre.push('a'); throw new Error('ffmpeg a explosé'); });
    const b = runSerially(async () => { ordre.push('b'); });
    const c = runSerially(async () => { ordre.push('c'); });

    await Promise.all([a, b, c]);
    expect(ordre).toEqual(['a', 'b', 'c']);
    expect(pendingCompressions()).toBe(0);
  });

  it('rend son état lisible, pour qu’un blocage se voie', async () => {
    const { etatFileCompression } = await import('../src/services/videoCompress.js');
    const etat = etatFileCompression();
    expect(etat).toHaveProperty('enAttente');
    expect(etat).toHaveProperty('ageTacheCouranteMs');
    expect(etat.delaiMaxMs).toBeGreaterThan(0);
  });
});
