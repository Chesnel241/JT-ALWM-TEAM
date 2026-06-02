import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { EnvatoMaskReveal, getExpEaseOut } from '../anim_envato.jsx';

const baseFontConfig = {
  fontFamily: 'var(--ov-font) "Montserrat ExtraBold", system-ui, sans-serif',
  textTransform: 'uppercase',
  fontWeight: '800',
  lineHeight: 1,
  margin: 0,
};

function LocationLabel({ frame, delay, location, sub, colorMain, colorAccent, colorTextMain, colorTextAccent, align = 'left' }) {
    const isRight = align === 'right';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isRight ? 'flex-end' : 'flex-start' }}>
         <EnvatoMaskReveal frame={frame} delay={delay} direction={isRight ? 'left' : 'right'} duration={25}>
            <div style={{ backgroundColor: colorAccent, padding: '16px 24px', display: 'flex', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
               <EnvatoMaskReveal frame={frame} delay={delay + 10} direction="bottom" duration={20}>
                 <div style={{ ...baseFontConfig, fontSize: '36px', color: colorTextAccent, letterSpacing: '1px' }}>
                    {location}
                 </div>
               </EnvatoMaskReveal>
            </div>
         </EnvatoMaskReveal>
         <EnvatoMaskReveal frame={frame} delay={delay + 8} direction={isRight ? 'left' : 'right'} duration={25} style={{ marginTop: '-4px', zIndex: 10 }}>
            <div style={{ backgroundColor: colorMain, padding: '10px 24px', boxShadow: '0 5px 20px rgba(0,0,0,0.2)' }}>
               <EnvatoMaskReveal frame={frame} delay={delay + 18} direction="bottom" duration={20}>
                 <div style={{ ...baseFontConfig, fontSize: '20px', color: colorTextMain, fontWeight: '700', letterSpacing: '2px' }}>
                    {sub}
                 </div>
               </EnvatoMaskReveal>
            </div>
         </EnvatoMaskReveal>
      </div>
    );
}

export function EnvatoSplitScreen({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const leftLocation = fields.leftLocation || 'CALIFORNIA';
  const leftSub = fields.leftSub || 'USA';
  const rightLocation = fields.rightLocation || 'NEW YORK';
  const rightSub = fields.rightSub || 'USA';
  const colorMain = fields.colorMain || '#d61f1f';
  const colorAccent = fields.colorAccent || '#fcfcfc';
  const colorTextMain = fields.colorTextMain || '#fcfcfc';
  const colorTextAccent = fields.colorTextAccent || '#111111';

  // Out phase logic
  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outOpacity = isOut ? (1 - outEase) : 1;
  const outScale = isOut ? 1 + (outEase * 0.05) : 1; // Slight scale up as it fades out

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      opacity: outOpacity,
      transform: `scale(${outScale})`,
      willChange: 'opacity, transform',
      pointerEvents: 'none' // Don't block interaction
    }}>
      {/* Central Diagonal Divider */}
      <EnvatoMaskReveal frame={frame} delay={0} direction="vertical" duration={35}>
          <div style={{
             position: 'absolute',
             top: '-10%', left: '50%',
             width: '12px', height: '120%',
             backgroundColor: colorAccent,
             transform: 'translateX(-50%) skewX(-15deg)',
             boxShadow: '0 0 40px rgba(0,0,0,0.4)'
          }} />
      </EnvatoMaskReveal>

      {/* Outer Premium Border */}
      <EnvatoMaskReveal frame={frame} delay={10} direction="horizontal" duration={40}>
        <div style={{
          position: 'absolute',
          top: '30px', left: '30px', right: '30px', bottom: '30px',
          border: `8px solid ${colorAccent}`,
          boxSizing: 'border-box',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.2)'
        }} />
      </EnvatoMaskReveal>

      {/* Left Location Label */}
      <div style={{ position: 'absolute', bottom: '80px', left: '80px' }}>
          <LocationLabel 
             frame={frame} delay={20} 
             location={leftLocation} sub={leftSub} 
             colorMain={colorMain} colorAccent={colorAccent} 
             colorTextMain={colorTextMain} colorTextAccent={colorTextAccent} 
          />
      </div>

      {/* Right Location Label */}
      <div style={{ position: 'absolute', top: '80px', right: '80px' }}>
          <LocationLabel 
             frame={frame} delay={25} 
             location={rightLocation} sub={rightSub} 
             colorMain={colorMain} colorAccent={colorAccent} 
             colorTextMain={colorTextMain} colorTextAccent={colorTextAccent}
             align="right"
          />
      </div>
    </div>
  );
}
