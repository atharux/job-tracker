import React, { useEffect, useState } from 'react';

/**
 * MILESTONE TOAST COMPONENT
 * Presentational only - receives props, renders animation, auto-dismisses
 * Zero coupling to App state or gamification engine
 */

export default function MilestoneToast({ milestone, onDismiss }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 4000);

    // Generate particles for rank-up tier only
    if (milestone.tier === 'rank-up') {
      const particleArray = [];
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const distance = 80 + Math.random() * 40;
        particleArray.push({
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          delay: i * 0.05,
        });
      }
      setParticles(particleArray);
    }

    return () => clearTimeout(timer);
  }, [milestone, onDismiss]);

  const getIcon = () => {
    switch (milestone.tier) {
      case 'rank-up':
        return '🏆';
      case 'achievement':
        return '🎯';
      case 'standard':
        return '✨';
      default:
        return '✅';
    }
  };

  return (
    <div className={`milestone-toast tier-${milestone.tier}`}>
      {milestone.tier === 'rank-up' && (
        <div className="milestone-particles">
          {particles.map(p => (
            <div
              key={p.id}
              className="milestone-particle"
              style={{
                left: '50%',
                top: '50%',
                '--particle-x': `${p.x}px`,
                '--particle-y': `${p.y}px`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}
      
      <div className="milestone-toast-icon">
        {getIcon()}
      </div>
      
      <div className="milestone-toast-content">
        <div className="milestone-toast-title">
          {milestone.title}
        </div>
        <div className="milestone-toast-message">
          {milestone.message}
        </div>
      </div>
    </div>
  );
}
