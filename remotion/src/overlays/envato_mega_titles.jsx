import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { EnvatoMaskReveal, getExpEaseOut } from '../anim_envato.jsx';

const baseFontConfig = {
  fontFamily: 'var(--ov-font) "Montserrat ExtraBold", system-ui, sans-serif',
  textTransform: 'uppercase',
  fontWeight: '900',
  lineHeight: 1,
  margin: 0,
};

// 1. EnvatoReportageMinimalLine
export function EnvatoReportageMinimalLine({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const title = fields.titre || "INVESTIGATIVE REPORT";
  const subtitle = fields.sous_titre || "UNCOVERING THE TRUTH";
  const colorMain = fields.colorMain || "#d61f1f";
  const colorTextMain = fields.colorTextMain || "#ffffff";
  const colorTextAccent = fields.colorTextAccent || "#111111";

  const isOut = frame > durationInFrames - 30;
  const outFrame = isOut ? frame - (durationInFrames - 30) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outOpacity = isOut ? 1 - outEase : 1;
  const outScale = isOut ? 1 + outEase * 0.05 : 1;

  // The line animation
  const lineEase = getExpEaseOut(frame, 5, 30);
  const lineWidth = lineEase * 100; // percentage of maximum width we define below

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: outOpacity, transform: `scale(${outScale})`
    }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '600px' }}>
        
        {/* Title (reveals up) */}
        <div style={{ overflow: 'hidden', paddingBottom: '16px' }}>
          <EnvatoMaskReveal frame={frame} delay={20} direction="top" duration={25}>
            <div style={{ ...baseFontConfig, fontSize: '80px', color: colorTextMain, textShadow: '0px 4px 12px rgba(0,0,0,0.5)' }}>
              {title}
            </div>
          </EnvatoMaskReveal>
        </div>

        {/* The line */}
        <div style={{
          width: `${lineWidth}%`,
          height: '6px',
          backgroundColor: colorMain,
          boxShadow: '0px 4px 12px rgba(0,0,0,0.3)'
        }} />

        {/* Subtitle (reveals down) */}
        <div style={{ overflow: 'hidden', paddingTop: '16px' }}>
          <EnvatoMaskReveal frame={frame} delay={25} direction="bottom" duration={25}>
            <div style={{ ...baseFontConfig, fontSize: '32px', color: colorTextMain, fontWeight: '700', letterSpacing: '4px', textShadow: '0px 4px 12px rgba(0,0,0,0.5)' }}>
              {subtitle}
            </div>
          </EnvatoMaskReveal>
        </div>
        
      </div>
    </div>
  );
}


// 2. EnvatoReportageDoubleSkew
export function EnvatoReportageDoubleSkew({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const line1 = fields.titre || "BREAKING";
  const line2 = fields.sous_titre || "NEWS TODAY";
  const colorMain = fields.colorMain || "#d61f1f";
  const colorAccent = fields.colorAccent || "#fcfcfc";
  
  const isOut = frame > durationInFrames - 30;
  const outFrame = isOut ? frame - (durationInFrames - 30) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outOpacity = isOut ? 1 - outEase : 1;

  // Box 1 (slides from left)
  const ease1 = getExpEaseOut(frame, 0, 30);
  const x1 = (1 - ease1) * -200;

  // Box 2 (slides from right)
  const ease2 = getExpEaseOut(frame, 5, 30);
  const x2 = (1 - ease2) * 200;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: outOpacity
    }}>
      <div style={{ display: 'flex', alignItems: 'center', transform: 'skewX(-15deg)' }}>
        <div style={{
          backgroundColor: colorMain, padding: '24px 48px',
          transform: `translateX(${x1}px)`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)', zIndex: 2
        }}>
          <EnvatoMaskReveal frame={frame} delay={15} direction="right" duration={20}>
             <div style={{ transform: 'skewX(15deg)', ...baseFontConfig, fontSize: '90px', color: '#fff' }}>
               {line1}
             </div>
          </EnvatoMaskReveal>
        </div>
        
        <div style={{
          backgroundColor: colorAccent, padding: '24px 48px',
          transform: `translateX(${x2}px)`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)', zIndex: 1, marginLeft: '-10px'
        }}>
          <EnvatoMaskReveal frame={frame} delay={20} direction="left" duration={20}>
             <div style={{ transform: 'skewX(15deg)', ...baseFontConfig, fontSize: '90px', color: '#111' }}>
               {line2}
             </div>
          </EnvatoMaskReveal>
        </div>
      </div>
    </div>
  );
}


