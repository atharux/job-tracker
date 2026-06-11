import React, { useEffect, useRef } from 'react';

/**
 * DATA NODE — replaces the flying unicorn sprite.
 * Renders a small glowing glyph that rises and fades.
 * API is intentionally identical to the old UnicornSprite so
 * CelebrationAnimation needs no changes.
 */
export default function UnicornSprite({
  id,
  startX,
  startY,
  duration,
  delay,
  trajectory,
  emoji = '◆',
  onAnimationEnd,
}) {
  const nodeRef = useRef(null);

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const handle = () => { if (onAnimationEnd) onAnimationEnd(id); };
    el.addEventListener('animationend', handle);
    return () => el.removeEventListener('animationend', handle);
  }, [id, onAnimationEnd]);

  // Vary drift direction slightly per trajectory type so higher tiers
  // feel more kinetic without being chaotic.
  const driftMap = {
    diagonal: 40,
    arc: -30,
    wave: 20,
    straight: 0,
  };
  const baseDrift = driftMap[trajectory] ?? 0;
  const drift = baseDrift + (Math.random() - 0.5) * 40;

  const style = {
    position: 'fixed',
    left: `${startX}px`,
    top: `${startY}px`,
    fontFamily: "'Space Mono', monospace",
    fontSize: '13px',
    fontWeight: 700,
    color: '#06b6d4',
    textShadow: '0 0 8px rgba(6,182,212,0.9), 0 0 20px rgba(6,182,212,0.4)',
    pointerEvents: 'none',
    zIndex: 9999,
    userSelect: 'none',
    '--node-drift': `${drift}px`,
    animation: `node-rise ${duration}s ease-out ${delay}ms forwards`,
    willChange: 'transform, opacity',
  };

  return (
    <div ref={nodeRef} className="unicorn-sprite" style={style}>
      {emoji}
    </div>
  );
}
