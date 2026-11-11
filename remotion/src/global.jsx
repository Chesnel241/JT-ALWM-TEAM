import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ff } from './theme.js';
import { COULEURS, PILES, VOILES } from './identite.js';

const poser = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 4;

/**
 * Le bandeau défilant permanent, dans le dessin du paquet d'antenne.
 *
 * LE CONSTAT : il faisait 40 px de haut, avec un texte de 20 px — illisible
 * sur un téléviseur — et gardait l'ancien dessin alors que tout le reste de
 * l'habillage avait changé. Il monte du bas à l'ouverture du JT, porte une
 * mention sur le bleu clair de la chaîne, et défile à vitesse constante.
 *
 * `speed` : 1 (très lent) → 5 (très rapide).
 */
export function Ticker({ ticker }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!ticker || !ticker.enabled || !ticker.texte) return null;
  const k = fps / 30;
  const unite = `${String(ticker.texte).trim()}`;
  const nSpeed = Number(ticker.speed);
  const niveau = Math.max(1, Math.min(5, isNaN(nSpeed) ? 1 : nSpeed));
  const pxParSeconde = [70, 105, 150, 205, 270][niveau - 1];
  // La bande est répétée : elle boucle sur sa propre longueur, estimée.
  const largeur = Math.max(1200, unite.length * 19 + 160);
  const x = -(((frame / fps) * pxParSeconde) % largeur);
  const echelle = isNaN(Number(ticker.scale)) ? 1 : Number(ticker.scale) / 100;
  const px = isNaN(Number(ticker.posX)) ? 0 : Number(ticker.posX);
  const py = isNaN(Number(ticker.posY)) ? 0 : Number(ticker.posY);
  const leve = poser(frame / (16 * k));
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 72, display: 'flex', alignItems: 'stretch', overflow: 'hidden',
      background: COULEURS.fond, borderTop: `4px solid ${COULEURS.accent}`,
      transform: `translate(${px}px, ${py + (1 - leve) * 80}px) scale(${echelle})`, transformOrigin: 'bottom left',
      fontFamily: PILES.courant,
    }}>
      <div style={{ background: COULEURS.structure, color: COULEURS.papier, display: 'flex', alignItems: 'center', padding: '0 30px 0 96px', flexShrink: 0, fontFamily: PILES.titrage, fontWeight: 700, fontSize: 30, letterSpacing: '0.06em', zIndex: 2 }}>
        ALWM TV
      </div>
      {ticker.categorie && (
        <div style={{ background: COULEURS.accent, color: COULEURS.fond, display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, fontWeight: 700, fontSize: 26, letterSpacing: '0.1em', textTransform: 'uppercase', zIndex: 2 }}>
          {ticker.categorie}
        </div>
      )}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', transform: `translateX(${x.toFixed(2)}px)`, color: COULEURS.papier, fontWeight: 600, fontSize: 32 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ width: largeur, flexShrink: 0, paddingLeft: 40 }}>{unite}<span style={{ color: COULEURS.accent, paddingLeft: 40 }}>•</span></span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * La pastille « DIRECT », en haut à droite : un cartouche rouge dont le point
 * bat. Elle entre par un volet à l'ouverture du JT, puis ne bouge plus.
 */
export function LiveBadge({ live }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!live || !live.enabled) return null;
  const k = fps / 30;
  const battement = 0.45 + 0.55 * Math.abs(Math.cos((frame / fps) * Math.PI));
  const echelle = isNaN(Number(live.scale)) ? 1 : Number(live.scale) / 100;
  const px = isNaN(Number(live.posX)) ? 0 : Number(live.posX);
  const py = isNaN(Number(live.posY)) ? 0 : Number(live.posY);
  const cache = `inset(0 0 0 ${((1 - poser(frame / (14 * k))) * 100).toFixed(2)}%)`;
  return (
    <div style={{
      position: 'absolute', right: 96, top: 72, display: 'flex', alignItems: 'center', gap: 14,
      background: COULEURS.alerte, color: COULEURS.papier, padding: '10px 24px 9px 20px',
      fontFamily: PILES.titrage, fontWeight: 700, fontSize: 34, letterSpacing: '0.08em',
      clipPath: cache, WebkitClipPath: cache,
      transform: `translate(${px}px, ${py}px) scale(${echelle})`, transformOrigin: 'top right',
    }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: COULEURS.papier, opacity: battement }} />
      {(live.label || 'DIRECT').toUpperCase()}
    </div>
  );
}

const LOGO_POS = {
  tl: { left: 40, top: 40 },
  tr: { right: 40, top: 40 },
  bl: { left: 40, bottom: 40 },
  br: { right: 40, bottom: 40 },
  center: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' },
};

// Logo chaîne incrusté ; surélevé si ticker actif et position basse.
export function Logo({ logo, logoPosition, tickerOn, logoPosX = 0, logoPosY = 0, logoScale = 100 }) {
  if (!logo) return null;
  const pos = { ...(LOGO_POS[logoPosition] || LOGO_POS.br) };
  if (tickerOn && (logoPosition === 'bl' || logoPosition === 'br' || !logoPosition)) pos.bottom = 130;
  const scale = isNaN(Number(logoScale)) ? 1 : Number(logoScale) / 100;
  const px = isNaN(Number(logoPosX)) ? 0 : Number(logoPosX);
  const py = isNaN(Number(logoPosY)) ? 0 : Number(logoPosY);
  return <Img src={staticFile('habillage-logo.png')} style={{ position: 'absolute', height: 130, opacity: 0.9, ...pos, transform: `translate(${px}px, ${py}px) scale(${scale})`, transformOrigin: 'center center' }} />;
}

// Sous-titres : style position/taille/police, affichés selon le timing courant.
export function Subtitles({ subtitles, style, clipTimeSec }) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return null;
  const active = subtitles.find((s) => s && s.text && clipTimeSec >= s.start && clipTimeSec <= s.end);
  if (!active) return null;
  const st = style || {};
  const size = { S: 32, M: 40, L: 50 }[st.size] || 40;
  // En bas, les sous-titres passent AU-DESSUS des bandeaux de nom et de titre :
  // à 14 % du bord ils tombaient exactement à leur hauteur et s'y superposaient.
  const pos = st.position === 'top' ? { top: '6%' } : { bottom: '26%' };
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', ...pos }}>
        <span style={{ background: VOILES.panneau, color: COULEURS.papier, fontFamily: ff(st.font, 'Inter, sans-serif'), fontWeight: 600, fontSize: size, padding: '6px 18px', WebkitTextStroke: '1px #000', textShadow: '0 2px 4px #000' }}>{active.text}</span>
      </div>
    </AbsoluteFill>
  );
}
