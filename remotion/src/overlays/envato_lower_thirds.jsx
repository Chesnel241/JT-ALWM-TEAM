import React from 'react';
import { COULEURS, POLICE_HABILLAGE } from '../identite.js';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { EnvatoMaskReveal, getExpEaseOut } from '../anim_envato.jsx';
import TexteJT from '../TexteJT.jsx';

const baseFontConfig = {
  fontFamily: POLICE_HABILLAGE,
  textTransform: 'uppercase',
  fontWeight: '800',
  lineHeight: 1,
  margin: 0,
};

export function EnvatoPresenterLowerThird({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const context = fields.context || '';
  const name = fields.name || '';
  const title = fields.title || '';
  const colorMain = fields.colorMain || COULEURS.structure;
  const colorAccent = fields.colorAccent || COULEURS.papier;
  const colorTextMain = fields.colorTextMain || COULEURS.papier;
  const colorTextAccent = fields.colorTextAccent || COULEURS.encre;
  
  // Stagger delays
  const contextDelay = 10;
  const nameDelay = contextDelay + 6;
  const titleDelay = nameDelay + 6;

  // OUT phase
  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 30);
  const outY = isOut ? (outEase * 40) : 0;
  const outOpacity = isOut ? (1 - outEase) : 1;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: 80,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 4,
      transform: `translateY(${outY}px)`,
      opacity: outOpacity,
      willChange: 'transform, opacity'
    }}>
      
      {/* CONTEXT */}
      {context && (
        <EnvatoMaskReveal frame={frame} delay={contextDelay} direction="right" duration={25}>
          <div style={{ backgroundColor: colorMain, padding: '8px 14px' }}>
            <EnvatoMaskReveal frame={frame} delay={contextDelay + 10} direction="bottom" duration={20}>
              <TexteJT role="courant" delai={contextDelay + 10} style={{ ...baseFontConfig, fontSize: '20px', color: colorTextMain, fontWeight: '700', letterSpacing: '1px' }}>
                {context}
              </TexteJT>
            </EnvatoMaskReveal>
          </div>
        </EnvatoMaskReveal>
      )}

      {/* NAME */}
      {name && (
        <EnvatoMaskReveal frame={frame} delay={nameDelay} direction="right" duration={25}>
          <div style={{ backgroundColor: colorAccent, padding: '14px 28px' }}>
            <EnvatoMaskReveal frame={frame} delay={nameDelay + 10} direction="bottom" duration={20}>
              <TexteJT role="titrage" delai={nameDelay + 10} style={{ ...baseFontConfig, fontSize: '54px', color: colorTextAccent, letterSpacing: '-0.5px' }}>
                {name}
              </TexteJT>
            </EnvatoMaskReveal>
          </div>
        </EnvatoMaskReveal>
      )}

      {/* TITLE */}
      {title && (
        <EnvatoMaskReveal frame={frame} delay={titleDelay} direction="right" duration={25}>
          <div style={{ backgroundColor: colorMain, padding: '10px 20px' }}>
            <EnvatoMaskReveal frame={frame} delay={titleDelay + 10} direction="bottom" duration={20}>
              <TexteJT role="courant" delai={titleDelay + 10} style={{ ...baseFontConfig, fontSize: '26px', color: colorTextMain, fontWeight: '600', letterSpacing: '0.5px' }}>
                {title}
              </TexteJT>
            </EnvatoMaskReveal>
          </div>
        </EnvatoMaskReveal>
      )}
    </div>
  );
}

export function EnvatoNewsLowerThird({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const tag = fields.tag || 'BREAKING NEWS';
  const headline = fields.headline || '';
  const colorMain = fields.colorMain || COULEURS.structure;
  const colorAccent = fields.colorAccent || COULEURS.papier;
  const colorTextMain = fields.colorTextMain || COULEURS.papier;
  const colorTextAccent = fields.colorTextAccent || COULEURS.encre;
  
  // Stagger delays
  const tagDelay = 5;
  const headlineDelay = tagDelay + 12;

  // OUT phase
  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 30);
  const outY = isOut ? (outEase * 40) : 0;
  const outOpacity = isOut ? (1 - outEase) : 1;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: 80,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      transform: `translateY(${outY}px)`,
      opacity: outOpacity,
      willChange: 'transform, opacity'
    }}>
      
      {/* TAG BOX */}
      {tag && (
        <EnvatoMaskReveal frame={frame} delay={tagDelay} direction="right" duration={25} style={{ zIndex: 2 }}>
          <div style={{
            backgroundColor: colorMain,
            padding: '20px 32px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '4px 0 24px rgba(0,0,0,0.15)' // Depth from Emil's notes
          }}>
            <EnvatoMaskReveal frame={frame} delay={tagDelay + 10} direction="bottom" duration={20}>
              <TexteJT role="titrage" delai={tagDelay + 10} style={{ ...baseFontConfig, fontSize: '42px', color: colorTextMain, letterSpacing: '0px' }}>
                {tag}
              </TexteJT>
            </EnvatoMaskReveal>
          </div>
        </EnvatoMaskReveal>
      )}

      {/* HEADLINE BOX */}
      {headline && (
        <EnvatoMaskReveal frame={frame} delay={headlineDelay} direction="right" duration={30} style={{ zIndex: 1, marginLeft: '-4px' }}>
          <div style={{
            backgroundColor: colorAccent,
            padding: '20px 40px 20px 32px',
            display: 'flex',
            alignItems: 'center',
            height: '100%'
          }}>
            <EnvatoMaskReveal frame={frame} delay={headlineDelay + 15} direction="bottom" duration={25}>
              <TexteJT role="titrage" delai={headlineDelay + 15} style={{ ...baseFontConfig, fontSize: '32px', color: colorTextAccent, fontWeight: '700', letterSpacing: '0.5px' }}>
                {headline}
              </TexteJT>
            </EnvatoMaskReveal>
          </div>
        </EnvatoMaskReveal>
      )}
    </div>
  );
}
