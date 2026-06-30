import { spring, interpolate } from 'remotion';

export const PER_CHAR = new Set(['cascade', 'charpop', 'wave', 'typewriter', 'typewriter_out', 'kinetic_type']);

export function entranceStyle(overlay, frame, fps, durationInFrames = 300) {
  const animIn = overlay.animation || 'mask_reveal';
  const animLoop = overlay.animationLoop || 'none';
  const animOut = overlay.animationOut || 'fade';
  
  const OUT_DUR = 30; // 1 second out animation
  const IN_DUR = 45; // slightly longer for modern eases
  
  let opacity = 1;
  let transform = '';
  let filter = '';
  let clipPath = '';
  let letterSpacing = '';
  let textShadow = '';
  let fontWeight = undefined;
  let fontVariationSettings = '';
  
  // Custom spring configurations for high-end feel
  const springSnappy = (f) => spring({ frame: f, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
  const springSmooth = (f) => spring({ frame: f, fps, config: { damping: 18, stiffness: 80, mass: 1 } });
  
  // -- IN PHASE --
  if (frame < IN_DUR) {
    const f = Math.max(0, frame);
    const op = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
    
    switch (animIn) {
      case 'fade': 
        opacity = op; 
        break;
      case 'scale': {
        const s = interpolate(springSmooth(f), [0, 1], [0.85, 1]);
        opacity = op; transform = `scale(${s})`;
        break;
      }
      case 'pop': {
        const s = springSnappy(f);
        opacity = op; transform = `scale(${interpolate(s, [0, 1], [0.8, 1])})`;
        break;
      }
      case 'mask_reveal': {
        // Modern After Effects style mask reveal
        const p = interpolate(springSmooth(f), [0, 1], [100, 0]);
        const y = interpolate(springSmooth(f), [0, 1], [40, 0]);
        opacity = 1; 
        clipPath = `inset(${p}% 0 0 0)`;
        transform = `translateY(${y}px)`;
        break;
      }
      case 'skew_slide': {
        // High energy sports/news slide
        const x = interpolate(springSnappy(f), [0, 1], [-100, 0]);
        const sk = interpolate(springSnappy(f), [0, 1], [15, 0]);
        opacity = op;
        transform = `translateX(${x}%) skewX(${sk}deg)`;
        break;
      }
      case 'parallax_drift': {
        // Slow cinematic drift
        const x = interpolate(springSmooth(f), [0, 1], [20, 0]);
        opacity = op;
        transform = `translateX(${x}px)`;
        break;
      }
      case 'blurin': {
        const b = interpolate(f, [0, 20], [12, 0], { extrapolateRight: 'clamp' });
        opacity = op; filter = `blur(${b}px)`;
        break;
      }
      default: 
        opacity = op; 
    }
  } 
  // -- OUT PHASE --
  else if (frame > durationInFrames - OUT_DUR) {
    const fOut = frame - (durationInFrames - OUT_DUR);
    const opOut = interpolate(fOut, [OUT_DUR - 15, OUT_DUR], [1, 0], { extrapolateLeft: 'clamp' });
    
    switch (animOut) {
      case 'fade': opacity = opOut; break;
      case 'scale_down': {
        const s = interpolate(fOut, [0, OUT_DUR], [1, 0.9]);
        opacity = opOut; transform = `scale(${s})`;
        break;
      }
      case 'slide_out': {
        const x = interpolate(fOut, [0, OUT_DUR], [0, 100]); // slide right out
        opacity = opOut; transform = `translateX(${x}%) skewX(-5deg)`;
        break;
      }
      case 'mask_hide': {
        const p = interpolate(fOut, [0, OUT_DUR], [0, 100]);
        const y = interpolate(fOut, [0, OUT_DUR], [0, -40]);
        opacity = 1; 
        clipPath = `inset(0 0 ${p}% 0)`;
        transform = `translateY(${y}px)`;
        break;
      }
      case 'blurout': {
        const b = interpolate(fOut, [0, OUT_DUR], [0, 12]);
        opacity = opOut; filter = `blur(${b}px)`;
        break;
      }
      default: opacity = opOut;
    }
  }
  // -- LOOP PHASE --
  else {
    switch (animLoop) {
      case 'float': {
        const y = Math.sin(frame * 0.05) * 5;
        transform = `translateY(${y}px)`;
        break;
      }
      case 'pulse': {
        const s = 1 + Math.sin(frame * 0.05) * 0.02;
        transform = `scale(${s})`;
        break;
      }
      case 'drifting': {
        const x = Math.sin(frame * 0.02) * 10;
        transform = `translateX(${x}px)`;
        break;
      }
      default: break;
    }
  }

  // Combine styles
  const style = { opacity, display: 'inline-block', willChange: 'transform, opacity, clip-path, filter' };
  if (transform) style.transform = transform;
  if (filter) style.filter = filter;
  if (clipPath) style.clipPath = clipPath;
  if (letterSpacing) style.letterSpacing = letterSpacing;
  if (textShadow) style.textShadow = textShadow;
  if (fontWeight) style.fontWeight = fontWeight;
  if (fontVariationSettings) style.fontVariationSettings = fontVariationSettings;
  
  return style;
}

export function charStyle(overlay, frame, fps, durationInFrames = 300, i, totalChars) {
  const animIn = overlay.animation || 'cascade';
  const animOut = overlay.animationOut || 'fade';
  
  const OUT_DUR = 30; 
  let opacity = 1;
  let transform = '';
  let filter = '';
  
  // IN PHASE
  if (frame < 120 && PER_CHAR.has(animIn)) { 
    if (animIn === 'typewriter') {
      const delay = i * 2; 
      opacity = frame >= delay ? 1 : 0;
    }
    else if (animIn === 'cascade') {
      const delay = i * 1.5;
      const f = Math.max(0, frame - delay);
      const sp = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
      opacity = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
      const y = interpolate(sp, [0, 1], [30, 0]);
      transform = `translateY(${y}px)`;
    }
    else if (animIn === 'charpop') {
      const delay = i * 1.5;
      const f = Math.max(0, frame - delay);
      const sp = spring({ frame: f, fps, config: { damping: 12, stiffness: 150 } });
      opacity = interpolate(f, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
      const s = interpolate(sp, [0, 1], [0, 1]);
      transform = `scale(${s})`;
    }
    else if (animIn === 'kinetic_type') {
      // AE style kinetic type: slides up from mask with a slight blur
      const delay = i * 1.2;
      const f = Math.max(0, frame - delay);
      const sp = spring({ frame: f, fps, config: { damping: 16, stiffness: 100 } });
      opacity = interpolate(f, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
      const y = interpolate(sp, [0, 1], [40, 0]);
      const rot = interpolate(sp, [0, 1], [15, 0]);
      const blur = interpolate(f, [0, 8], [8, 0], { extrapolateRight: 'clamp' });
      transform = `translateY(${y}px) rotateX(${rot}deg)`;
      filter = `blur(${blur}px)`;
    }
  } 
  // OUT PHASE
  else if (frame > durationInFrames - OUT_DUR && PER_CHAR.has(animOut)) {
    if (animOut === 'typewriter_out') {
      const fOut = frame - (durationInFrames - OUT_DUR);
      const reverseIdx = totalChars - 1 - i;
      const delay = reverseIdx * 1.5;
      opacity = fOut >= delay ? 0 : 1;
    }
  }
  
  const style = { display: 'inline-block', opacity, willChange: 'transform, opacity, filter' };
  if (transform) style.transform = transform;
  if (filter) style.filter = filter;
  
  return style;
}
