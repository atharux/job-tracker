import React, { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';

const LOTTIE_URL = 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f984/lottie.json';

const IDLE_MESSAGES = [
  "Every application is a rep. Keep going.",
  "The right role is already looking for you.",
  "Consistency > perfection. One more today.",
  "Berlin's job market is rough. You're sharper.",
];

const STORAGE_KEY = 'companion-dismissed';

export default function AppCompanion({ activeMilestone, statusCelebration, isSyncing }) {
  const [animData, setAnimData] = useState(null);
  const [companionState, setCompanionState] = useState('idle');
  const [message, setMessage] = useState("Hey! I'm your job hunt companion. Let's find your next role.");
  const [visible, setVisible] = useState(!localStorage.getItem(STORAGE_KEY));
  const [minimized, setMinimized] = useState(false);
  const lottieRef = useRef(null);
  const stateTimer = useRef(null);

  // Load Google Noto unicorn Lottie
  useEffect(() => {
    fetch(LOTTIE_URL)
      .then(r => r.json())
      .then(setAnimData)
      .catch(() => {});
  }, []);

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
        🦄
      </button>
    );
  }

  const size = minimized ? 44 : 84;

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
          <div
            className="companion-character"
            onClick={() => setMinimized(m => !m)}
            title={minimized ? 'Expand companion' : 'Minimize companion'}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setMinimized(m => !m)}
          >
            {animData ? (
              <Lottie
                lottieRef={lottieRef}
                animationData={animData}
                loop
                autoplay
                style={{ width: size, height: size }}
              />
            ) : (
              <span className="companion-fallback">🦄</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
