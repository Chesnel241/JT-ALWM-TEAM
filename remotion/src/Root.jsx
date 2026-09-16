import React from 'react';
import { Composition } from 'remotion';
import { JTMaster, totalDurationInFrames } from './JTMaster.jsx';
import { FPS, WIDTH, HEIGHT } from './theme.js';

/**
 * Ce que montre le studio Remotion quand on l'ouvre sans montage.
 *
 * Ces valeurs doivent employer les identifiants et les noms de champs que le
 * catalogue déclare, comme n'importe quel montage. Elles ne le faisaient pas :
 * `lower_third` n'est qu'un alias interne au registre, absent du catalogue, et
 * « Breaking News » recevait `sujet` là où le catalogue déclare `texte` — le
 * sous-titre ne s'affichait donc jamais. Un test le vérifie maintenant.
 */
const DEMO = {
  clips: [
    {
      url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
      durationSec: 5,
      inPoint: 0,
      transition: { type: 'fade', duration: 0.5 },
      overlays: [
        { id: 'a', templateId: 'nom_interview', fields: { nom: 'Marie Dupont', fonction: 'Correspondante' }, animation: 'cascade', startTime: 0, duration: 5, colors: {} },
      ],
      subtitles: [{ start: 0.3, end: 2, text: 'Bonjour, voici le journal' }],
      subtitleStyle: { position: 'bottom', size: 'M' },
    },
    {
      url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
      durationSec: 5,
      inPoint: 0,
      overlays: [{ id: 'b', templateId: 'breaking_news', fields: { titre: 'DERNIÈRE MINUTE', texte: 'Sommet à Libreville' }, animation: 'glitch_in', startTime: 0, duration: 5 }],
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
