import React from 'react';
import { Composition } from 'remotion';
import { JTMaster, totalDurationInFrames } from './JTMaster.jsx';
import { FPS, WIDTH, HEIGHT } from './theme.js';

const DEMO = {
  clips: [
    {
      url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
      durationSec: 5,
      inPoint: 0,
      transition: { type: 'fade', duration: 0.5 },
      overlays: [
        { id: 'a', templateId: 'lower_third', fields: { name: 'Marie Dupont', title: 'Correspondante' }, animation: 'charpop', startTime: 0, duration: 5, colors: {} },
      ],
      subtitles: [{ start: 0.3, end: 2, text: 'Bonjour, voici le journal' }],
      subtitleStyle: { position: 'bottom', size: 'M' },
    },
    {
      url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
      durationSec: 5,
      inPoint: 0,
      overlays: [{ id: 'b', templateId: 'breaking_news', fields: { titre: 'DERNIÈRE MINUTE', sujet: 'Sommet à Libreville' }, startTime: 0, duration: 5 }],
    },
  ],
  branding: {
    ticker: { enabled: true, categorie: 'ALERTE', texte: 'Élections au Bénin • Le Maroc tenu en échec' },
    live: { enabled: true, label: 'DIRECT' },
    logo: true,
    logoPosition: 'br',
  },
};

export function RemotionRoot() {
  return (
    <Composition
      id="JTMaster"
      component={JTMaster}
      durationInFrames={300}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={DEMO}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalDurationInFrames(props.clips || [], FPS),
      })}
    />
  );
}
