import React, { useState } from 'react'
import { hasCogneeConfig, cogneeSearch, cogneeRememberProfile, localJobSearch } from '../agents/cogneeClient'
import type { JobSearchLink } from '../agents/cogneeClient'
import { runScoutOnly } from '../services/agentOrchestrator'
import SharedNav from './SharedNav'

const TEAL   = '#06b6d4'
const PURPLE = '#8b5cf6'
const ORANGE = '#f97316'
const AMBER  = '#f59e0b'
const GREEN  = '#16a34a'

// Light graphite palette
const BG      = '#f5f4f0'
const SURFACE = '#ffffff'
const BORDER  = '#e2e0db'
const TEXT1   = '#18181b'
const TEXT2   = '#52525b'
const TEXT3   = '#a1a1aa'
const CHIP    = '#f0ede8'

const DATA_SOURCES = [
  { name: 'Arbeitnow',        type: 'REST', geo: 'EU' },
  { name: 'Remotive',         type: 'REST', geo: 'Remote' },
  { name: 'GermanTechJobs',   type: 'RSS',  geo: 'DE' },
  { name: 'Greenhouse',       type: 'REST', geo: 'Multi' },
  { name: 'SmartRecruiters',  type: 'REST', geo: 'Multi' },
  { name: 'Lever',            type: 'REST', geo: 'EU' },
  { name: 'Ashby',            type: 'REST', geo: 'Startups' },
  { name: 'Recruitee',        type: 'REST', geo: 'EU' },
  { name: 'WeWorkRemotely',   type: 'RSS',  geo: 'Remote' },
  { name: 'Jobicy',           type: 'RSS',  geo: 'Remote' },
  { name: 'RemoteOK',         type: 'REST', geo: 'Remote' },
  { name: 'BerlinStartupJobs',type: 'RSS',  geo: 'Berlin' },
  { name: 'EuropeRemotely',   type: 'RSS',  geo: 'EU' },
  { name: 'Proxy (5 more)',   type: 'Edge', geo: 'CORS' },
]

const AGENTS = [
  { id: 'scout',         label: 'SCOUT',          model: '14 free APIs',      color: TEAL,   description: 'Aggregates jobs from 14 sources in parallel. Deduplicates by URL. Keyword-matches across 60+ role titles.', output: 'ScoutResult[]',    table: 'jobs' },
  { id: 'classifier',   label: 'CLASSIFIER',      model: 'Groq llama-3.3',    color: TEAL,   description: 'Scores each job 0–10 against your profile. Assigns CV track (ux/pm/devrel). Filters scores below 3.0.', output: 'ClassifierResult', table: 'agent_runs' },
  { id: 'cvselector',   label: 'CV SELECTOR',     model: 'Supabase query',    color: TEAL,   description: 'Picks the right CV from Supabase based on classified track. Three tracks: UX Engineer, PM, DevRel.', output: 'cv_track + CV',    table: 'cv_versions', branches: true },
  { id: 'resumetailor', label: 'RESUME TAILOR',   model: 'OpenRouter (free)', color: TEAL,   description: 'Rewrites CV bullets to mirror JD language. Track-specific emphasis. Preserves all truthful content.', output: 'tailored_resume',  table: 'application_artifacts' },
  { id: 'coverletter',  label: 'COVER LETTER',    model: 'OpenRouter (free)', color: TEAL,   description: 'Generates a 3-paragraph cover letter from tailored CV + JD. Tone matches track voice.', output: 'cover_letter',     table: 'application_artifacts' },
  { id: 'formmapper',   label: 'FORM MAPPER',     model: 'OpenRouter (free)', color: TEAL,   description: 'Maps application form fields using ATS pattern detection. Handles Greenhouse, Lever, Ashby, Workable.', output: 'form_mapping',    table: 'application_artifacts' },
  { id: 'screenshot',   label: 'SCREENSHOT',      model: 'CF Browser',        color: TEXT3,  description: 'Before/after screenshots of the application form. Stubbed — Cloudflare Browser Rendering binding.', output: 'screenshots',      table: 'application_artifacts' },
  { id: 'gate',         label: 'REVIEW GATE',     model: 'Human',             color: AMBER,  description: 'Human-in-the-loop gate. You approve or reject before any submission. No application goes out without sign-off.', output: 'approved/rejected', table: 'application_review_queue', isGate: true },
  { id: 'tracker',      label: 'STATUS TRACKER',  model: 'Gmail MCP',         color: ORANGE, description: 'Watches inbox for reply signals — interview invites, rejections, ghosting. Updates job status automatically.', output: 'status update',   table: 'jobs' },
]

