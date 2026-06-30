import React from 'react';
import { useCurrentFrame } from 'remotion';
import { EnvatoMaskReveal, getExpEaseOut } from '../anim_envato.jsx';

const baseFontConfig = {
  fontFamily: 'var(--ov-font) "Montserrat ExtraBold", system-ui, sans-serif',
  textTransform: 'uppercase',
  fontWeight: '800',
  lineHeight: 1,
  margin: 0,
};

// 1. Fast, 1-line compact lower third (first name + last name)
export function EnvatoLowerThirdCompact({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const fullNom = fields.nom || 'EMIL KOWALSKI';
  const parts = fullNom.split(' ');
  const firstName = parts[0] || 'EMIL';
  const lastName = parts.slice(1).join(' ') || '';
  const colorMain = fields.colorMain || '#fcfcfc';
  const colorTextFirst = fields.colorTextFirst || '#111111';
  const colorTextLast = fields.colorTextLast || '#666666';

  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outY = isOut ? (outEase * 40) : 0;
  const outOpacity = isOut ? (1 - outEase) : 1;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: 80,
      display: 'flex',
      transform: `translateY(${outY}px)`,
      opacity: outOpacity,
      willChange: 'transform, opacity'
    }}>
      <EnvatoMaskReveal frame={frame} delay={5} direction="right" duration={25}>
        <div style={{
          backgroundColor: colorMain,
          padding: '16px 32px',
          display: 'flex',
          gap: '12px',
          boxShadow: '4px 8px 24px rgba(0,0,0,0.1)'
        }}>
          <EnvatoMaskReveal frame={frame} delay={15} direction="bottom" duration={20}>
            <div style={{ ...baseFontConfig, fontSize: '48px', color: colorTextFirst, fontWeight: '900', letterSpacing: '-1px' }}>
              {firstName}
            </div>
          </EnvatoMaskReveal>
          <EnvatoMaskReveal frame={frame} delay={18} direction="bottom" duration={20}>
            <div style={{ ...baseFontConfig, fontSize: '48px', color: colorTextLast, fontWeight: '400', letterSpacing: '-0.5px' }}>
              {lastName}
            </div>
          </EnvatoMaskReveal>
        </div>
      </EnvatoMaskReveal>
    </div>
  );
}

// 2. 2-line corporate structure with offset masks
export function EnvatoLowerThirdDuoCorporate({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const name = fields.nom || 'MICHAEL SCOTT';
  const title = fields.fonction || 'REGIONAL MANAGER';
  const colorTop = fields.colorMain || '#0047AB'; // Corporate Blue
  const colorBottom = fields.colorBg || '#fcfcfc';
  const colorTextTop = fields.colorTextMain || '#ffffff';
  const colorTextBottom = fields.colorTextAccent || '#111111';

  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outY = isOut ? (outEase * 40) : 0;
  const outOpacity = isOut ? (1 - outEase) : 1;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: 80,
      display: 'flex',
      flexDirection: 'column',
      transform: `translateY(${outY}px)`,
      opacity: outOpacity,
      willChange: 'transform, opacity'
    }}>
      {/* Top Box */}
      <EnvatoMaskReveal frame={frame} delay={5} direction="right" duration={25} style={{ zIndex: 2 }}>
        <div style={{
          backgroundColor: colorTop,
          padding: '16px 32px',
          boxShadow: '4px 4px 16px rgba(0,0,0,0.2)'
        }}>
          <EnvatoMaskReveal frame={frame} delay={15} direction="bottom" duration={20}>
            <div style={{ ...baseFontConfig, fontSize: '42px', color: colorTextTop, fontWeight: '800', letterSpacing: '0px' }}>
              {name}
            </div>
          </EnvatoMaskReveal>
        </div>
      </EnvatoMaskReveal>
      {/* Bottom Box offset */}
      <EnvatoMaskReveal frame={frame} delay={12} direction="left" duration={25} style={{ zIndex: 1, marginTop: '-2px', alignSelf: 'flex-start' }}>
        <div style={{
          backgroundColor: colorBottom,
          padding: '12px 32px',
          marginLeft: '20px', // The corporate offset look
          boxShadow: '4px 4px 16px rgba(0,0,0,0.1)'
        }}>
          <EnvatoMaskReveal frame={frame} delay={22} direction="top" duration={20}>
            <div style={{ ...baseFontConfig, fontSize: '24px', color: colorTextBottom, fontWeight: '600', letterSpacing: '2px' }}>
              {title}
            </div>
          </EnvatoMaskReveal>
        </div>
      </EnvatoMaskReveal>
    </div>
  );
}

