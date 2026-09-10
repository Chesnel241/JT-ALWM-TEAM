import { describe, it, expect, beforeEach } from 'vitest';
import { runSerially, pendingCompressions } from '../src/services/videoCompress.js';

let running = 0;
let maxConcurrent = 0;
let order = [];

function fakeEncode(label, ms = 10) {
  return runSerially(async () => {
    running += 1;
    maxConcurrent = Math.max(maxConcurrent, running);
    await new Promise((resolve) => setTimeout(resolve, ms));
    order.push(label);
    running -= 1;
  });
}

beforeEach(() => {
  running = 0;
  maxConcurrent = 0;
  order = [];
});

describe('file d\'attente des compressions', () => {
  it('n\'encode qu\'un fichier à la fois', async () => {
    // Vingt correspondants qui envoient leur rush le dimanche soir
    // lanceraient autant d'encodages simultanés et le VPS ne répondrait plus.
    await Promise.all([fakeEncode('a'), fakeEncode('b'), fakeEncode('c')]);
    expect(maxConcurrent).toBe(1);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('un encodage qui échoue ne bloque pas les suivants', async () => {
    const failing = runSerially(async () => { throw new Error('ffmpeg absent'); });
    await Promise.all([failing, fakeEncode('apres')]);
    expect(order).toEqual(['apres']);
  });

  it('revient à zéro tâche en attente une fois la file vidée', async () => {
    await Promise.all([fakeEncode('a'), fakeEncode('b')]);
    expect(pendingCompressions()).toBe(0);
  });
});
