import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { RELEASES } from '../config/releases';

const LAST_SEEN_KEY = 'changelog_last_seen_version';

function getLastSeen() {
  try { return localStorage.getItem(LAST_SEEN_KEY) || ''; } catch { return ''; }
}

// Settings → What's New. Lists version releases (newest first) with a short
// description of what changed. Flags releases the user hasn't seen yet, then
// marks the latest as seen on view.
export default function ReleaseNotesPanel() {
  // Capture last-seen at mount so we can flag unseen releases before updating it.
  const [lastSeenAtMount] = useState(getLastSeen);

  useEffect(() => {
    try {
      if (RELEASES[0]) localStorage.setItem(LAST_SEEN_KEY, RELEASES[0].version);
    } catch { /* storage unavailable — non-fatal */ }
  }, []);

  const lastSeenIdx = RELEASES.findIndex((r) => r.version === lastSeenAtMount);
  // Newest-first: entries above the last-seen entry are new. No last-seen (first
  // visit) → flag nothing, to avoid a wall of "new" badges.
  const isNew = (i) => Boolean(lastSeenAtMount) && (lastSeenIdx === -1 ? true : i < lastSeenIdx);

  return (
    <div className="api-settings-section">
      <div className="api-settings-label">
        <span>
          <Sparkles
            size={14}
            style={{ color: '#06b6d4', verticalAlign: 'middle', marginRight: '6px' }}
            aria-hidden="true"
          />
          What's New
        </span>
      </div>

      {RELEASES.map((r, i) => (
        <div key={r.version} style={{ marginTop: i === 0 ? '4px' : '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', color: '#e2e8f0' }}>
              v{r.version}
            </span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: '#64748b' }}>
              {r.date}
            </span>
            {isNew(i) && (
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.08em', background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '2px', padding: '1px 5px' }}>
                NEW
              </span>
            )}
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {r.changes.map((c, j) => (
              <li
                key={j}
                style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '3px' }}
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
