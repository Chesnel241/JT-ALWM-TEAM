import { describe, expect, it } from 'vitest';
import {
  FPS,
  MIN_CLIP_DURATION,
  aimanter,
  defilementApresZoom,
  pointsDAimantation,
  pointsDeRognage,
  reperesVersSource,
  computeTimelineLayout,
  findClipAtTime,
  getClipDuration,
  getClipRange,
  getEffectiveTransitionDuration,
  quantize,
  roundToFrame,
  splitClipAtTime,
} from '../src/components/editor/timelineModel.js';

const idSequence = () => {
  let index = 0;
  return (kind) => `${kind}-${++index}`;
};

describe('timelineModel — précision temporelle', () => {
  it('quantifie les temps à l’image ou sur un pas explicite', () => {
    expect(FPS).toBe(30);
    expect(MIN_CLIP_DURATION).toBe(0.3);
    expect(roundToFrame(1.02)).toBe(31 / FPS);
    expect(quantize(1.26, 0.1)).toBe(1.3);
  });

  it('normalise une plage et donne priorité aux points IN/OUT', () => {
    const range = getClipRange({
      inPoint: 2,
      outPoint: 7,
      durationSec: 99,
      sourceDurationSec: 12,
    });
    expect(range).toEqual({ inPoint: 2, outPoint: 7, durationSec: 5, sourceDurationSec: 12 });
    expect(getClipDuration({ inPoint: 2, outPoint: 7 })).toBe(5);
  });

  it('respecte la durée minimale jusque contre la fin de la source', () => {
    expect(getClipRange({
      inPoint: 9.9,
      outPoint: 10,
      sourceDurationSec: 10,
    })).toEqual({ inPoint: 9.7, outPoint: 10, durationSec: 0.3, sourceDurationSec: 10 });
  });
});

