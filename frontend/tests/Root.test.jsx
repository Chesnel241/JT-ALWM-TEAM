import { describe, it, expect } from 'vitest';
import { RemotionRoot } from '../../remotion/src/Root.jsx';
import { totalDurationInFrames } from '../../remotion/src/JTMaster.jsx';
import { FPS, WIDTH, HEIGHT } from '../../remotion/src/theme.js';
import { OVERLAY_TEMPLATES } from '../src/data/overlayTemplates.js';

/**
 * La composition que le worker rend, et que rien ne regardait.
 *
 * `Root.jsx` et `index.js` ne sont importés par personne sauf le script
 * d'assemblage, qui n'est jamais lancé en intégration continue — l'image du
 * worker n'y est pas construite. Une erreur de syntaxe, un import cassé, une
 * composition mal déclarée y passaient donc sans un mot et ne se découvraient
 * qu'au rendu de production.
 *
 * Ajouter un `npm ci` et un assemblage Remotion complet à l'intégration
 * continue coûterait plusieurs centaines de mégaoctets, dont un binaire de
 * compositing. Ce fichier suffit : `RemotionRoot()` rend un élément React
 * qu'on inspecte sans le monter, et l'importer attrape déjà tout ce qui
 * empêcherait le worker de démarrer.
 */

const CHAMPS = new Map(OVERLAY_TEMPLATES.map((t) => [t.id, (t.fields || []).map((f) => f.key)]));

describe('la composition du master', () => {
  it('se déclare sous le nom que le worker demande', () => {
    // Le worker rend la composition « JTMaster » : la renommer ici casserait
    // le rendu sans casser aucun test, et sans rien dire avant la production.
    expect(RemotionRoot().props.id).toBe('JTMaster');
  });

  it('sort au format de diffusion, à la cadence de la charte', () => {
    const { width, height, fps } = RemotionRoot().props;
    expect([width, height]).toEqual([WIDTH, HEIGHT]);
    expect(fps).toBe(FPS);
  });

  it('calcule sa durée à partir des plans, et jamais zéro', () => {
    const { calculateMetadata, defaultProps, durationInFrames } = RemotionRoot().props;
    expect(durationInFrames).toBeGreaterThan(0);

    const mesure = calculateMetadata({ props: defaultProps });
    expect(mesure.durationInFrames).toBe(totalDurationInFrames(defaultProps.clips, FPS));
    expect(mesure.durationInFrames).toBeGreaterThan(0);
  });

  it('survit à un montage vide', () => {
    // Un JT dont tous les plans ont été retirés ne doit pas produire une
    // composition de zéro image : `renderMedia` échoue sur une durée nulle.
    const { calculateMetadata } = RemotionRoot().props;
    expect(calculateMetadata({ props: { clips: [] } }).durationInFrames).toBeGreaterThan(0);
  });
});

describe('les propriétés de démonstration décrivent un vrai JT', () => {
  const overlays = RemotionRoot().props.defaultProps.clips.flatMap((c) => c.overlays || []);

  it('n’emploie que des habillages du catalogue', () => {
    overlays.forEach((o) => {
      expect(CHAMPS.has(o.templateId), `habillage inconnu : ${o.templateId}`).toBe(true);
    });
  });

  it('remplit les champs que le catalogue déclare, et pas d’autres', () => {
    // C'est exactement l'erreur qui a laissé « WHAT IS GOING ON IN THE WORLD »
    // partir à l'antenne : un composant lisant un nom de champ que le
    // catalogue ne déclare pas. Ici elle est confinée à ce que montre le
    // studio Remotion, mais c'est la même famille.
    overlays.forEach((o) => {
      const declares = CHAMPS.get(o.templateId) || [];
      const inconnus = Object.keys(o.fields || {}).filter((k) => !declares.includes(k));
      expect(inconnus, `${o.templateId} : ${inconnus.join(', ')} hors de [${declares.join(', ')}]`).toEqual([]);
    });
  });
});
