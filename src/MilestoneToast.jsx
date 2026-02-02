import React, { useEffect } from 'react';

export default function MilestoneToast({ milestone, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!milestone) return null;

  return (
    <div className={`milestone-toast tier-${milestone.tier}`}>
      {milestone.tier === 'rank-up' && (
        <div className="milestone-particles">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="milestone-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                '--particle-x': `${(Math.random() - 0.5) * 120}px`,
                '--particle-y': `${-Math.random() * 140}px`,
              }}
            />
          ))}
        </div>
      )}

      <div className="milestone-toast-content">
        <div className="milestone-toast-title">{milestone.title}</div>
        <div className="milestone-toast-message">{milestone.message}</div>
      </div>
    </div>
  );
}