describe('timelineModel — transitions et géométrie', () => {
  it('reproduit le clamp Remotion à la moitié des plans adjacents', () => {
    const clip = { durationSec: 1, transition: { type: 'fade', duration: 0.5 } };
    const next = { durationSec: 0.4 };
    // min(floor(30/2), floor(12/2)) - 1 = 5 images.
    expect(getEffectiveTransitionDuration(clip, next)).toBe(5 / FPS);
    expect(getEffectiveTransitionDuration({ durationSec: 4 }, next)).toBe(0);
  });

  it('calcule des positions, chevauchements et une durée totale cohérents', () => {
    const clips = [
      { instanceId: 'a', durationSec: 5, transition: { type: 'fade', duration: 0.5 } },
      { instanceId: 'b', durationSec: 3 },
    ];
    const layout = computeTimelineLayout(clips);

    expect(layout.starts).toEqual([0, 4.5]);
    expect(layout.ends).toEqual([5, 7.5]);
    expect(layout.durations).toEqual([5, 3]);
    expect(layout.transitionDurations).toEqual([0.5, 0]);
    expect(layout.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(layout.total).toBe(7.5);
    expect(layout.totalFrames).toBe(225);
  });

  it('sélectionne le clip entrant dans une zone de transition', () => {
    const clips = [
      { instanceId: 'a', inPoint: 2, durationSec: 5, transition: { type: 'fade', duration: 0.5 } },
      { instanceId: 'b', inPoint: 10, durationSec: 3 },
    ];
    const layout = computeTimelineLayout(clips);
    const hit = findClipAtTime(layout, 4.6);

    expect(hit.index).toBe(1);
    expect(hit.localTime).toBe(0.1);
    expect(hit.sourceTime).toBe(10.1);
    expect(findClipAtTime(layout, 4.6, 'a').index).toBe(0);
    expect(findClipAtTime(layout, -1)).toBeNull();
    expect(findClipAtTime(layout, 99)).toBeNull();
  });
});

describe('timelineModel — coupe vidéo', () => {
  it('préserve la durée totale et ne mute pas les clips originaux', () => {
    const clips = [
      { instanceId: 'original', filename: 'a.mp4', inPoint: 2, outPoint: 10, durationSec: 8 },
      { instanceId: 'b', filename: 'b.mp4', durationSec: 4 },
    ];
    const before = structuredClone(clips);
    const totalBefore = computeTimelineLayout(clips).total;
    const split = splitClipAtTime(clips, {
      clipId: 'original',
      globalTime: 3,
      createId: idSequence(),
    });
    const result = split.clips;

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      instanceId: 'clip-1', inPoint: 2, outPoint: 5, durationSec: 3,
    });
    expect(result[1]).toMatchObject({
      instanceId: 'clip-2', inPoint: 5, outPoint: 10, durationSec: 5,
    });
    expect(result[0].instanceId).not.toBe(result[1].instanceId);
    expect(split.left).toBe(result[0]);
    expect(split.right).toBe(result[1]);
    expect(split.index).toBe(0);
    expect(computeTimelineLayout(result).total).toBe(totalBefore);
    expect(clips).toEqual(before);
  });

  it('refuse les coupes situées à moins de la durée minimale des bords', () => {
    const clips = [{ instanceId: 'a', durationSec: 8 }];
    expect(splitClipAtTime(clips, {
      clipId: 'a', globalTime: MIN_CLIP_DURATION - 1 / FPS, createId: idSequence(),
    })).toEqual({ error: 'edge' });
    expect(splitClipAtTime(clips, {
      clipId: 'a', globalTime: 8 - MIN_CLIP_DURATION + 1 / FPS, createId: idSequence(),
    })).toEqual({ error: 'edge' });
    expect(splitClipAtTime(clips, {
      clipId: 'missing', globalTime: 4, createId: idSequence(),
    })).toEqual({ error: 'not-found' });
    expect(splitClipAtTime(clips, {
      clipId: 'a', globalTime: MIN_CLIP_DURATION, createId: idSequence(),
    }).clips).toHaveLength(2);
  });

  it('conserve la transition sortante uniquement sur la moitié droite', () => {
    const transition = { type: 'fade', duration: 0.5 };
    const clips = [
      { instanceId: 'a', durationSec: 8, transition },
      { instanceId: 'b', durationSec: 4 },
    ];
    const totalBefore = computeTimelineLayout(clips).total;
    const result = splitClipAtTime(clips, {
      clipId: 'a', globalTime: 3, createId: idSequence(),
    }).clips;

    expect(result[0].transition).toBeUndefined();
    expect(result[1].transition).toEqual(transition);
    expect(result[1].transition).not.toBe(transition);
    expect(computeTimelineLayout(result).total).toBe(totalBefore);
  });

  it('partitionne et rebase les overlays qui traversent la coupe', () => {
    const clips = [{
      instanceId: 'a',
      durationSec: 10,
      overlays: [
        { id: 'before', startTime: 1, duration: 1, fields: { texte: 'avant' } },
        { id: 'crossing', startTime: 2, duration: 5, fields: { texte: 'traverse' } },
        { id: 'after', startTime: 7, duration: 2, fields: { texte: 'après' } },
      ],
    }];
    const result = splitClipAtTime(clips, {
      clipId: 'a', globalTime: 4, createId: idSequence(),
    }).clips;
    const [left, right] = result;

    expect(left.overlays).toHaveLength(2);
    expect(left.overlays[0]).toMatchObject({ id: 'before', startTime: 1, duration: 1 });
    expect(left.overlays[1]).toMatchObject({ startTime: 2, duration: 2 });
    expect(right.overlays).toHaveLength(2);
    expect(right.overlays[0]).toMatchObject({ startTime: 0, duration: 3 });
    expect(right.overlays[1]).toMatchObject({ id: 'after', startTime: 3, duration: 2 });
    expect(left.overlays[1].id).not.toBe(right.overlays[0].id);
  });

  it('garde un overlay ouvert jusqu’à la fin sur la moitié droite', () => {
    const clips = [{
      instanceId: 'a',
      durationSec: 10,
      overlays: [{ id: 'open', startTime: 3, duration: null }],
    }];
    const { left, right } = splitClipAtTime(clips, {
      clipId: 'a', globalTime: 4, createId: idSequence(),
    });

    expect(left.overlays[0]).toMatchObject({ startTime: 3, duration: 1 });
    expect(right.overlays[0].startTime).toBe(0);
    expect(right.overlays[0].duration).toBeNull();
  });
});

