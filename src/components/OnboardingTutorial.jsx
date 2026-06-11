import React, { useState } from 'react';
import { Zap, Search, ShieldCheck, FileCode2, Key, Trophy, ChevronRight, ChevronLeft } from 'lucide-react';

const STEPS = [
  {
    icon: Zap,
    label: 'OVERVIEW',
    title: 'Your job search, automated.',
    body: 'Forge runs a 9-agent pipeline that discovers roles, tailors your resume and cover letter for each, then queues everything for your approval. Nothing is submitted without you.',
    accent: '#06b6d4',
    visual: (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
        {['Scout', 'Classify', 'CV Select', 'Tailor', 'Cover Letter', 'Form Map', 'Screenshot', 'Review', 'Submit'].map((a, i) => (
          <span key={a} style={{
            fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.06em',
            padding: '3px 7px', borderRadius: '2px',
            background: i === 7 ? 'rgba(139,92,246,0.12)' : i === 8 ? 'rgba(34,197,94,0.08)' : 'rgba(6,182,212,0.08)',
            border: `1px solid ${i === 7 ? 'rgba(139,92,246,0.25)' : i === 8 ? 'rgba(34,197,94,0.2)' : 'rgba(6,182,212,0.2)'}`,
            color: i === 7 ? '#a78bfa' : i === 8 ? '#4ade80' : '#67e8f9',
          }}>{a}</span>
        ))}
      </div>
    ),
  },
  {
    icon: Search,
    label: 'SCOUT',
    title: 'Discover roles automatically.',
    body: 'Every scan checks 8+ live sources — Arbeitnow, Remotive, GermanTechJobs, Greenhouse, SmartRecruiters, Lever, and more — and surfaces roles matched to your three CV tracks.',
    accent: '#06b6d4',
    visual: (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
        {['Arbeitnow', 'Remotive', 'GermanTechJobs', 'Greenhouse', 'SmartRecruiters', 'Lever', 'Recruitee', 'EURemote'].map(s => (
          <span key={s} style={{
            fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.04em',
            padding: '3px 7px', borderRadius: '2px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}>{s}</span>
        ))}
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    label: 'REVIEW QUEUE',
    title: 'You approve before anything ships.',
    body: "The pipeline generates a tailored resume diff and cover letter for every role. You read both before approving. Reject any time — the human gate is the final step.",
    accent: '#8b5cf6',
    visual: (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginTop: '12px', padding: '8px 12px',
        background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: '4px',
      }}>
        <ShieldCheck size={14} color="#a78bfa" strokeWidth={2} />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: '#a78bfa', letterSpacing: '0.06em' }}>
          HUMAN REVIEW GATE — REQUIRED BEFORE SUBMIT
        </span>
      </div>
    ),
  },
  {
    icon: FileCode2,
    label: 'THREE TRACKS',
    title: 'One pipeline. Three CV tracks.',
    body: 'Select your track per application — UX Engineer, Product Manager, or DevRel. The AI rewrites your bullets and cover letter to match the exact job description.',
    accent: '#06b6d4',
    visual: (
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        {[
          { label: 'UX ENGINEER', color: '#06b6d4', bg: 'rgba(6,182,212,0.10)', border: 'rgba(6,182,212,0.25)' },
          { label: 'PRODUCT MANAGER', color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.25)' },
          { label: 'DEVREL', color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.25)' },
        ].map(t => (
          <span key={t.label} style={{
            fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.06em',
            padding: '4px 10px', borderRadius: '2px',
            background: t.bg, border: `1px solid ${t.border}`, color: t.color,
          }}>{t.label}</span>
        ))}
      </div>
    ),
  },
  {
    icon: Key,
    label: 'SETUP REQUIRED',
    title: 'Add an API key to activate agents.',
    body: 'Open Settings (⚙) and add an OpenRouter or Groq key. Groq is free — no credit card needed. Keys live in your browser only and are never sent to our servers.',
    accent: '#f97316',
    visual: (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginTop: '12px', padding: '8px 12px',
        background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)',
        borderRadius: '4px',
      }}>
        <Key size={13} color="#fb923c" strokeWidth={2} />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: '#94a3b8', letterSpacing: '0.04em' }}>
          Settings ⚙ → <span style={{ color: '#fb923c' }}>Add Groq or OpenRouter key</span>
        </span>
      </div>
    ),
  },
  {
    icon: Trophy,
    label: 'GAMIFICATION',
    title: 'Track your momentum.',
    body: 'Earn XP for every application, interview, and offer. Unlock rank tiers, track achievements, and use Logic Prep and Resume AI to sharpen your edge between applications.',
    accent: '#8b5cf6',
    visual: (
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        {[
          { label: 'APPLICATION', pts: '+10 XP', color: '#06b6d4' },
          { label: 'INTERVIEW',   pts: '+25 XP', color: '#8b5cf6' },
          { label: 'OFFER',       pts: '+100 XP', color: '#4ade80' },
        ].map(e => (
          <div key={e.label} style={{
            display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center',
            padding: '7px 12px', borderRadius: '4px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '8px', color: '#475569', letterSpacing: '0.08em' }}>{e.label}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 700, color: e.color }}>{e.pts}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function OnboardingTutorial({ onComplete }) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  function finish() {
    setExiting(true);
    setTimeout(onComplete, 260);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  }

  function back() {
    if (step > 0) setStep(s => s - 1);
  }

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const accentRgb =
    current.accent === '#06b6d4' ? '6,182,212' :
    current.accent === '#8b5cf6' ? '139,92,246' :
    '249,115,22';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.25s ease',
      }}
      onClick={e => e.target === e.currentTarget && finish()}
    >
      <div
        key={step}
        style={{
          background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.07)',
          borderTop: `2px solid ${current.accent}`,
          borderRadius: '8px',
          padding: '36px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.025)`,
          position: 'relative',
          animation: 'ob-in 0.22s ease',
        }}
      >
        <style>{`
          @keyframes ob-in {
            from { opacity: 0; transform: translateY(10px) scale(0.99); }
            to   { opacity: 1; transform: none; }
          }
        `}</style>

        {/* Close / skip */}
        <button
          onClick={finish}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '4px', padding: '4px 10px',
            color: '#475569', cursor: 'pointer',
            fontFamily: "'Space Mono', monospace", fontSize: '10px',
            letterSpacing: '0.04em',
          }}
          onMouseOver={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'; }}
          onMouseOut={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          aria-label="Skip onboarding"
        >
          SKIP ×
        </button>

        {/* Step counter */}
        <div style={{
          fontFamily: "'Space Mono', monospace", fontSize: '9px',
          letterSpacing: '0.14em', color: current.accent,
          marginBottom: '18px', textTransform: 'uppercase',
        }}>
          {String(step + 1).padStart(2, '0')} / {STEPS.length} — {current.label}
        </div>

        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '14px' }}>
          <div style={{
            flexShrink: 0,
            width: '44px', height: '44px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `rgba(${accentRgb}, 0.09)`,
            border: `1px solid rgba(${accentRgb}, 0.25)`,
            borderRadius: '6px',
          }}>
            <Icon size={20} color={current.accent} strokeWidth={1.5} />
          </div>
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontSize: '20px', fontWeight: 700,
            color: '#e2e8f0', lineHeight: 1.25, margin: 0, paddingTop: '3px',
          }}>
            {current.title}
          </h2>
        </div>

        {/* Body */}
        <p style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: '14px', color: '#94a3b8',
          lineHeight: 1.65, margin: '0 0 4px 0',
          fontWeight: 400,
        }}>
          {current.body}
        </p>

        {/* Step visual */}
        {current.visual}

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '24px 0 20px' }} />

        {/* Progress dots + nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                style={{
                  height: '4px',
                  width: i === step ? '22px' : '6px',
                  borderRadius: '999px',
                  background: i === step ? current.accent : 'rgba(255,255,255,0.11)',
                  border: 'none', padding: 0, cursor: 'pointer',
                  transition: 'width 0.2s ease, background 0.2s ease',
                  boxShadow: i === step ? `0 0 6px rgba(${accentRgb}, 0.5)` : 'none',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button
                onClick={back}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px', padding: '8px 14px',
                  color: '#475569', cursor: 'pointer',
                  fontFamily: "'Space Mono', monospace", fontSize: '10px',
                  letterSpacing: '0.05em',
                }}
                onMouseOver={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseOut={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <ChevronLeft size={12} /> BACK
              </button>
            )}
            <button
              onClick={next}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: current.accent,
                border: 'none',
                borderRadius: '4px', padding: '8px 18px',
                color: '#07080c', cursor: 'pointer',
                fontFamily: "'Space Mono', monospace", fontSize: '10px',
                fontWeight: 700, letterSpacing: '0.06em',
                boxShadow: `0 0 16px rgba(${accentRgb}, 0.28)`,
              }}
              onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.14)'; e.currentTarget.style.boxShadow = `0 0 24px rgba(${accentRgb}, 0.45)`; }}
              onMouseOut={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.boxShadow = `0 0 16px rgba(${accentRgb}, 0.28)`; }}
            >
              {isLast ? 'GET STARTED' : 'NEXT'} <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
