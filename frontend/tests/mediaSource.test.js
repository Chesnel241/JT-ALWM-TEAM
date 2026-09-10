import { describe, it, expect } from 'vitest';
import { previewFilename, previewUrl } from '../src/lib/mediaSource.js';
import { normalizeWorkspace } from '../src/components/editor/timelineWorkspace.js';

describe('source de lecture : proxy pour l\'aperçu, master pour l\'export', () => {
  const master = { filename: 'abc.mov', name: 'rush.mov' };
  const avecProxy = { filename: 'abc.mov', proxyFilename: 'abc.proxy.mp4', name: 'rush.mov' };

  it('préfère la copie légère quand elle existe', () => {
    expect(previewFilename(avecProxy)).toBe('abc.proxy.mp4');
    expect(previewUrl(avecProxy)).toContain('abc.proxy.mp4');
  });

  it('retombe sur le master quand aucun proxy n\'a été fabriqué', () => {
    // Formats non réencodés, échec ffmpeg, proxy plus lourd que l'original :
    // dans tous ces cas le montage lit le master, comme avant.
    expect(previewFilename(master)).toBe('abc.mov');
    expect(previewUrl(master)).toContain('abc.mov');
  });

  it('laisse passer une source déjà absolue', () => {
    expect(previewUrl({ filename: 'https://ailleurs/x.mp4' })).toBe('https://ailleurs/x.mp4');
    expect(previewUrl({ filename: 'blob:abc' })).toBe('blob:abc');
  });

  it('ne renvoie rien pour un média absent', () => {
    expect(previewUrl(null)).toBe('');
    expect(previewUrl({})).toBe('');
  });

  it('la frise lit le proxy mais garde le master dans ce qu\'elle enregistre', () => {
    const ws = normalizeWorkspace({ clips: [avecProxy], revision: 3 });
    expect(ws.clips[0].url).toContain('abc.proxy.mp4');
    // C'est ce `filename` que le serveur réassemble : il doit rester le master.
    expect(ws.payload.clips[0].filename).toBe('abc.mov');
    expect(ws.payload.clips[0].proxyFilename).toBe('abc.proxy.mp4');
  });
});