const CV_TRACKS = [
  { key: 'ux',     label: 'UX Engineer',  color: TEAL },
  { key: 'pm',     label: 'Product Mgr',  color: PURPLE },
  { key: 'devrel', label: 'Dev Relations', color: ORANGE },
]

const SUPABASE_TABLES = [
  { name: 'jobs',                   desc: 'All scouted postings',    color: TEAL },
  { name: 'agent_runs',             desc: 'Full audit log',          color: TEAL },
  { name: 'application_artifacts',  desc: 'CV, cover letter, form',  color: PURPLE },
  { name: 'application_review_queue', desc: 'Human gate state',      color: AMBER },
  { name: 'cv_versions',            desc: '3 track base CVs',        color: ORANGE },
  { name: 'applications',           desc: 'Kanban tracker',          color: TEXT3 },
]

const COGNEE_NODES = ['company', 'role_title', 'required_skills', 'fit_score', 'cv_track', 'industry', 'location']

const PRESET_GROUPS = [
  { label: 'PIPELINE', queries: [
    'Show me everything in my pipeline right now',
    'Which jobs scored highest for my profile?',
    'Which cv track has the most roles — UX, PM, or DevRel?',
    'What Berlin-based roles am I tracking?',
    'Any interviews or calls scheduled?',
    'Which applications are still waiting for a response?',
    'Show my most recently added jobs',
    'Which companies appear most in my pipeline?',
  ]},
  { label: 'PROFILE MATCH', queries: [
    'Which roles best match my React, TypeScript and Supabase stack?',
    'Which jobs align with my agentic AI pipeline experience?',
    'Show DevRel roles that match my community building background',
    'Which high-scoring roles fit my UX Engineer and AI builder profile?',
    'Which companies in my pipeline work in AI or developer tooling?',
    'Where does my Lean Six Sigma background add value in the pipeline?',
    'Which roles match my Berlin or Remote Europe location preference?',
    'What skills from my background appear most in top-scored jobs?',
  ]},
]

