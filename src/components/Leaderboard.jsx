import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getNextRank, getRankProgress } from '../gamification';

/**
 * @typedef {Object} LeaderboardEntry
 * @property {string} user_id
 * @property {string} rank
 * @property {number} points
 * @property {number} streak_days
 * @property {number} position - 1-indexed position
 * @property {boolean} is_current_user
 */

// Tier presentation — each rank gets a color + glyph so the board reads as a
// climb (grey newcomer → warm pro), matching the RANKS ladder in gamification.js.
const TIERS = {
  'Newcomer': { color: '#94a3b8', glyph: '○' },
  'Applicant': { color: '#22d3ee', glyph: '◔' },
  'Interviewer': { color: '#38bdf8', glyph: '◑' },
  'Contender': { color: '#a78bfa', glyph: '◕' },
  'Top Candidate': { color: '#f59e0b', glyph: '◉' },
  'Job Seeker Pro': { color: '#f97316', glyph: '★' },
};
const tierOf = (rank) => TIERS[rank] || { color: '#94a3b8', glyph: '○' };
const MEDALS = ['🥇', '🥈', '🥉'];

/** Rank-progress sub-block: a tier-colored bar + "X pts to NextRank". */
function RankProgress({ points, rank, compact }) {
  const next = getNextRank(points);
  const pct = Math.max(0, Math.min(100, getRankProgress(points)));
  const color = tierOf(rank).color;
  return (
    <div className="lb-prog">
      <div className="lb-prog-track">
        <div className="lb-prog-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {!compact && (
        <div className="lb-prog-label">
          {next.name ? `${next.pointsNeeded} pts → ${next.name}` : 'Max rank reached'}
        </div>
      )}
    </div>
  );
}

/**
 * LEADERBOARD — ranked climb. Podium for the top 3, then a list with each
 * player's tier, points, progress to their next rank, and the gap to overtake
 * the person directly above them.
 */