// 3. Double side-by-side band to show who talks to who (left: interviewer, right: interviewee)
export function EnvatoLowerThirdInterview({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const leftName = fields.leftName || 'JANE DOE';
  const leftRole = fields.leftRole || 'HOST';
  const rightName = fields.rightName || 'JOHN SMITH';
  const rightRole = fields.rightRole || 'GUEST';
  const colorBg = fields.colorBg || '#111111';
  const colorMain = fields.colorMain || '#d61f1f';
  const colorAccent = fields.colorAccent || '#fcfcfc';
  const colorTextMain = fields.colorTextMain || '#ffffff';
  const colorTextAccent = fields.colorTextAccent || '#111111';

  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outY = isOut ? (outEase * 40) : 0;
  const outOpacity = isOut ? (1 - outEase) : 1;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0 80px',
      boxSizing: 'border-box',
      transform: `translateY(${outY}px)`,
      opacity: outOpacity,
      willChange: 'transform, opacity'
    }}>
      {/* Left Interviewer */}
      <EnvatoMaskReveal frame={frame} delay={5} direction="right" duration={25}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ backgroundColor: colorBg, padding: '12px 24px', boxShadow: '4px 4px 12px rgba(0,0,0,0.3)' }}>
            <EnvatoMaskReveal frame={frame} delay={15} direction="bottom" duration={20}>
               <div style={{ ...baseFontConfig, fontSize: '36px', color: colorTextMain }}>{leftName}</div>
            </EnvatoMaskReveal>
          </div>
          <div style={{ backgroundColor: colorAccent, padding: '8px 24px', marginTop: '-2px', boxShadow: '2px 2px 8px rgba(0,0,0,0.1)' }}>
            <EnvatoMaskReveal frame={frame} delay={20} direction="bottom" duration={20}>
               <div style={{ ...baseFontConfig, fontSize: '18px', color: colorTextAccent, letterSpacing: '2px' }}>{leftRole}</div>
            </EnvatoMaskReveal>
          </div>
        </div>
      </EnvatoMaskReveal>

      {/* Right Interviewee */}
      <EnvatoMaskReveal frame={frame} delay={10} direction="left" duration={25}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: colorMain, padding: '12px 24px', boxShadow: '-4px 4px 12px rgba(0,0,0,0.3)' }}>
            <EnvatoMaskReveal frame={frame} delay={20} direction="bottom" duration={20}>
               <div style={{ ...baseFontConfig, fontSize: '36px', color: colorTextMain }}>{rightName}</div>
            </EnvatoMaskReveal>
          </div>
          <div style={{ backgroundColor: colorAccent, padding: '8px 24px', marginTop: '-2px', boxShadow: '-2px 2px 8px rgba(0,0,0,0.1)' }}>
            <EnvatoMaskReveal frame={frame} delay={25} direction="bottom" duration={20}>
               <div style={{ ...baseFontConfig, fontSize: '18px', color: colorTextAccent, letterSpacing: '2px' }}>{rightRole}</div>
            </EnvatoMaskReveal>
          </div>
        </div>
      </EnvatoMaskReveal>
    </div>
  );
}

