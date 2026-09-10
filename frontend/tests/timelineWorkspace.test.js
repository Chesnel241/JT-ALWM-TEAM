import { describe, expect, it } from 'vitest';
import { DEFAULT_BRANDING, normalizeWorkspace } from '../src/components/editor/timelineWorkspace.js';

// Ce mapping est partagé par l'hydratation d'une semaine, la synchro socket et
// le rechargement après un 409 : il doit donner le même résultat aux trois.
describe('normalizeWorkspace', () => {
  it('résout les noms de fichiers en URL /uploads et laisse passer les URL externes', () => {
    const { clips } = normalizeWorkspace({
      clips: [
        { filename: 'sujet mali.mp4' },
        { filename: 'https://cdn.example.com/jingle.mp4' },
        { filename: 'blob:http://localhost/abc' },
        { name: 'sans-filename.mov' },
      ],
    });

    expect(clips[0].url).toBe('/uploads/sujet%20mali.mp4?cors=2');
    expect(clips[1].url).toBe('https://cdn.example.com/jingle.mp4');
    expect(clips[2].url).toBe('blob:http://localhost/abc');
    expect(clips[3].url).toBe('/uploads/sans-filename.mov?cors=2');
  });

  it("ne laisse aucun mot de passe dans l'URL des médias", () => {
    const { clips } = normalizeWorkspace({ clips: [{ filename: 'a.mp4' }] });
    expect(clips[0].url).not.toContain('adminPassword');
  });

  it('complète un habillage partiel avec les valeurs par défaut', () => {
    const { branding } = normalizeWorkspace({ branding: { logo: true } });
    expect(branding.logo).toBe(true);
    expect(branding.music).toEqual(DEFAULT_BRANDING.music);
  });

  it('tolère un workspace vide ou mal formé', () => {
    for (const input of [undefined, null, {}, { clips: 'nope', overlays: 3, branding: 'x' }]) {
      const next = normalizeWorkspace(input);
      expect(next.clips).toEqual([]);
      expect(next.overlays).toEqual([]);
      expect(next.branding).toBe(DEFAULT_BRANDING);
      expect(next.revision).toBeNull();
    }
  });

  it('expose la révision serveur et un payload sans les URL calculées', () => {
    const next = normalizeWorkspace({
      revision: 12,
      clips: [{ filename: 'a.mp4', url: 'périmée', inPoint: 1 }],
      overlays: [{ templateId: 'ticker' }],
      branding: { logo: true },
    });

    expect(next.revision).toBe(12);
    expect(next.payload.clips).toEqual([{ filename: 'a.mp4', inPoint: 1 }]);
    expect(next.payload.overlays).toBe(next.overlays);
    expect(next.payload.branding).toBe(next.branding);
  });

  it('produit une empreinte stable pour deux lectures du même workspace', () => {
    const workspace = { clips: [{ filename: 'a.mp4' }], overlays: [], branding: { logo: true } };
    expect(JSON.stringify(normalizeWorkspace(workspace).payload))
      .toBe(JSON.stringify(normalizeWorkspace(workspace).payload));
  });
});
