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
 * @property {string} [emoji] - Optional emoji to use instead of unicorn (e.g., '🦋', '🐲')
 * @property {() => void} onComplete - Callback invoked when animation completes
 */

/**
 * @typedef {'diagonal' | 'arc' | 'wave' | 'straight'} TrajectoryType
 */

/**
 * @typedef {Object} CelebrationConfig
 * @property {number} unicornCount - Number of unicorns to spawn (3-10)
 * @property {number} duration - Duration of each unicorn animation in seconds
 * @property {number} spawnInterval - Time between unicorn spawns in milliseconds
 * @property {TrajectoryType[]} trajectories - Available trajectory types for this celebration
 */

/**
 * @typedef {Object} UnicornData
 * @property {string} id - Unique identifier for the unicorn
 * @property {number} startX - Starting X position in pixels
 * @property {number} startY - Starting Y position in pixels
 * @property {number} duration - Animation duration in seconds
 * @property {number} delay - Delay before animation starts in milliseconds
 * @property {TrajectoryType} trajectory - The flight path type
 */

/**
 * Get celebration configuration based on milestone tier
 * @param {MilestoneTier} tier - The milestone tier
 * @returns {CelebrationConfig} Configuration for the celebration
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

/**
 * CELEBRATION ANIMATION COMPONENT
 * Renders flying emoji animations when milestones are achieved
 * Spawns multiple emojis with staggered timing based on milestone tier
 * 
 * @param {CelebrationAnimationProps} props
 */
export default function CelebrationAnimation({ milestone, emoji, onComplete }) {
  const [unicorns, setUnicorns] = useState([]);

  const handleUnicornComplete = useCallback((id) => {
    setUnicorns(prev => prev.filter(u => u.id !== id));
  }, []);

  useEffect(() => {
    const config = getCelebrationConfig(milestone.tier);
    const newUnicorns = [];

    // Spawn unicorns with staggered timing
    for (let i = 0; i < config.unicornCount; i++) {
      const trajectory = config.trajectories[i % config.trajectories.length];
      const unicorn = {
        id: `unicorn-${Date.now()}-${i}`,
        startX: Math.random() * window.innerWidth,
        startY: window.innerHeight * (0.3 + Math.random() * 0.4),
        duration: config.duration,
        delay: i * config.spawnInterval,
        trajectory
      };
      newUnicorns.push(unicorn);
    }

    setUnicorns(newUnicorns);

    // Calculate total animation duration and trigger completion callback
    const totalDuration = (config.unicornCount - 1) * config.spawnInterval + config.duration * 1000;
    const completionTimer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, totalDuration);

    return () => {
      clearTimeout(completionTimer);
    };
  }, [milestone, onComplete]);

  return (
    <div className="celebration-animation">
      {unicorns.map(unicorn => (
        <UnicornSprite
          key={unicorn.id}
          id={unicorn.id}
          startX={unicorn.startX}
          startY={unicorn.startY}
          duration={unicorn.duration}
          delay={unicorn.delay}
          trajectory={unicorn.trajectory}
          emoji={emoji}
          onAnimationEnd={handleUnicornComplete}
        />
      ))}
    </div>
  );
}