export default function Leaderboard({ currentUserId }) {
  const [leaderboardData, setLeaderboardData] = useState(/** @type {LeaderboardEntry[]} */([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */(null));

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from('gamification_state')
        .select('user_id, rank, points, streak_days')
        .order('points', { ascending: false });
      if (queryError) throw new Error(`Failed to fetch leaderboard data: ${queryError.message}`);

      const transformed = data.map((entry, index) => ({
        user_id: entry.user_id,
        rank: entry.rank,
        points: entry.points,
        streak_days: entry.streak_days,
        position: index + 1,
        is_current_user: entry.user_id === currentUserId,
      }));
      setLeaderboardData(transformed);
    } catch (err) {
      setError(err.message);
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboardData(); }, [currentUserId]);

  const styleBlock = (
    <style>{`
      .lb { background: var(--surface-1, #0d1117); border: 1px solid var(--border, #1e2a1e);
        border-top: 2px solid var(--accent, #06b6d4); border-radius: 6px; padding: 18px 18px 20px;
        font-family: 'Space Mono', 'Courier New', monospace; }
      .lb-title { font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
        color: var(--text-muted, #94a3b8); margin: 0 0 16px; }
      .lb-state { color: var(--text-muted, #94a3b8); font-size: 12px; padding: 10px 0; }
      .lb-retry { margin-top: 8px; background: transparent; border: 1px solid var(--border, #334155);
        color: var(--accent, #06b6d4); font-family: inherit; font-size: 11px; padding: 6px 12px;
        border-radius: 4px; cursor: pointer; }

      /* podium */
      .lb-podium { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin-bottom: 18px; }
      .lb-pod { flex: 1; max-width: 130px; background: var(--surface-2, #111a26);
        border: 1px solid var(--border, #1e2a1e); border-radius: 6px; padding: 12px 8px 10px;
        text-align: center; position: relative; transition: transform .15s; }
      .lb-pod:hover { transform: translateY(-3px); }
      .lb-pod.p1 { border-color: #f59e0b; box-shadow: 0 0 22px rgba(245, 158, 11, .18); padding-top: 18px; }
      .lb-pod.p2 { margin-bottom: 14px; }
      .lb-pod.p3 { margin-bottom: 26px; }
      .lb-pod.me { outline: 1px dashed var(--accent, #06b6d4); outline-offset: 2px; }
      .lb-medal { font-size: 22px; line-height: 1; }
      .lb-pod-glyph { font-size: 18px; margin-top: 4px; }
      .lb-pod-rank { font-size: 11px; color: var(--text, #e2e8f0); margin-top: 6px; min-height: 28px; }
      .lb-pod-pts { font-size: 17px; font-weight: 700; color: var(--text, #e2e8f0); margin-top: 4px; }
      .lb-pod-streak { font-size: 10px; color: var(--text-muted, #94a3b8); margin-top: 2px; }
      .lb-you { display: inline-block; font-size: 8px; letter-spacing: .1em; background: var(--accent, #06b6d4);
        color: #fff; border-radius: 3px; padding: 1px 4px; margin-left: 4px; vertical-align: middle; }

      /* list */
      .lb-row { display: grid; grid-template-columns: 26px 1fr auto; gap: 10px; align-items: center;
        padding: 10px 4px; border-top: 1px solid var(--border, #1e2a1e); }
      .lb-row.me { background: rgba(6, 182, 212, .06); border-radius: 4px; }
      .lb-pos { font-size: 12px; color: var(--text-muted, #94a3b8); text-align: center; }
      .lb-main { min-width: 0; }
      .lb-rank { font-size: 12px; color: var(--text, #e2e8f0); display: flex; align-items: center; gap: 6px; }
      .lb-glyph { font-size: 13px; }
      .lb-gap { font-size: 10px; color: var(--text-muted, #94a3b8); margin-top: 2px; }
      .lb-gap b { color: var(--accent, #06b6d4); font-weight: 700; }
      .lb-right { text-align: right; }
      .lb-pts { font-size: 14px; font-weight: 700; color: var(--text, #e2e8f0); }
      .lb-streak { font-size: 10px; color: var(--text-muted, #94a3b8); }

      /* progress bar */
      .lb-prog { margin-top: 6px; }
      .lb-prog-track { height: 5px; border-radius: 3px; background: rgba(148, 163, 184, .18); overflow: hidden; }
      .lb-prog-fill { height: 100%; border-radius: 3px; background: var(--accent, #06b6d4);
        transition: width .5s ease; }
      .lb-prog-label { font-size: 9px; color: var(--text-muted, #94a3b8); margin-top: 3px; letter-spacing: .03em; }
    `}</style>
  );

  if (loading) return (<div className="lb">{styleBlock}<div className="lb-state">Loading leaderboard…</div></div>);
  if (error) return (
    <div className="lb">{styleBlock}
      <div className="lb-state">Failed to load leaderboard: {error}
        <div><button className="lb-retry" onClick={fetchLeaderboardData}>Retry</button></div>
      </div>
    </div>
  );
  if (leaderboardData.length === 0) return (
    <div className="lb">{styleBlock}
      <div className="lb-state">No leaderboard data yet. Start tracking applications to join the climb.</div>
    </div>
  );

  const top = leaderboardData.slice(0, 3);
  const rest = leaderboardData.slice(3);
  // Classic podium order (2nd, 1st, 3rd) when there are three; else natural order.
  const podiumOrder = top.length >= 3 ? [1, 0, 2] : top.map((_, i) => i);

  return (
    <div className="lb">
      {styleBlock}
      <h2 className="lb-title">Leaderboard · The Climb</h2>

      <div className="lb-podium">
        {podiumOrder.map((idx) => {
          const e = top[idx];
          const t = tierOf(e.rank);
          return (
            <div key={e.user_id} className={`lb-pod p${e.position} ${e.is_current_user ? 'me' : ''}`}>
              <div className="lb-medal">{MEDALS[e.position - 1]}</div>
              <div className="lb-pod-glyph" style={{ color: t.color }}>{t.glyph}</div>
              <div className="lb-pod-rank" style={{ color: t.color }}>
                {e.rank}{e.is_current_user && <span className="lb-you">YOU</span>}
              </div>
              <div className="lb-pod-pts">{e.points}</div>
              <div className="lb-pod-streak">🔥 {e.streak_days}d</div>
              <RankProgress points={e.points} rank={e.rank} compact />
            </div>
          );
        })}
      </div>

      {rest.map((e, i) => {
        const t = tierOf(e.rank);
        const above = leaderboardData[e.position - 2]; // entry directly above
        const gap = above ? above.points - e.points : 0;
        return (
          <div key={e.user_id} className={`lb-row ${e.is_current_user ? 'me' : ''}`}>
            <div className="lb-pos">#{e.position}</div>
            <div className="lb-main">
              <div className="lb-rank">
                <span className="lb-glyph" style={{ color: t.color }}>{t.glyph}</span>
                <span style={{ color: t.color }}>{e.rank}</span>
                {e.is_current_user && <span className="lb-you">YOU</span>}
              </div>
              {gap > 0 && (
                <div className="lb-gap"><b>+{gap}</b> to overtake #{e.position - 1}</div>
              )}
              <RankProgress points={e.points} rank={e.rank} />
            </div>
            <div className="lb-right">
              <div className="lb-pts">{e.points}</div>
              <div className="lb-streak">🔥 {e.streak_days}d</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