describe('timelineModel — l’aimantation', () => {
  const layout = { items: [{ start: 0, end: 5 }, { start: 5, end: 11 }], total: 11 };

  it('propose les bords de plan, le début et la fin, et la tête de lecture', () => {
    // L'aimantation n'existait que vers la tête de lecture, et seulement au
    // rognage. Un titre déposé sur la piste T1 n'avait aucun repère : il
    // fallait viser au pixel, puis découvrir trois images de décalage à
    // l'export.
    expect(pointsDAimantation(layout, 7.3)).toEqual([0, 5, 7.3, 11]);
  });

  it('ne compte qu’une fois un repère partagé par deux plans', () => {
    // Deux plans qui se touchent donnent deux fois la même seconde.
    expect(pointsDAimantation(layout)).toEqual([0, 5, 11]);
  });

  it('survit à une timeline vide', () => {
    expect(pointsDAimantation(null)).toEqual([0]);
    expect(pointsDAimantation({ items: [], total: 0 })).toEqual([0]);
  });

  it('accroche ce qui est assez près, et laisse passer le reste', () => {
    const points = pointsDAimantation(layout, 7.3);
    expect(aimanter(5.05, points, 0.2)).toBe(5);
    expect(aimanter(8, points, 0.2)).toBe(8);
  });

  it('choisit le repère le plus proche quand deux sont à portée', () => {
    expect(aimanter(5.4, [5, 5.5], 1)).toBe(5.5);
  });

  it('laisse la valeur intacte quand l’aimantation est coupée', () => {
    // C'est ce que le bouton « Magnétisme » promet : le seuil tombe à zéro.
    expect(aimanter(5.05, pointsDAimantation(layout), 0)).toBe(5.05);
    expect(aimanter(5.05, [], 0.2)).toBe(5.05);
  });

  it('rend un temps quantifié à l’image', () => {
    // Un repère accroché doit tomber sur une image, sinon on réintroduit le
    // décalage qu'on venait de supprimer.
    expect(aimanter(4.999, [5.004], 0.2)).toBe(roundToFrame(5.004));
  });
});

describe('timelineModel — le zoom', () => {
  it('garde sous le pointeur ce qui s’y trouvait', () => {
    // Le zoom recentrait sur le bord gauche : sur un JT de dix minutes,
    // agrandir faisait perdre l'endroit qu'on venait de viser.
    const avant = { scrollLeft: 100, pointeurX: 200, pxPerSecAvant: 40, pxPerSecApres: 80 };
    const apres = defilementApresZoom(avant);
    // 7,5 s était sous le pointeur ; elle doit y rester.
    expect((avant.scrollLeft + avant.pointeurX) / avant.pxPerSecAvant).toBe(7.5);
    expect((apres + avant.pointeurX) / avant.pxPerSecApres).toBe(7.5);
  });

  it('ne défile jamais dans le négatif', () => {
    expect(defilementApresZoom({ scrollLeft: 0, pointeurX: 10, pxPerSecAvant: 80, pxPerSecApres: 20 })).toBe(0);
  });

  it('survit à un zoom absurde plutôt que de rendre NaN', () => {
    expect(defilementApresZoom({ scrollLeft: 100, pointeurX: 10, pxPerSecAvant: 0, pxPerSecApres: 60 })).toBe(100);
  });
});

describe('timelineModel — l’aimantation d’un rognage', () => {
  const titres = [
    { id: 't1', startTime: 2, duration: 3 },
    { id: 't2', startTime: 8, duration: null },
  ];

  it('vise les bords de titre, et non les bords de plan', () => {
    // Les plans sont posés bout à bout : raccourcir le 3 fait remonter le 4 et
    // la fin du montage. S'accrocher à des bords qui suivent le geste au lieu
    // de l'arrêter ne voudrait rien dire — seuls les titres portent un temps
    // absolu, et c'est le geste utile : « que ce plan s'arrête exactement où
    // le bandeau se referme ».
    expect(pointsDeRognage(titres, 6.5)).toEqual([2, 5, 6.5, 8]);
  });

  it('ignore la durée d’un titre ouvert jusqu’à la fin', () => {
    // `duration: null` veut dire « toute la vidéo » : sa fin n'est pas un
    // repère, elle dépend du montage entier.
    expect(pointsDeRognage([{ startTime: 8, duration: null }])).toEqual([8]);
  });

  it('survit à une piste de titres vide', () => {
    expect(pointsDeRognage(null)).toEqual([]);
    expect(pointsDeRognage([], 4)).toEqual([4]);
  });

  it('ramène les repères dans le temps de la source du plan', () => {
    // Un rognage raisonne en points d'entrée et de sortie du rush. Sans cette
    // conversion, accrocher la fin d'un plan au bord d'un bandeau le poserait
    // à la mauvaise image de la source.
    // Le plan commence à 5 s de montage sur la 12ᵉ seconde de son rush : le
    // bandeau qui se referme à 8 s de montage tombe à 15 s de rush.
    expect(reperesVersSource([2, 8], { debutMontage: 5, inPoint: 12 })).toEqual([9, 15]);
  });

  it('écarte les repères qui tombent avant le début de la source', () => {
    // Un titre placé avant le plan n'a pas d'équivalent dans son rush.
    expect(reperesVersSource([0, 8], { debutMontage: 5, inPoint: 1 })).toEqual([4]);
  });

  it('laisse passer une source non rognée sans rien déplacer', () => {
    expect(reperesVersSource([2, 8])).toEqual([2, 8]);
    expect(reperesVersSource(null, { debutMontage: 5, inPoint: 12 })).toEqual([]);
  });
});
