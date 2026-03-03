import React, { useEffect, useRef } from 'react';

/**
 * @typedef {'diagonal' | 'arc' | 'wave' | 'straight'} TrajectoryType
 */

/**
 * @typedef {Object} UnicornSpriteProps
 * @property {string} id - Unique identifier for the unicorn
 * @property {number} startX - Starting X position in pixels
 * @property {number} startY - Starting Y position in pixels
 * @property {number} duration - Animation duration in seconds
 * @property {number} delay - Delay before animation starts in milliseconds
 * @property {TrajectoryType} trajectory - The flight path type
 * @property {string} [emoji] - Optional emoji to display (defaults to 🦄)
 * @property {(id: string) => void} onAnimationEnd - Callback when animation completes
 */

/**
 * UNICORN SPRITE COMPONENT
 * Individual animated emoji element
 * Uses emoji (🦄, 🦋, 🐲) for quick implementation
 * Structured to allow easy image swapping later
 * 
 * @param {UnicornSpriteProps} props
 */
export default function UnicornSprite({ 
  id, 
  startX, 
  startY, 
  duration, 
  delay, 
  trajectory,
  emoji = '🦄',
  onAnimationEnd 
}) {
  const unicornRef = useRef(null);

  useEffect(() => {
    // Set up animation end handler
    const element = unicornRef.current;
    if (!element) return;

    const handleAnimationEnd = () => {
      if (onAnimationEnd) {
        onAnimationEnd(id);
      }
    };

    element.addEventListener('animationend', handleAnimationEnd);

    return () => {
      element.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [id, onAnimationEnd]);

  const style = {
    position: 'fixed',
    left: `${startX}px`,
    top: `${startY}px`,
    fontSize: '3rem',
    pointerEvents: 'none',
    zIndex: 9999,
    animation: `unicorn-${trajectory} ${duration}s ease-in-out ${delay}ms forwards`,
    willChange: 'transform, opacity'
  };

  return (
    <div 
      ref={unicornRef}
      className={`unicorn-sprite trajectory-${trajectory}`}
      style={style}
    >
      {emoji}
    </div>
  );
}
