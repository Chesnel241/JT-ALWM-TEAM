import { describe, it, expect } from 'vitest';
import { statutDe, compterARevoir, recentsDabord, ordreAffichage } from '../src/lib/revue.js';

describe('la revue des rushes', () => {
  // L'INCIDENT : la fenêtre s'ouvrait sur « Refusé » par défaut, et rien ne
  // disait ce qui restait à revoir.
  it('un envoi neuf, sans statut, est « à revoir » — jamais refusé', () => {
    expect(statutDe({})).toBe('pending');
    expect(statutDe({ status: 'approved' })).toBe('approved');
    expect(statutDe({ status: 'rejected' })).toBe('rejected');
    expect(compterARevoir([{}, { status: 'pending' }, { status: 'approved' }])).toBe(2);
  });

  it('montre le plus récent d’abord', () => {
    const ancien = { id: 'a', uploadedAt: '2026-11-02T10:00:00Z' };
    const recent = { id: 'b', uploadedAt: '2026-11-05T10:00:00Z' };
    expect([ancien, recent].sort(recentsDabord).map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('suit l’ordre de l’écran : reportage, puis vidéo avant photo, le plus récent d’abord', () => {
    const sujets = [{ id: 's1', titre: 'Marché' }];
    const fichiers = [
      { id: 'photo', name: 'a.jpg', sujetId: 's1', uploadedAt: '2026-11-05T12:00:00Z' },
      { id: 'video-ancienne', name: 'b.mp4', sujetId: 's1', uploadedAt: '2026-11-01T12:00:00Z' },
      { id: 'video-recente', name: 'c.mp4', sujetId: 's1', uploadedAt: '2026-11-04T12:00:00Z' },
    ];
    expect(ordreAffichage(fichiers, sujets).map((f) => f.id)).toEqual(['video-recente', 'video-ancienne', 'photo']);
  });
});
