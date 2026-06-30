import { spring, interpolate } from 'remotion';
import React from 'react';

// Premium spring configurations based on Emil's design engineering philosophy
export const SPRINGS = {
  snappy: { damping: 15, stiffness: 150, mass: 0.8 },
  smooth: { damping: 20, stiffness: 80, mass: 1 },
  bouncy: { damping: 12, stiffness: 130, mass: 1 },
};

/**
 * Reusable math primitive for standard Envato broadcast ease-out dynamics.
 * We want a fast, snappy entrance that settles nicely without oscillating.
 */
export function getEnvatoSpring(frame, fps, delay = 0, type = 'snappy') {
  const f = Math.max(0, frame - delay);
  return spring({
    frame: f,
    fps,
    config: SPRINGS[type] || SPRINGS.snappy,
  });
}

/**
 * Get an exponential ease-out value for clip-paths (Emil recommends no bounce for mask wipes).
 */
export function getExpEaseOut(frame, delay = 0, duration = 25) {
  const f = Math.max(0, frame - delay);
  if (f >= duration) return 1;
  // exponential ease-out curve equivalent: 1 - Math.pow(1 - t, 5)
  const t = f / duration;
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Standard mask wipe for premium text or box reveal.
 * Text stays stationary while the clip-path inset animates from 100% to 0%.
 * Using an exponential ease-out curve instead of a spring to avoid clip-path bounce.
 */
export function EnvatoMaskReveal({ children, frame, delay = 0, direction = 'right', duration = 25, style = {}, as: Component = 'div' }) {
  const ease = getExpEaseOut(frame, delay, duration);
  const progress = interpolate(ease, [0, 1], [100, 0]); // 100% clipped to 0% clipped

  let clipPath;
  switch (direction) {
    case 'right':
      clipPath = `inset(0 ${progress}% 0 0)`; // Reveals left to right
      break;
    case 'left':
      clipPath = `inset(0 0 0 ${progress}%)`; // Reveals right to left
      break;
    case 'bottom':
      clipPath = `inset(0 0 ${progress}% 0)`; // Reveals top to bottom
      break;
    case 'top':
      clipPath = `inset(${progress}% 0 0 0)`; // Reveals bottom to top
      break;
    case 'horizontal':
      clipPath = `inset(0 ${progress/2}% 0 ${progress/2}%)`; // Centers out
      break;
    case 'vertical':
      clipPath = `inset(${progress/2}% 0 ${progress/2}% 0)`; // Centers out vertically
      break;
    default:
      clipPath = `inset(0 ${progress}% 0 0)`;
  }

  return (
    <Component style={{ clipPath, willChange: 'clip-path', ...style }}>
      {children}
    </Component>
  );
}
