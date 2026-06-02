import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { EnvatoMaskReveal, getExpEaseOut } from '../anim_envato.jsx';

const baseFontConfig = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  textTransform: 'uppercase',
  fontWeight: '900',
  lineHeight: 1,
  margin: 0,
};

export function EnvatoBigTitle({
  line1 = 'WHAT IS GOING ON',
  line2 = 'IN THE WORLD',
  subtitle = 'BREAKING NEWS',
  colorMain = '#d61f1f', // Broadcast red
  colorAccent = '#fcfcfc', // Off-white
  colorTextMain = '#fcfcfc',
  colorTextAccent = '#111111' // Off-black
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Out phase logic
  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outY = isOut ? (outEase * 60) : 0;
  const outOpacity = isOut ? (1 - outEase) : 1;

  // Intro scaling effect for premium Polish (compound unseen details)
  // Starts at 0.95 scale and softly reaches 1.0 for a natural entrance.
  const introEase = getExpEaseOut(frame, 0, 40);
  const introScale = 0.95 + (introEase * 0.05); 

  return (
     <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateY(${outY}px) scale(${introScale})`,
        opacity: outOpacity,
        willChange: 'transform, opacity'
     }}>
        {/* We stagger the reveals for a dynamic cascading entrance */}
        <div style={{ transform: 'skewX(-10deg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            <EnvatoMaskReveal frame={frame} delay={5} direction="right" duration={30}>
              <div style={{ backgroundColor: colorAccent, padding: '24px 64px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', marginBottom: '4px' }}>
                <div style={{ transform: 'skewX(10deg)' }}> {/* Unskew text so only box is skewed */}
                    <EnvatoMaskReveal frame={frame} delay={20} direction="bottom" duration={25}>
                      <div style={{ ...baseFontConfig, fontSize: '90px', color: colorTextAccent, letterSpacing: '-2px' }}>
                        {line1}
                      </div>
                    </EnvatoMaskReveal>
                </div>
              </div>
            </EnvatoMaskReveal>

            <EnvatoMaskReveal frame={frame} delay={12} direction="left" duration={30}>
              <div style={{ backgroundColor: colorAccent, padding: '24px 64px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ transform: 'skewX(10deg)' }}>
                    <EnvatoMaskReveal frame={frame} delay={27} direction="bottom" duration={25}>
                      <div style={{ ...baseFontConfig, fontSize: '90px', color: colorTextAccent, letterSpacing: '-2px' }}>
                        {line2}
                      </div>
                    </EnvatoMaskReveal>
                </div>
              </div>
            </EnvatoMaskReveal>
            
            {subtitle && (
                <EnvatoMaskReveal frame={frame} delay={24} direction="right" duration={30} style={{ marginTop: '-12px', zIndex: 10 }}>
                  <div style={{ backgroundColor: colorMain, padding: '16px 48px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ transform: 'skewX(10deg)' }}>
                        <EnvatoMaskReveal frame={frame} delay={39} direction="top" duration={25}>
                          <div style={{ ...baseFontConfig, fontSize: '36px', color: colorTextMain, letterSpacing: '4px' }}>
                            {subtitle}
                          </div>
                        </EnvatoMaskReveal>
                    </div>
                  </div>
                </EnvatoMaskReveal>
            )}
        </div>
     </div>
  );
}

export function EnvatoTicker({
  tag = 'LIVE',
  items = ['MARKETS REACH NEW HIGHS', 'GLOBAL SUMMIT BEGINS TODAY', 'TECH STOCKS RALLY', 'WEATHER UPDATE: STORM APPROACHING COAST'],
  colorMain = '#d61f1f',
  colorAccent = '#111111',
  colorTextMain = '#fcfcfc',
  colorTextAccent = '#fcfcfc'
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const isOut = frame > durationInFrames - 20;
  const outFrame = isOut ? frame - (durationInFrames - 20) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outY = isOut ? (outEase * 64) : 0;

  // Repeat items for a continuous ticker tape effect
  const separator = '   ///   ';
  const tickerText = [...items, ...items, ...items, ...items, ...items].join(separator);
  
  // Ticker scrolls to the left continuously.
  const speed = 4;
  const translateX = -(frame * speed); 

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: '64px',
      display: 'flex',
      transform: `translateY(${outY}px)`,
      willChange: 'transform'
    }}>
      {/* Ticker Tape */}
      <EnvatoMaskReveal frame={frame} delay={0} direction="right" duration={25} style={{ flex: 1, width: '100%' }}>
        <div style={{ backgroundColor: colorAccent, height: '100%', width: '100%', display: 'flex', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
            <div style={{
                position: 'absolute',
                left: '200px', // Starts just behind the LIVE tag
                whiteSpace: 'nowrap',
                transform: `translateX(${translateX}px)`,
                ...baseFontConfig,
                fontSize: '28px',
                color: colorTextAccent,
                fontWeight: '600',
                letterSpacing: '1px'
            }}>
                {tickerText}
            </div>
        </div>
      </EnvatoMaskReveal>

      {/* Live Tag Overlay */}
      <EnvatoMaskReveal frame={frame} delay={10} direction="right" duration={20} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10 }}>
        <div style={{ backgroundColor: colorMain, height: '100%', padding: '0 48px', display: 'flex', alignItems: 'center', boxShadow: '10px 0 30px rgba(0,0,0,0.5)' }}>
           <EnvatoMaskReveal frame={frame} delay={20} direction="bottom" duration={20}>
             <div style={{ ...baseFontConfig, fontSize: '32px', color: colorTextMain, fontWeight: '800' }}>
               {tag}
             </div>
           </EnvatoMaskReveal>
        </div>
      </EnvatoMaskReveal>
    </div>
  )
}
