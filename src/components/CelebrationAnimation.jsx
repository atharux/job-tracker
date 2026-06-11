import React, { useEffect, useState, useCallback } from 'react';
import UnicornSprite from './UnicornSprite';

/**
 * @typedef {'rank-up' | 'achievement' | 'standard'} MilestoneTier
 */

/**
 * @typedef {Object} Milestone
 * @property {string} type - The type of milestone (e.g., 'RANK_UP', 'ACHIEVEMENT')
 * @property {MilestoneTier} tier - The importance level of the milestone
 * @property {string} title - The display title of the milestone
 * @property {string} message - The descriptive message for the milestone
 */

/**
 * @typedef {Object} CelebrationAnimationProps
 * @property {Milestone} milestone - The milestone that triggered the celebration
 * @property {string} [emoji] - Optional symbol override
 * @property {() => void} onComplete - Callback invoked when animation completes
 */

/**
 * @typedef {'diagonal' | 'arc' | 'wave' | 'straight'} TrajectoryType
 */

/**
 * @typedef {Object} CelebrationConfig
 * @property {number} unicornCount - Number of nodes to spawn (3–8)
 * @property {number} duration - Duration of each node animation in seconds
 * @property {number} spawnInterval - Time between node spawns in milliseconds
 * @property {TrajectoryType[]} trajectories - Available trajectory types for this tier
 */

/**
 * Get celebration configuration based on milestone tier
 * @param {MilestoneTier} tier
 * @returns {CelebrationConfig}
 */
function getCelebrationConfig(tier) {
  switch (tier) {
    case 'rank-up':
      return {
        unicornCount: 8,
        duration: 4,
        spawnInterval: 200,
        trajectories: ['diagonal', 'arc', 'wave', 'straight']
      };
    case 'achievement':
      return {
        unicornCount: 5,
        duration: 3,
        spawnInterval: 250,
        trajectories: ['diagonal', 'arc']
      };
    case 'standard':
    default:
      return {
        unicornCount: 3,
        duration: 2.5,
        spawnInterval: 300,
        trajectories: ['straight', 'diagonal']
      };
  }
}

/** Map tier → terminal glyph */
function symbolForTier(tier) {
  switch (tier) {
    case 'rank-up':    return '▲';
    case 'achievement': return '◆';
    default:            return '→';
  }
}

/**
 * CELEBRATION ANIMATION COMPONENT
 * Spawns rising data-node particles when milestones are achieved.
 * Tier determines count, duration, and spawn cadence.
 */
export default function CelebrationAnimation({ milestone, emoji, onComplete }) {
  const [unicorns, setUnicorns] = useState([]);

  const handleUnicornComplete = useCallback((id) => {
    setUnicorns(prev => prev.filter(u => u.id !== id));
  }, []);

  useEffect(() => {
    const config = getCelebrationConfig(milestone.tier);
    const symbol = emoji ?? symbolForTier(milestone.tier);
    const newUnicorns = [];

    for (let i = 0; i < config.unicornCount; i++) {
      const trajectory = config.trajectories[i % config.trajectories.length];
      newUnicorns.push({
        id: `node-${Date.now()}-${i}`,
        startX: Math.random() * window.innerWidth,
        // Spawn from bottom third so nodes visibly rise upward
        startY: window.innerHeight * (0.65 + Math.random() * 0.2),
        duration: config.duration,
        delay: i * config.spawnInterval,
        trajectory,
        symbol,
      });
    }

    setUnicorns(newUnicorns);

    const totalDuration = (config.unicornCount - 1) * config.spawnInterval + config.duration * 1000;
    const completionTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, totalDuration);

    return () => clearTimeout(completionTimer);
  }, [milestone, onComplete]);

  return (
    <div className="celebration-animation">
      {unicorns.map(node => (
        <UnicornSprite
          key={node.id}
          id={node.id}
          startX={node.startX}
          startY={node.startY}
          duration={node.duration}
          delay={node.delay}
          trajectory={node.trajectory}
          emoji={node.symbol}
          onAnimationEnd={handleUnicornComplete}
        />
      ))}
    </div>
  );
}
