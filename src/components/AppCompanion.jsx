import React, { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import medusaImg from '../../avatars/medusa.png';

// Companion characters. Each uses a Google Noto animated-emoji Lottie, with an
// emoji fallback if the Lottie fails to load (network / missing animation).
const AVATARS = {
  unicorn: {
    label: 'Unicorn',
    emoji: '🦄',
    lottie: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f984/lottie.json',
  },
  medusa: {
    label: 'Medusa',
    emoji: '🐍',
    img: medusaImg, // polished tattoo-style PNG (avatars/medusa.png)
  },
  dragon: {
    label: 'Dragon',
    emoji: '🐉',
    lottie: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f409/lottie.json',
  },
  robot: {
    label: 'Robot',
    emoji: '🤖', // glyph for the switch button + minimized/revive fallback
    custom: 'robot', // rendered by <RobotAvatar/> instead of a Lottie (original, WALL-E-inspired)
  },
  octopus: {
    label: 'Octopus',
    emoji: '🐙',
    lottie: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f419/lottie.json',
  },
  // Add more here — the switcher cycles through every entry automatically.
};
const AVATAR_ORDER = Object.keys(AVATARS);
const AVATAR_KEY = 'companion-avatar';

const IDLE_MESSAGES = [
  "Every application is a rep. Keep going.",
  "The right role is already looking for you.",
  "Consistency > perfection. One more today.",
  "Berlin's job market is rough. You're sharper.",
];

const STORAGE_KEY = 'companion-dismissed';

/**
 * Original boxy companion bot — inspired by the retro binocular-eyed robot
 * look (lens eyes, treads, antenna), not a copy of any trademarked character.
 * Pure SVG so it themes with the app's cyan accent and needs no asset fetch.
 */
function RobotAvatar({ size = 84 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="robot-avatar"
      role="img"
      aria-label="Robot companion"
    >
      {/* antenna */}
      <line x1="50" y1="20" x2="50" y2="9" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
      <circle className="robot-antenna" cx="50" cy="7" r="3.5" fill="#22d3ee" />
      {/* head / body */}
      <rect x="20" y="20" width="60" height="50" rx="12" fill="#aeb8c4" stroke="#5b6675" strokeWidth="2.5" />
      <rect x="20" y="20" width="60" height="50" rx="12" fill="url(#robotShade)" opacity="0.22" />
      {/* visor face panel */}
      <rect x="27" y="30" width="46" height="28" rx="9" fill="#121a26" stroke="#3a4658" strokeWidth="1.5" />
      {/* binocular lens eyes */}
      <g className="robot-eyes">
        <circle cx="40" cy="44" r="9" fill="#0b1220" stroke="#76828f" strokeWidth="2.5" />
        <circle cx="60" cy="44" r="9" fill="#0b1220" stroke="#76828f" strokeWidth="2.5" />
        <circle className="robot-pupil" cx="40" cy="44" r="3.6" fill="#22d3ee" />
        <circle className="robot-pupil" cx="60" cy="44" r="3.6" fill="#22d3ee" />
      </g>
      {/* arms */}
      <rect x="11" y="40" width="7" height="16" rx="3.5" fill="#8a95a3" stroke="#5b6675" strokeWidth="1.5" />
      <rect x="82" y="40" width="7" height="16" rx="3.5" fill="#8a95a3" stroke="#5b6675" strokeWidth="1.5" />
      {/* tread base */}
      <rect x="30" y="70" width="40" height="14" rx="6" fill="#6b7686" stroke="#454f5e" strokeWidth="2" />
      <circle cx="38" cy="77" r="2.5" fill="#1f2733" />
      <circle cx="50" cy="77" r="2.5" fill="#1f2733" />
      <circle cx="62" cy="77" r="2.5" fill="#1f2733" />
      <defs>
        <linearGradient id="robotShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Hand-drawn Medusa — green-skinned anime palette (per the reference) with a
 * more classical Greek face: oval features, almond amber eyes, a straight
 * Grecian nose, serene expression. Snake mane sways, eyes blink. Custom SVG.
 */
function MedusaAvatar({ size = 84 }) {
  const snakes = [
    { c: 's1', d: 'M40 44 Q22 42 14 28', x: 14, y: 26 },
    { c: 's2', d: 'M42 40 Q30 24 22 16', x: 22, y: 14 },
    { c: 's3', d: 'M46 37 Q41 20 36 12', x: 36, y: 11 },
    { c: 's4', d: 'M50 36 Q50 18 50 11', x: 50, y: 10 },
    { c: 's5', d: 'M54 37 Q59 20 64 12', x: 64, y: 11 },
    { c: 's6', d: 'M58 40 Q70 24 78 16', x: 78, y: 14 },
    { c: 's7', d: 'M60 44 Q78 42 86 28', x: 86, y: 26 },
    { c: 's8', d: 'M39 50 Q20 52 12 44', x: 12, y: 43 },
    { c: 's9', d: 'M61 50 Q80 52 88 44', x: 88, y: 43 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="medusa-avatar" role="img" aria-label="Medusa companion">
      <defs>
        <linearGradient id="medSnake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9bdb6f" />
          <stop offset="1" stopColor="#3c9a4a" />
        </linearGradient>
      </defs>
      {/* snake mane (behind the face) */}
      <g stroke="url(#medSnake)" strokeWidth="5" fill="none" strokeLinecap="round">
        {snakes.map(s => (
          <g key={s.c} className={`med-snake ${s.c}`}>
            <path d={s.d} />
            <circle cx={s.x} cy={s.y} r="3.6" fill="#5cb04f" stroke="none" />
            <circle cx={s.x - 1} cy={s.y - 0.6} r="0.85" fill="#11401f" stroke="none" />
            <circle cx={s.x + 1} cy={s.y - 0.6} r="0.85" fill="#11401f" stroke="none" />
          </g>
        ))}
      </g>
      {/* oval Greek face + neck (green skin) */}
      <path d="M50 36 C61 36 67 45 67 55 C67 68 59 77 50 79 C41 77 33 68 33 55 C33 45 39 36 50 36 Z" fill="#aed99a" />
      <path d="M45 77 L45 86 Q50 88 55 86 L55 77 Z" fill="#9ccb85" />
      {/* soft jaw shading */}
      <path d="M34 56 Q36 68 50 75 Q40 70 36 57 Z" fill="#97c97f" opacity="0.5" />
      <path d="M66 56 Q64 68 50 75 Q60 70 64 57 Z" fill="#97c97f" opacity="0.5" />
      {/* center-parted hairline */}
      <path d="M37 41 Q44 34 50 38 Q56 34 63 41 Q56 38 50 41 Q44 38 37 41 Z" fill="#7cc05a" />
      {/* dark-green arched brows */}
      <path d="M37 49 Q43 46 49 48.5" stroke="#2c6b34" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M51 48.5 Q57 46 63 49" stroke="#2c6b34" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      {/* straight Grecian nose */}
      <path d="M50 49 L48.6 61 Q50 63 51.4 61" stroke="#7cb968" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* almond amber eyes (blink) */}
      <g className="med-eyes">
        <path d="M37 54 Q43 49.5 49 54 Q43 57.5 37 54 Z" fill="#f3efdf" />
        <path d="M51 54 Q57 49.5 63 54 Q57 57.5 51 54 Z" fill="#f3efdf" />
        <circle cx="43" cy="54" r="3.1" fill="#e3a52e" />
        <circle cx="57" cy="54" r="3.1" fill="#e3a52e" />
        <circle cx="43" cy="54" r="1.4" fill="#3a2710" />
        <circle cx="57" cy="54" r="1.4" fill="#3a2710" />
        <circle cx="44" cy="52.9" r="0.8" fill="#fff" />
        <circle cx="58" cy="52.9" r="0.8" fill="#fff" />
        <path d="M37 54 Q43 49.5 49 54" stroke="#2c5a30" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M51 54 Q57 49.5 63 54" stroke="#2c5a30" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
      {/* serene green lips */}
      <path d="M45 68 Q50 66.5 55 68 Q50 71 45 68 Z" fill="#5fa64f" />
      <path d="M45 68 Q50 69 55 68" stroke="#3f8537" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function AppCompanion({ activeMilestone, statusCelebration, isSyncing }) {
  const [animData, setAnimData] = useState(null);
  const [companionState, setCompanionState] = useState('idle');
  const [message, setMessage] = useState("Hey! I'm your job hunt companion. Let's find your next role.");
  const [visible, setVisible] = useState(!localStorage.getItem(STORAGE_KEY));
  const [minimized, setMinimized] = useState(false);
  const [avatar, setAvatar] = useState(() => {
    const saved = localStorage.getItem(AVATAR_KEY);
    return saved && AVATARS[saved] ? saved : 'unicorn';
  });
  const lottieRef = useRef(null);
  const stateTimer = useRef(null);

  // Cycle to the next character in the registry and remember the choice.
  function cycleAvatar(e) {
    if (e) e.stopPropagation();
    setAvatar(prev => {
      const next = AVATAR_ORDER[(AVATAR_ORDER.indexOf(prev) + 1) % AVATAR_ORDER.length];
      localStorage.setItem(AVATAR_KEY, next);
      return next;
    });
  }

  // Load the selected character's Google Noto Lottie (re-fetches on switch).
  // Custom-rendered avatars (e.g. the robot) have no Lottie — skip the fetch.
  useEffect(() => {
    setAnimData(null);
    const url = AVATARS[avatar].lottie;
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) setAnimData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [avatar]);

  // Dismiss intro message after 5s
  useEffect(() => {
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, []);

  // Periodic idle messages
  useEffect(() => {
    if (companionState !== 'idle') return;
    const interval = setInterval(() => {
      const msg = IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)];
      setMessage(msg);
      const clear = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(clear);
    }, 90000);
    return () => clearInterval(interval);
  }, [companionState]);

  function transitionTo(nextState, msg, duration) {
    clearTimeout(stateTimer.current);
    setCompanionState(nextState);
    setMessage(msg);
    stateTimer.current = setTimeout(() => {
      setCompanionState('idle');
      setMessage(null);
    }, duration);
  }

  // React to milestones
  useEffect(() => {
    if (!activeMilestone) return;
    const msgs = {
      'rank-up': `${activeMilestone.title} — rank up! You're on fire.`,
      'achievement': `${activeMilestone.title}. That's the way.`,
      'standard': activeMilestone.title,
    };
    transitionTo('celebrate', msgs[activeMilestone.tier] ?? activeMilestone.title, 5000);
  }, [activeMilestone]);

  // React to status changes (rejection / interview)
  useEffect(() => {
    if (!statusCelebration) return;
    if (statusCelebration.type === 'rejected') {
      transitionTo('console', "Their loss. Every rejection is one step closer.", 6000);
    } else if (statusCelebration.type === 'interview') {
      transitionTo('celebrate', "Interview locked in! You've absolutely got this.", 5000);
    }
  }, [statusCelebration]);

  // React to agent scanning
  useEffect(() => {
    if (isSyncing) {
      clearTimeout(stateTimer.current);
      setCompanionState('thinking');
      setMessage('Scanning job boards...');
    } else if (companionState === 'thinking') {
      setCompanionState('idle');
      setMessage(null);
    }
  }, [isSyncing]);

  // Lottie speed by state
  useEffect(() => {
    if (!lottieRef.current || !animData) return;
    const speeds = { celebrate: 2, thinking: 0.5, console: 0.6, idle: 1 };
    lottieRef.current.setSpeed(speeds[companionState] ?? 1);
  }, [companionState, animData]);

  function handleDismiss(e) {
    e.stopPropagation();
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  if (!visible) {
    return (
      <button
        className="companion-revive"
        onClick={() => { setVisible(true); localStorage.removeItem(STORAGE_KEY); }}
        title="Bring back companion"
        aria-label="Show job hunt companion"
      >
        {AVATARS[avatar].emoji}
      </button>
    );
  }

  const size = minimized ? 44 : 84;
  const nextAvatar = AVATAR_ORDER[(AVATAR_ORDER.indexOf(avatar) + 1) % AVATAR_ORDER.length];

  return (
    <>
      <style>{`
        .app-companion {
          position: fixed;
          bottom: 1.5rem;
          left: 1.5rem;
          z-index: 9998;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          pointer-events: none;
        }

        .companion-bubble {
          pointer-events: auto;
          background: #0d1117;
          border: 1px solid #1e2a1e;
          border-left: 3px solid #06b6d4;
          border-radius: 4px;
          padding: 8px 11px;
          max-width: 210px;
          position: relative;
          animation: bubble-in 0.22s ease-out;
        }

        @keyframes bubble-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to { opacity: 1; transform: none; }
        }

        .companion-bubble span {
          font-family: 'Space Mono', 'Courier New', monospace;
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.6;
          display: block;
        }

        .companion-bubble::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 20px;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #1e2a1e;
        }

        .companion-wrap {
          pointer-events: auto;
          position: relative;
          display: inline-flex;
        }

        .companion-character {
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.18s, box-shadow 0.18s;
          border-radius: 50%;
          background: #0d1117;
          border: 1px solid rgba(6, 182, 212, 0.22);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.06), 0 0 18px rgba(6, 182, 212, 0.12);
          padding: 4px;
          filter: drop-shadow(0 0 6px rgba(6, 182, 212, 0.18));
        }

        .companion-character:hover {
          transform: scale(1.07);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.14), 0 0 28px rgba(6, 182, 212, 0.22);
        }

        .state-celebrate .companion-character {
          animation: companion-bounce 0.5s ease-in-out infinite;
          border-color: rgba(6, 182, 212, 0.5);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15), 0 0 32px rgba(6, 182, 212, 0.3);
          filter: drop-shadow(0 0 10px rgba(6, 182, 212, 0.4));
        }

        .state-thinking .companion-character {
          animation: companion-think 1.8s ease-in-out infinite;
          border-color: rgba(6, 182, 212, 0.15);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.04), 0 0 12px rgba(6, 182, 212, 0.08);
        }

        .state-console .companion-character {
          animation: companion-nod 1.3s ease-in-out;
          border-color: rgba(100, 116, 139, 0.3);
          box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.06), 0 0 12px rgba(0, 0, 0, 0.4);
          filter: drop-shadow(0 0 4px rgba(100, 116, 139, 0.2)) saturate(0.7);
        }

        @keyframes companion-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-14px) scale(1.06); }
        }

        @keyframes companion-nod {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-9deg); }
          65% { transform: rotate(6deg); }
        }

        @keyframes companion-think {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.93); opacity: 0.75; }
        }

        .companion-dismiss {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #111827;
          border: 1px solid #334155;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 14px;
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          padding: 0;
          z-index: 2;
          transition: color 0.12s, background 0.12s;
          font-family: monospace;
        }

        .companion-dismiss:hover {
          color: #e2e8f0;
          background: #334155;
        }

        .companion-switch {
          position: absolute;
          top: -6px;
          left: -6px;
          background: #0d1117;
          border: 1px solid rgba(6, 182, 212, 0.35);
          border-radius: 50%;
          width: 22px;
          height: 22px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          padding: 0;
          z-index: 2;
          box-shadow: 0 0 8px rgba(6, 182, 212, 0.15);
          transition: transform 0.12s, box-shadow 0.12s;
        }

        .companion-switch:hover {
          transform: scale(1.12) rotate(-8deg);
          box-shadow: 0 0 14px rgba(6, 182, 212, 0.3);
        }

        .robot-avatar { display: block; }

        .robot-pupil {
          animation: robot-look 4s ease-in-out infinite;
        }

        .robot-antenna {
          animation: robot-blink 2.2s ease-in-out infinite;
        }

        @keyframes robot-look {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
        }

        @keyframes robot-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .img-avatar { display: block; animation: img-bob 3.6s ease-in-out infinite; }
        @keyframes img-bob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.02); }
        }

        .medusa-avatar { display: block; }

        .med-snake { transform-box: fill-box; transform-origin: bottom center; }
        .med-snake.s1 { animation: med-sway 2.6s ease-in-out infinite; }
        .med-snake.s2 { animation: med-sway 3.0s ease-in-out infinite 0.3s; }
        .med-snake.s3 { animation: med-sway 2.8s ease-in-out infinite 0.5s; }
        .med-snake.s4 { animation: med-sway 3.3s ease-in-out infinite 0.2s; }
        .med-snake.s5 { animation: med-sway 2.7s ease-in-out infinite 0.6s; }
        .med-snake.s6 { animation: med-sway 3.1s ease-in-out infinite 0.4s; }
        .med-snake.s7 { animation: med-sway 2.9s ease-in-out infinite 0.15s; }
        .med-snake.s8 { animation: med-sway 3.4s ease-in-out infinite 0.5s; }
        .med-snake.s9 { animation: med-sway 2.5s ease-in-out infinite 0.35s; }

        .med-eyes { transform-box: fill-box; transform-origin: center; animation: med-blink 4.5s steps(1) infinite; }

        .med-star { transform-box: fill-box; transform-origin: center; }
        .med-star.k1 { animation: med-twinkle 2.4s ease-in-out infinite; }
        .med-star.k2 { animation: med-twinkle 2.4s ease-in-out infinite 0.6s; }
        .med-star.k3 { animation: med-twinkle 2.4s ease-in-out infinite 1.2s; }
        .med-star.k4 { animation: med-twinkle 2.4s ease-in-out infinite 1.8s; }

        @keyframes med-sway {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }

        @keyframes med-blink {
          0%, 94%, 100% { transform: scaleY(1); }
          97% { transform: scaleY(0.12); }
        }

        @keyframes med-twinkle {
          0%, 100% { transform: scale(0.5); opacity: 0.3; }
          50% { transform: scale(1); opacity: 1; }
        }

        .companion-fallback {
          font-size: 2.5rem;
          line-height: 1;
          filter: drop-shadow(0 0 8px rgba(6,182,212,0.5));
        }

        .companion-revive {
          position: fixed;
          bottom: 1.5rem;
          left: 1.5rem;
          z-index: 9998;
          background: transparent;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          opacity: 0.3;
          transition: opacity 0.2s, transform 0.2s;
          padding: 4px;
          line-height: 1;
        }

        .companion-revive:hover {
          opacity: 1;
          transform: scale(1.15);
        }
      `}</style>

      <div className={`app-companion state-${companionState}`}>
        {message && !minimized && (
          <div className="companion-bubble">
            <span>{message}</span>
          </div>
        )}

        <div className="companion-wrap">
          <button
            className="companion-dismiss"
            onClick={handleDismiss}
            title="Dismiss companion"
            aria-label="Dismiss companion"
          >
            ×
          </button>
          <button
            className="companion-switch"
            onClick={cycleAvatar}
            title={`Switch to ${AVATARS[nextAvatar].label}`}
            aria-label={`Switch companion to ${AVATARS[nextAvatar].label}`}
          >
            {AVATARS[nextAvatar].emoji}
          </button>
          <div
            className="companion-character"
            onClick={() => setMinimized(m => !m)}
            title={minimized ? 'Expand companion' : 'Minimize companion'}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setMinimized(m => !m)}
          >
            {AVATARS[avatar].img ? (
              <img
                src={AVATARS[avatar].img}
                alt={`${AVATARS[avatar].label} companion`}
                className="img-avatar"
                style={{ width: size, height: size, objectFit: 'contain' }}
                draggable={false}
              />
            ) : AVATARS[avatar].custom === 'robot' ? (
              <RobotAvatar size={size} />
            ) : AVATARS[avatar].custom === 'medusa' ? (
              <MedusaAvatar size={size} />
            ) : animData ? (
              <Lottie
                lottieRef={lottieRef}
                animationData={animData}
                loop
                autoplay
                style={{ width: size, height: size }}
              />
            ) : (
              <span className="companion-fallback">{AVATARS[avatar].emoji}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