// 4. A sleek top-left location pin animation with text (e.g. "Paris, France")
export function EnvatoLocationPin({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const location = fields.location || 'PARIS, FRANCE';
  const colorBg = fields.colorBg || '#111111';
  const colorMain = fields.colorMain || '#fcfcfc';
  const colorTextMain = fields.colorTextMain || '#fcfcfc';
  const colorTextAccent = fields.colorTextAccent || '#111111';
  
  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outY = isOut ? -(outEase * 40) : 0;
  const outOpacity = isOut ? (1 - outEase) : 1;

  return (
    <div style={{
      position: 'absolute',
      top: 60,
      left: 60,
      display: 'flex',
      alignItems: 'center',
      transform: `translateY(${outY}px)`,
      opacity: outOpacity,
      willChange: 'transform, opacity'
    }}>
      <EnvatoMaskReveal frame={frame} delay={5} direction="bottom" duration={20} style={{ zIndex: 2 }}>
        <div style={{
          backgroundColor: colorMain,
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colorTextAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      </EnvatoMaskReveal>

      <EnvatoMaskReveal frame={frame} delay={15} direction="right" duration={25} style={{ zIndex: 1, marginLeft: '-16px' }}>
        <div style={{
          backgroundColor: colorBg,
          padding: '12px 24px 12px 32px',
          borderRadius: '0 24px 24px 0',
          boxShadow: '4px 4px 12px rgba(0,0,0,0.2)'
        }}>
          <EnvatoMaskReveal frame={frame} delay={25} direction="bottom" duration={20}>
            <div style={{ ...baseFontConfig, fontSize: '20px', color: colorTextMain, letterSpacing: '1px' }}>
              {location}
            </div>
          </EnvatoMaskReveal>
        </div>
      </EnvatoMaskReveal>
    </div>
  );
}

// 5. A huge quote block overlay with animated quotation marks
export function EnvatoQuoteBlock({ overlay, durationInFrames }) {
  const frame = useCurrentFrame();
  const fields = overlay?.fields || {};
  const quote = fields.quote || 'DESIGN IS NOT JUST WHAT IT LOOKS LIKE. DESIGN IS HOW IT WORKS.';
  const author = fields.author || 'STEVE JOBS';
  const colorBg = fields.colorBg || '#111111';
  const colorMain = fields.colorMain || '#d61f1f';
  const colorTextMain = fields.colorTextMain || '#ffffff';

  const OUT_DUR = 30;
  const isOut = frame > durationInFrames - OUT_DUR;
  const outFrame = isOut ? frame - (durationInFrames - OUT_DUR) : 0;
  const outEase = getExpEaseOut(outFrame, 0, 20);
  const outScale = isOut ? 1 - (outEase * 0.05) : 1;
  const outOpacity = isOut ? (1 - outEase) : 1;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: `translate(-50%, -50%) scale(${outScale})`,
      opacity: outOpacity,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '70%',
      textAlign: 'center',
      willChange: 'transform, opacity'
    }}>
      <EnvatoMaskReveal frame={frame} delay={5} direction="vertical" duration={35}>
        <div style={{ 
          position: 'relative', 
          padding: '60px 80px', 
          backgroundColor: colorBg, 
          borderLeft: `8px solid ${colorMain}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
        }}>
          {/* Huge Quote Mark Background */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '40px',
            fontSize: '180px',
            color: 'rgba(255,255,255,0.05)',
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
            zIndex: 0,
            pointerEvents: 'none'
          }}>
            “
          </div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <EnvatoMaskReveal frame={frame} delay={15} direction="right" duration={35}>
              <div style={{ ...baseFontConfig, fontSize: '50px', color: colorTextMain, lineHeight: '1.2', textTransform: 'none', fontWeight: '700' }}>
                "{quote}"
              </div>
            </EnvatoMaskReveal>
            
            <EnvatoMaskReveal frame={frame} delay={30} direction="right" duration={25}>
              <div style={{ ...baseFontConfig, fontSize: '24px', color: colorMain, letterSpacing: '4px', marginTop: '30px' }}>
                — {author}
              </div>
            </EnvatoMaskReveal>
          </div>
        </div>
      </EnvatoMaskReveal>
    </div>
  );
}
