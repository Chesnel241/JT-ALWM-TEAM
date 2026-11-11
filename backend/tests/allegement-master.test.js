import { describe, it, expect } from 'vitest';
import { deciderAllegement } from '../src/services/videoCompress.js';

const Mo = 1024 * 1024;

// LE BESOIN : des correspondants envoient trente secondes qui pèsent un
// gigaoctet (téléphone réglé en 4K). Le JT sort en 1080p : tout ce débit est
// stocké, relu et rendu pour rien. Mais la version précédente écrasait le
// master par du 720p — on ne juge donc ni sur le poids seul, ni sans garde-fou.
describe('faut-il alléger ce rush ?', () => {
  const rush = (extra) => ({ tailleOctets: 1024 * Mo, dureeSec: 30, largeur: 3840, hauteur: 2160, imagesParSeconde: 30, extension: '.mp4', ...extra });

  it('trente secondes d’un gigaoctet en 4K : oui, ramené au 1080p', () => {
    expect(deciderAllegement(rush())).toEqual({ coteCourtMax: 1080, images30: false });
  });

  it('sous 200 Mo, on ne touche à rien', () => {
    expect(deciderAllegement(rush({ tailleOctets: 199 * Mo }))).toBeNull();
  });

  // Vingt minutes à 8 Mbit/s pèsent 1,2 Go : c'est long, pas trop lourd.
  it('un long reportage à un débit raisonnable n’est pas réencodé', () => {
    expect(deciderAllegement(rush({ tailleOctets: 1200 * Mo, dureeSec: 20 * 60, largeur: 1920, hauteur: 1080 }))).toBeNull();
  });

  it('un 1080p au débit démesuré est allégé sans changer de taille d’image', () => {
    expect(deciderAllegement(rush({ tailleOctets: 600 * Mo, dureeSec: 60, largeur: 1920, hauteur: 1080 })))
      .toEqual({ coteCourtMax: 1080, images30: false });
  });

  it('une vidéo verticale se juge sur son petit côté', () => {
    expect(deciderAllegement(rush({ tailleOctets: 300 * Mo, dureeSec: 600, largeur: 2160, hauteur: 3840 }))).not.toBeNull();
    expect(deciderAllegement(rush({ tailleOctets: 300 * Mo, dureeSec: 600, largeur: 1080, hauteur: 1920 }))).toBeNull();
  });

  it('60 images par seconde sont ramenées à 30, la cadence du JT', () => {
    expect(deciderAllegement(rush({ imagesParSeconde: 59.94 })).images30).toBe(true);
  });

  it('une durée inconnue ou un format rare : on garde l’original', () => {
    expect(deciderAllegement(rush({ dureeSec: 0 }))).toBeNull();
    expect(deciderAllegement(rush({ extension: '.avi' }))).toBeNull();
  });
});