export default function PipelineVisualization() {
  const [selected, setSelected]           = useState<string | null>(null)
  const [showAllSources, setShowAllSources] = useState(false)
  const [cogneeQuery, setCogneeQuery]     = useState('')
  const [cogneeMessages, setCogneeMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; links?: JobSearchLink[] }>>([])
  const [cogneeLoading, setCogneeLoading] = useState(false)
  const [scoutStatus, setScoutStatus]     = useState('')
  const [scouting, setScouting]           = useState(false)
  const [seedingProfile, setSeedingProfile] = useState(false)
  const [profileSeeded, setProfileSeeded]   = useState(false)
  const [pipelineOpen, setPipelineOpen]   = useState(false)

  const cogneeActive = true // local fallback always works

  async function handleRunScout() {
    setScouting(true)
    setScoutStatus('Running…')
    try {
      const count = await runScoutOnly()
      setScoutStatus(`✓ ${count} new jobs found`)
    } catch (err) {
      setScoutStatus(`⚠ ${(err as Error).message}`)
    } finally {
      setScouting(false)
      setTimeout(() => setScoutStatus(''), 5000)
    }
  }

  async function handleSeedProfile() {
    setSeedingProfile(true)
    await cogneeRememberProfile()
    setSeedingProfile(false)
    setProfileSeeded(true)
    setTimeout(() => setProfileSeeded(false), 3000)
  }

  async function handleCogneeQuery(overrideQuery?: string) {
    const q = (overrideQuery ?? cogneeQuery).trim()
    if (!q || cogneeLoading) return

    // Prior turns become context so follow-ups resolve ("what about the second one?").
    // Bounded: last 6 turns, each truncated, to keep the prompt small.
    const transcript = cogneeMessages
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`)
      .join('\n')
    const contextualQuery = transcript
      ? `Conversation so far:\n${transcript}\n\nFollow-up question: ${q}`
      : q

    setCogneeMessages(prev => [...prev, { role: 'user', content: q }])
    setCogneeQuery('')
    setCogneeLoading(true)

    let answer = await cogneeSearch(contextualQuery)
    let links: JobSearchLink[] = []
    const cogneeUnavailable = !answer || answer.startsWith('⚠')

    if (cogneeUnavailable) {
      const local = await localJobSearch(contextualQuery)
      answer = local.answer || 'No results — add a job or run Scout first.'
      links = local.links
    }

    setCogneeMessages(prev => [...prev, { role: 'assistant', content: answer, links }])
    setCogneeLoading(false)
  }

  const selectedAgent   = AGENTS.find(a => a.id === selected)
  const visibleSources  = showAllSources ? DATA_SOURCES : DATA_SOURCES.slice(0, 6)

  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: 'Space Mono, monospace', color: TEXT1 }}>

      <SharedNav />

      {/* Action bar */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: SURFACE }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: '10px', color: GREEN, letterSpacing: '1px' }}>LIVE — 3 USERS</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {scoutStatus && (
            <span style={{ fontSize: '10px', color: scoutStatus.startsWith('✓') ? GREEN : scoutStatus.startsWith('⚠') ? ORANGE : TEXT2 }}>
              {scoutStatus}
            </span>
          )}
          <button
            onClick={handleRunScout}
            disabled={scouting}
            style={{ background: scouting ? CHIP : `${TEAL}14`, border: `1px solid ${TEAL}55`, borderRadius: '3px', padding: '5px 14px', color: scouting ? TEXT3 : TEAL, fontSize: '10px', letterSpacing: '1px', cursor: scouting ? 'not-allowed' : 'pointer' }}
          >
            {scouting ? 'RUNNING…' : 'RUN SCOUT'}
          </button>
        </div>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: '1000px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-1px', color: TEXT1 }}>
            INTEL
          </h1>
          <p style={{ color: TEXT2, fontSize: '12px', marginTop: '6px', fontFamily: 'Space Mono', margin: '6px 0 0' }}>
            Query your pipeline · profile-aware · powered by local data + LLM
          </p>
        </div>

        {/* ── QUERY HERO ── */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: cogneeMessages.length ? '16px' : '20px' }}>
            <input
              type="text"
              value={cogneeQuery}
              onChange={e => setCogneeQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCogneeQuery()}
              placeholder="Ask anything about your pipeline — 'which jobs fit my stack?' or 'any interviews scheduled?'"
              autoFocus
              style={{
                flex: 1, background: BG, border: `1.5px solid ${BORDER}`, borderRadius: '6px',
                padding: '11px 14px', color: TEXT1, fontSize: '13px',
                fontFamily: 'Space Mono, monospace', outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = PURPLE }}
              onBlur={e => { e.currentTarget.style.borderColor = BORDER }}
            />
            <button
              onClick={() => handleCogneeQuery()}
              disabled={cogneeLoading || !cogneeQuery.trim()}
              style={{
                background: cogneeLoading ? CHIP : PURPLE,
                border: 'none', borderRadius: '6px',
                padding: '11px 22px', color: cogneeLoading ? TEXT3 : '#fff',
                fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
                fontFamily: 'Space Mono, monospace',
                cursor: cogneeLoading || !cogneeQuery.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {cogneeLoading ? '…' : 'ASK →'}
            </button>
          </div>

          {/* Conversation thread */}
          {cogneeMessages.length > 0 && (
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '460px', overflowY: 'auto' }}>
              {cogneeMessages.map((m, i) => (
                m.role === 'user' ? (
                  <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', background: BG, border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '9px 13px', fontSize: '12px', color: TEXT1, whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                ) : (
                  <div key={i}>
                    <div style={{ background: `${PURPLE}08`, border: `1px solid ${PURPLE}20`, borderRadius: '6px', padding: '14px 16px', fontSize: '12px', color: TEXT1, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                      {m.content}
                    </div>
                    {m.links && m.links.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                        {m.links.map(link => (
                          <div key={link.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG, border: `1px solid ${BORDER}`, borderRadius: '5px', padding: '9px 13px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', color: TEXT1, fontFamily: 'Syne, sans-serif', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {link.title}
                              </div>
                              <div style={{ fontSize: '10px', color: TEXT2, marginTop: '2px' }}>
                                {link.company} · {link.meta}
                              </div>
                            </div>
                            {link.url ? (
                              <a href={link.url} target="_blank" rel="noopener noreferrer"
                                style={{ flexShrink: 0, marginLeft: '12px', fontSize: '10px', color: link.source === 'pipeline' ? TEAL : PURPLE, border: `1px solid ${link.source === 'pipeline' ? TEAL : PURPLE}44`, borderRadius: '3px', padding: '3px 10px', textDecoration: 'none', letterSpacing: '1px', whiteSpace: 'nowrap' }}
                              >OPEN ↗</a>
                            ) : (
                              <span style={{ flexShrink: 0, marginLeft: '12px', fontSize: '10px', color: TEXT3, letterSpacing: '1px' }}>NO URL</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              ))}
              {cogneeLoading && (
                <div style={{ alignSelf: 'flex-start', fontSize: '11px', color: TEXT3, fontFamily: 'Space Mono, monospace' }}>…thinking</div>
              )}
              <button onClick={() => { setCogneeMessages([]); setCogneeQuery('') }}
                style={{ alignSelf: 'flex-start', marginTop: '4px', background: 'none', border: 'none', color: TEXT3, fontSize: '10px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', padding: 0 }}>
                ← clear conversation
              </button>
            </div>
          )}

          {/* Presets */}
          {cogneeMessages.length === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {PRESET_GROUPS.map(({ label, queries }) => (
                <div key={label}>
                  <div style={{ fontSize: '9px', color: TEXT3, letterSpacing: '2px', marginBottom: '8px' }}>{label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {queries.map(q => (
                      <button key={q} onClick={() => handleCogneeQuery(q)}
                        style={{ background: 'none', border: 'none', padding: '4px 0', color: TEXT2, fontSize: '11px', fontFamily: 'Space Mono, monospace', cursor: 'pointer', textAlign: 'left', display: 'block', width: '100%', transition: 'color 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = PURPLE }}
                        onMouseLeave={e => { e.currentTarget.style.color = TEXT2 }}
                      >
                        → {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── PIPELINE ARCHITECTURE (collapsible) ── */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <button
            onClick={() => setPipelineOpen(o => !o)}
            style={{ width: '100%', background: 'none', border: 'none', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}
          >
            <div style={{ display: 'flex', align: 'center', gap: '10px' }}>
              <span style={{ fontSize: '10px', color: TEXT2, letterSpacing: '2px' }}>PIPELINE ARCHITECTURE</span>
              <span style={{ fontSize: '10px', color: TEXT3, marginLeft: '10px' }}>9 agents · 14 sources · 3 CV tracks</span>
            </div>
            <span style={{ fontSize: '12px', color: TEXT3 }}>{pipelineOpen ? '▲' : '▼'}</span>
          </button>

          {pipelineOpen && (
            <div style={{ borderTop: `1px solid ${BORDER}`, padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 200px', gap: '24px', alignItems: 'start' }}>

                {/* LEFT — Data Sources */}
                <div>
                  <div style={{ fontSize: '9px', color: TEXT3, letterSpacing: '2px', marginBottom: '10px' }}>DATA SOURCES ({DATA_SOURCES.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {visibleSources.map(s => (
                      <div key={s.name} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '3px', padding: '5px 9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: TEXT1 }}>{s.name}</span>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <span style={{ fontSize: '9px', color: TEXT3, background: CHIP, padding: '1px 5px', borderRadius: '2px' }}>{s.type}</span>
                          <span style={{ fontSize: '9px', color: TEXT3, background: CHIP, padding: '1px 5px', borderRadius: '2px' }}>{s.geo}</span>
                        </div>
                      </div>
                    ))}
                    {!showAllSources && (
                      <button onClick={() => setShowAllSources(true)}
                        style={{ background: 'transparent', border: `1px dashed ${BORDER}`, borderRadius: '3px', padding: '5px 9px', color: TEXT3, fontSize: '11px', cursor: 'pointer', textAlign: 'left' }}>
                        + {DATA_SOURCES.length - 6} more
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <div style={{ width: 1, height: 24, background: `linear-gradient(${TEAL}, transparent)`, margin: '0 auto 4px', opacity: 0.3 }} />
                    <span style={{ fontSize: '9px', color: TEXT3 }}>14 parallel fetches</span>
                  </div>
                </div>

                {/* CENTER — Agents */}
                <div>
                  {AGENTS.map((agent, i) => (
                    <div key={agent.id}>
                      {agent.branches && (
                        <div style={{ display: 'flex', gap: '6px', margin: '6px 0', justifyContent: 'center' }}>
                          {CV_TRACKS.map(t => (
                            <div key={t.key} style={{ flex: 1, border: `1px solid ${t.color}30`, borderRadius: '3px', padding: '5px 7px', textAlign: 'center', background: `${t.color}06` }}>
                              <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.color, margin: '0 auto 3px' }} />
                              <div style={{ fontSize: '9px', color: t.color, letterSpacing: '1px' }}>{t.key.toUpperCase()}</div>
                              <div style={{ fontSize: '9px', color: TEXT2, marginTop: '1px' }}>{t.label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        onClick={() => setSelected(selected === agent.id ? null : agent.id)}
                        style={{
                          border: `1px solid ${selected === agent.id ? agent.color : (agent.isGate ? `${AMBER}40` : BORDER)}`,
                          borderLeft: `3px solid ${agent.color}`,
                          borderRadius: '4px', padding: '11px 16px', cursor: 'pointer',
                          background: selected === agent.id ? `${agent.color}06` : (agent.isGate ? `${AMBER}04` : SURFACE),
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', color: agent.isGate ? AMBER : TEXT1 }}>{agent.label}</span>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: TEXT3, background: CHIP, border: `1px solid ${BORDER}`, padding: '1px 7px', borderRadius: '2px' }}>{agent.model}</span>
                            <span style={{ fontSize: '10px', color: TEXT3 }}>→ {agent.table}</span>
                          </div>
                        </div>
                        {selected === agent.id && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${BORDER}` }}>
                            <p style={{ fontSize: '12px', color: TEXT2, margin: '0 0 8px', lineHeight: 1.6 }}>{agent.description}</p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span style={{ fontSize: '10px', color: agent.color, background: `${agent.color}10`, border: `1px solid ${agent.color}30`, padding: '2px 8px', borderRadius: '2px' }}>
                                OUTPUT: {agent.output}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      {i < AGENTS.length - 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3px 0' }}>
                          <div style={{ width: 1, height: 14, background: `linear-gradient(${agent.color}55, ${AGENTS[i + 1].color}33)` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* RIGHT — Tables + Providers */}
                <div>
                  <div style={{ fontSize: '9px', color: TEXT3, letterSpacing: '2px', marginBottom: '10px' }}>SUPABASE TABLES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {SUPABASE_TABLES.map(t => (
                      <div key={t.name} style={{ border: `1px solid ${t.color}20`, borderLeft: `2px solid ${t.color}60`, borderRadius: '3px', padding: '7px 9px', background: `${t.color}04` }}>
                        <div style={{ fontSize: '10px', color: t.color, fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: '9px', color: TEXT2, marginTop: '1px' }}>{t.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '9px', color: TEXT3, letterSpacing: '2px', marginBottom: '10px' }}>AI PROVIDERS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                      { name: 'Groq',       use: 'Classifier (fast)',   color: ORANGE },
                      { name: 'OpenRouter', use: 'Documents (free)',    color: PURPLE },
                      { name: 'Anthropic',  use: 'Fallback / direct',  color: TEAL },
                    ].map(p => (
                      <div key={p.name} style={{ background: BG, border: `1px solid ${BORDER}`, borderLeft: `2px solid ${p.color}`, borderRadius: '3px', padding: '5px 9px' }}>
                        <div style={{ fontSize: '10px', color: p.color, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: '9px', color: TEXT2 }}>{p.use}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ marginTop: '24px', display: 'flex', gap: '28px', borderTop: `1px solid ${BORDER}`, paddingTop: '20px' }}>
                {[
                  { label: 'DATA SOURCES', value: '14',      color: TEAL },
                  { label: 'AGENTS',       value: '9',       color: TEAL },
                  { label: 'CV TRACKS',    value: '3',       color: TEAL },
                  { label: 'ACTIVE USERS', value: '3',       color: TEXT2 },
                  { label: 'HUMAN GATES',  value: '1',       color: AMBER },
                  { label: 'DEPLOY',       value: 'CF Pages', color: TEXT2 },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'Syne, sans-serif', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '9px', color: TEXT3, letterSpacing: '1px', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
