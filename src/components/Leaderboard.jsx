import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * @typedef {Object} LeaderboardEntry
 * @property {string} user_id - UUID of the user
 * @property {string} rank - The user's current rank (e.g., 'Applicant', 'Interviewer')
 * @property {number} points - Total points earned by the user
 * @property {number} streak_days - Number of consecutive days with activity
 * @property {number} position - 1-indexed position in the leaderboard (1st, 2nd, 3rd, etc.)
 * @property {boolean} is_current_user - Whether this entry represents the current user
 */

/**
 * @typedef {Object} LeaderboardProps
 * @property {string} currentUserId - UUID of the currently logged-in user
 */

/**
 * @typedef {Object} RawGamificationState
 * @property {string} user_id - UUID of the user
 * @property {string} rank - The user's current rank
 * @property {number} points - Total points earned
 * @property {number} streak_days - Consecutive days with activity
 */

/**
 * LEADERBOARD COMPONENT
 * Displays ranked list of all users with their points and ranks
 * Fetches data from gamification_state table and sorts by points
 * Highlights the current user's entry
 * 
 * @param {LeaderboardProps} props
 */
export default function Leaderboard({ currentUserId }) {
  const [leaderboardData, setLeaderboardData] = useState(/** @type {LeaderboardEntry[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  /**
   * Fetch leaderboard data from Supabase
   * @returns {Promise<void>}
   */
  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('gamification_state')
        .select('user_id, rank, points, streak_days')
        .order('points', { ascending: false });

      if (queryError) {
        throw new Error(`Failed to fetch leaderboard data: ${queryError.message}`);
      }

      // Transform raw data into LeaderboardEntry objects
      const transformedData = data.map((entry, index) => ({
        user_id: entry.user_id,
        rank: entry.rank,
        points: entry.points,
        streak_days: entry.streak_days,
        position: index + 1,
        is_current_user: entry.user_id === currentUserId
      }));

      setLeaderboardData(transformedData);
    } catch (err) {
      setError(err.message);
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
  }, [currentUserId]);

  const handleRetry = () => {
    fetchLeaderboardData();
  };

  if (loading) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-loading">
          Loading leaderboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-error">
          <p>Failed to load leaderboard: {error}</p>
          <button onClick={handleRetry} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-empty">
          No leaderboard data available yet. Start tracking applications to appear on the leaderboard!
        </div>
      </div>
    );
  }

  /**
   * Get medal emoji for top 3 positions
   * @param {number} position - The position in the leaderboard
   * @returns {string} Medal emoji or empty string
   */
  const getMedal = (position) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '';
  };

  return (
    <div className="leaderboard-container">
      <h2 className="leaderboard-title">🏆 Leaderboard</h2>
      <div className="leaderboard-list">
        {leaderboardData.map(entry => (
          <div 
            key={entry.user_id}
            className={`leaderboard-entry ${entry.is_current_user ? 'current-user' : ''} ${entry.position <= 3 ? 'top-three' : ''}`}
          >
            <div className="leaderboard-position">
              {getMedal(entry.position) || `#${entry.position}`}
            </div>
            <div className="leaderboard-info">
              <div className="leaderboard-rank">
                {entry.rank}
                {entry.is_current_user && <span className="you-badge">YOU</span>}
              </div>
              <div className="leaderboard-stats">
                <span className="leaderboard-points">{entry.points} pts</span>
                <span className="leaderboard-streak">🔥 {entry.streak_days} days</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
