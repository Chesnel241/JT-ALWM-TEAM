import { spring, interpolate } from 'remotion';

export const PER_CHAR = new Set(['cascade', 'charpop', 'wave', 'typewriter', 'typewriter_out']);

export function entranceStyle(overlay, frame, fps, durationInFrames = 300) {
  const animIn = overlay.animation || 'fade';
  const animLoop = overlay.animationLoop || 'none';
  const animOut = overlay.animationOut || 'fade';
  
  const OUT_DUR = 30; // 1 second out animation
  const IN_DUR = 30; // 1 second in animation
  
  let opacity = 1;
  let transform = '';
  let filter = '';
  let clipPath = '';
  let letterSpacing = '';
  let textShadow = '';
  let fontWeight = undefined;
  let fontVariationSettings = '';
  let strokeWidth = '';
  let strokeColor = '';
  let fillColor = '';
  
  // -- IN PHASE (frame 0 to IN_DUR) --
  if (frame < IN_DUR) {
    const f = Math.max(0, frame);
    const sp = (cfg) => spring({ frame: f, fps, config: cfg });
    const op = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
    
    switch (animIn) {
      case 'fade': opacity = op; break;
      case 'scale': {
        const s = interpolate(sp({ damping: 12 }), [0, 1], [0.4, 1]);
        opacity = op; transform = `scale(${s})`;
        break;
      }
      case 'pop': {
        const s = sp({ damping: 9, stiffness: 140 });
        opacity = op; transform = `scale(${interpolate(s, [0, 1], [0.2, 1])})`;
        break;
      }
      case 'bounce': {
        const s = spring({ frame: f, fps, config: { damping: 6, stiffness: 120 } });
        opacity = op; transform = `translateY(${interpolate(s, [0, 1], [-40, 0])}px)`;
        break;
      }
      case 'blurin': {
        const b = interpolate(f, [0, 15], [8, 0], { extrapolateRight: 'clamp' });
        opacity = op; filter = `blur(${b}px)`;
        break;
      }
      case 'rotate': {
        const r = interpolate(sp({ damping: 12 }), [0, 1], [-12, 0]);
        opacity = op; transform = `rotate(${r}deg)`;
        break;
      }
      case 'flip3d': {
        const r = interpolate(sp({ damping: 14 }), [0, 1], [90, 0]);
        opacity = op; transform = `perspective(800px) rotateY(${r}deg)`;
        break;
      }
      case 'rotatex': {
        const r = interpolate(sp({ damping: 14 }), [0, 1], [-60, 0]);
        opacity = op; transform = `perspective(800px) rotateX(${r}deg)`;
        break;
      }
      case 'rotatey': {
        const r = interpolate(sp({ damping: 14 }), [0, 1], [-60, 0]);
        opacity = op; transform = `perspective(800px) rotateY(${r}deg)`;
        break;
      }
      case 'mask_reveal': {
        const p = interpolate(f, [0, 18], [100, 0], { extrapolateRight: 'clamp' });
        opacity = 1; clipPath = `inset(0 ${p}% 0 0)`;
        break;
      }
      case 'outline_morph': {
        const fill = interpolate(f, [6, 22], [0, 1], { extrapolateRight: 'clamp' });
        const op2 = interpolate(f, [0, 4], [0, 1], { extrapolateRight: 'clamp' });
        opacity = op2;
        strokeWidth = '2px';
        strokeColor = 'currentColor';
        fillColor = `rgba(255,255,255,${fill})`;
        break;
      }
      case 'letterspread': {
        const ls = interpolate(sp({ damping: 18 }), [0, 1], [0.35, 0]);
        opacity = op; letterSpacing = `${ls}em`;
        break;
      }
      case 'weight_pulse': {
        const w = interpolate(Math.sin((f / fps) * Math.PI * 2), [-1, 1], [500, 900]);
        opacity = op; fontVariationSettings = `"wght" ${w}`; fontWeight = Math.round(w);
        break;
      }
      case 'kerning_shake': {
        const k = (Math.sin(f * 0.8) + Math.sin(f * 1.3)) * 0.02;
        opacity = op; letterSpacing = `${k}em`;
        break;
      }
      case 'glitch_in': {
        const settled = f > 8;
        const o = settled ? 0 : (Math.sin(f * 7.3) * 12);
        const skew = settled ? 0 : (Math.cos(f * 5.1) * 3);
        opacity = op;
        transform = `translateX(${o}px) skewX(${skew}deg)`;
        if (!settled) textShadow = `2px 0 #f0f, -2px 0 #0ff`;
        break;
      }
      case 'neon_on': {
        const isFlickering = f < 20 && Math.random() > 0.5;
        opacity = isFlickering ? 0.3 : 1;
        if (!isFlickering) textShadow = `0 0 10px currentColor, 0 0 20px currentColor, 0 0 40px currentColor`;
        break;
      }
      default: opacity = op; // including per-char anims handled by charStyle
    }
  } 
  // -- OUT PHASE (frame > durationInFrames - OUT_DUR) --
  else if (frame > durationInFrames - OUT_DUR) {
    const fOut = frame - (durationInFrames - OUT_DUR);
    const opOut = interpolate(fOut, [OUT_DUR - 8, OUT_DUR], [1, 0], { extrapolateLeft: 'clamp' });
    switch (animOut) {
      case 'fade': opacity = opOut; break;
      case 'scale_down': {
        const s = interpolate(fOut, [0, OUT_DUR], [1, 0.4]);
        opacity = opOut; transform = `scale(${s})`;
        break;
      }
      case 'slide_out': {
        const x = interpolate(fOut, [0, OUT_DUR], [0, -100]);
        opacity = opOut; transform = `translateX(${x}%)`;
        break;
      }
      case 'blurout': {
        const b = interpolate(fOut, [0, OUT_DUR], [0, 8]);
        opacity = opOut; filter = `blur(${b}px)`;
        break;
      }
      case 'glitch_out': {
        const isGlitch = fOut > OUT_DUR - 10;
        const o = isGlitch ? (Math.sin(fOut * 7.3) * 12) : 0;
        const skew = isGlitch ? (Math.cos(fOut * 5.1) * 3) : 0;
        opacity = opOut;
        transform = `translateX(${o}px) skewX(${skew}deg)`;
        if (isGlitch) textShadow = `2px 0 #f0f, -2px 0 #0ff`;
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
      case 'neon_flicker': {
        if (Math.random() > 0.95) opacity = 0.5;
        textShadow = `0 0 10px currentColor, 0 0 20px currentColor`;
        break;
      }
      case 'kerning_shake': {
        const k = (Math.sin(frame * 0.8) + Math.sin(frame * 1.3)) * 0.02;
        letterSpacing = `${k}em`;
        break;
      }
      default: break;
    }
  }

  // Combine styles
  const style = { opacity, display: 'inline-block' };
  if (transform) style.transform = transform;
  if (filter) style.filter = filter;
  if (clipPath) style.clipPath = clipPath;
  if (letterSpacing) style.letterSpacing = letterSpacing;
  if (textShadow) style.textShadow = textShadow;
  if (fontWeight) style.fontWeight = fontWeight;
  if (fontVariationSettings) style.fontVariationSettings = fontVariationSettings;
  if (strokeWidth) {
    style.WebkitTextStrokeWidth = strokeWidth;
    style.WebkitTextStrokeColor = strokeColor;
    style.WebkitTextFillColor = fillColor;
  }
  
  return style;
}

export function charStyle(overlay, frame, fps, durationInFrames = 300, i, totalChars) {
  const animIn = overlay.animation || 'fade';
  const animOut = overlay.animationOut || 'fade';
  
  const OUT_DUR = 30; // 1 sec out
  
  let opacity = 1;
  let transform = '';
  
  // IN PHASE
  if (frame < 90 && PER_CHAR.has(animIn)) { // Allow longer for per-char
    if (animIn === 'typewriter') {
      const delay = i * 2; // 2 frames per char
      opacity = frame >= delay ? 1 : 0;
    }
    else if (animIn === 'cascade') {
      const delay = i * 1.5;
      const f = Math.max(0, frame - delay);
      const sp = spring({ frame: f, fps, config: { damping: 10, stiffness: 100 } });
      opacity = interpolate(f, [0, 4], [0, 1], { extrapolateRight: 'clamp' });
      const y = interpolate(sp, [0, 1], [30, 0]);
      transform = `translateY(${y}px)`;
    }
    else if (animIn === 'charpop') {
      const delay = i * 1.5;
      const f = Math.max(0, frame - delay);
      const sp = spring({ frame: f, fps, config: { damping: 8, stiffness: 150 } });
      opacity = interpolate(f, [0, 3], [0, 1], { extrapolateRight: 'clamp' });
      const s = interpolate(sp, [0, 1], [0.1, 1]);
      transform = `scale(${s})`;
    }
    else if (animIn === 'wave') {
      const delay = i * 1;
      const f = Math.max(0, frame - delay);
      opacity = interpolate(f, [0, 4], [0, 1], { extrapolateRight: 'clamp' });
      const y = interpolate(Math.sin(f * 0.2), [-1, 1], [-10, 10]);
      transform = `translateY(${f < 15 ? y : 0}px)`; // stops waving after 15 frames
    }
  } 
  // OUT PHASE
  else if (frame > durationInFrames - OUT_DUR && PER_CHAR.has(animOut)) {
    if (animOut === 'typewriter_out') {
      // disappears from last to first
      const fOut = frame - (durationInFrames - OUT_DUR);
      const reverseIdx = totalChars - 1 - i;
      const delay = reverseIdx * 2;
      opacity = fOut >= delay ? 0 : 1;
    }
  }
  
  const style = { display: 'inline-block', opacity };
  if (transform) style.transform = transform;
  
  return style;
}