// 3. EnvatoReportageGradientSwipe
export function EnvatoReportageGradientSwipe({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const text = fields.titre || "EXCLUSIVE INTERVIEW";
  const subtitle = fields.sous_titre || "WITH THE PRESIDENT";
  const colorMain = fields.colorMain || "#d61f1f";
  const colorTextMain = fields.colorTextMain || "#ffffff";
  const colorBg = fields.colorBg || "rgba(255,255,255,0.4)";
  
  const isOut = frame > durationInFrames - 30;
  const outFrame = isOut ? frame - (durationInFrames - 30) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outOpacity = isOut ? 1 - outEase : 1;

  // The luminous gradient swipe block
  const swipeEase = getExpEaseOut(frame, 0, 40);
  const swipeLeft = (swipeEase * 140) - 20; // moves from -20% to 120%

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: outOpacity
    }}>
      <div style={{ position: 'relative', padding: '40px', overflow: 'hidden' }}>
        
        {/* Luminous sweep background */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: `${swipeLeft}%`, width: '30%',
          background: `linear-gradient(90deg, transparent, ${colorBg}, transparent)`,
          transform: `skewX(-20deg)`,
          filter: 'blur(10px)',
          zIndex: 1
        }} />

        <div style={{ zIndex: 2, position: 'relative' }}>
          <EnvatoMaskReveal frame={frame} delay={10} direction="right" duration={35}>
            <div style={{ ...baseFontConfig, fontSize: '70px', color: colorTextMain, textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
              {text}
            </div>
          </EnvatoMaskReveal>
          
          <EnvatoMaskReveal frame={frame} delay={20} direction="right" duration={35}>
            <div style={{ ...baseFontConfig, fontSize: '40px', color: colorMain, fontWeight: '800', textShadow: '0 4px 10px rgba(0,0,0,0.5)', marginTop: '10px' }}>
              {subtitle}
            </div>
          </EnvatoMaskReveal>
        </div>
      </div>
    </div>
  );
}


// 4. EnvatoReportageGlassmorphism
export function EnvatoReportageGlassmorphism({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const title = fields.titre || "UNDERCOVER";
  const subtitle = fields.sous_titre || "INSIDE THE CARTEL";
  const colorBg = fields.colorBg || "rgba(20, 20, 20, 0.4)";
  const colorTextMain = fields.colorTextMain || "#ffffff";
  const colorAccent = fields.colorAccent || "#ffffff";

  const isOut = frame > durationInFrames - 30;
  const outFrame = isOut ? frame - (durationInFrames - 30) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outOpacity = isOut ? 1 - outEase : 1;
  const outY = isOut ? outEase * 50 : 0;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: outOpacity, transform: `translateY(${outY}px)`
    }}>
      <EnvatoMaskReveal frame={frame} delay={0} direction="bottom" duration={30}>
        <div style={{
          background: colorBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${colorAccent}`,
          padding: '60px 100px',
          borderRadius: '2px',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <EnvatoMaskReveal frame={frame} delay={15} direction="right" duration={30}>
            <div style={{ ...baseFontConfig, fontSize: '100px', color: colorTextMain, letterSpacing: '4px' }}>
              {title}
            </div>
          </EnvatoMaskReveal>
          
          <div style={{ width: '100%', height: '2px', background: colorAccent, margin: '20px 0' }}>
            <EnvatoMaskReveal frame={frame} delay={25} direction="horizontal" duration={30}>
              <div style={{ width: '100%', height: '100%', background: colorTextMain }} />
            </EnvatoMaskReveal>
          </div>
          
          <EnvatoMaskReveal frame={frame} delay={35} direction="left" duration={30}>
            <div style={{ ...baseFontConfig, fontSize: '30px', color: colorTextMain, letterSpacing: '8px', fontWeight: '500' }}>
              {subtitle}
            </div>
          </EnvatoMaskReveal>
        </div>
      </EnvatoMaskReveal>
    </div>
  );
}


// 5. EnvatoReportageMassif
export function EnvatoReportageMassif({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const line1 = fields.titre || "STATE OF";
  const line2 = fields.sous_titre || "EMERGENCY";
  const colorMain = fields.colorMain || "#111111";
  const colorText = fields.colorTextMain || "#ffffff";
  const colorHighlight = fields.colorHighlight || "#d61f1f";

  const isOut = frame > durationInFrames - 30;
  const outFrame = isOut ? frame - (durationInFrames - 30) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outOpacity = isOut ? 1 - outEase : 1;

  // A massive box sliding up
  const boxEase = getExpEaseOut(frame, 0, 40);
  const boxY = (1 - boxEase) * 300;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: outOpacity
    }}>
      <div style={{
        transform: `translateY(${boxY}px)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        <div style={{
          backgroundColor: colorMain,
          padding: '40px 80px',
          boxShadow: '20px 20px 0px rgba(0,0,0,0.8)',
          borderLeft: `16px solid ${colorHighlight}`
        }}>
          <EnvatoMaskReveal frame={frame} delay={20} direction="bottom" duration={25}>
            <div style={{ ...baseFontConfig, fontSize: '110px', color: colorText, letterSpacing: '-2px' }}>
              {line1}
            </div>
          </EnvatoMaskReveal>
          
          <EnvatoMaskReveal frame={frame} delay={28} direction="bottom" duration={25}>
            <div style={{ ...baseFontConfig, fontSize: '110px', color: colorHighlight, letterSpacing: '-2px', marginTop: '-10px' }}>
              {line2}
            </div>
          </EnvatoMaskReveal>
        </div>
      </div>
    </div>
  );
}
