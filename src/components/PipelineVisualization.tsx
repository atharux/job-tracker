import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const TEAL = '#06b6d4'
const PURPLE = '#8b5cf6'
const ORANGE = '#f97316'
const AMBER = '#f59e0b'
const GREEN = '#22c55e'

const DATA_SOURCES = [
  { name: 'Arbeitnow', type: 'REST', geo: 'EU' },
  { name: 'Remotive', type: 'REST', geo: 'Remote' },
  { name: 'GermanTechJobs', type: 'RSS', geo: 'DE' },
  { name: 'Greenhouse', type: 'REST', geo: 'Multi' },
  { name: 'SmartRecruiters', type: 'REST', geo: 'Multi' },
  { name: 'Lever', type: 'REST', geo: 'EU' },
  { name: 'Ashby', type: 'REST', geo: 'Startups' },
  { name: 'Recruitee', type: 'REST', geo: 'EU' },
  { name: 'WeWorkRemotely', type: 'RSS', geo: 'Remote' },
  { name: 'Jobicy', type: 'RSS', geo: 'Remote' },
  { name: 'RemoteOK', type: 'REST', geo: 'Remote' },
  { name: 'BerlinStartupJobs', type: 'RSS', geo: 'Berlin' },
  { name: 'EuropeRemotely', type: 'RSS', geo: 'EU' },
  { name: 'Proxy (5 more)', type: 'Edge Fn', geo: 'CORS' },
]

const AGENTS = [
  {
    id: 'scout',
    label: 'SCOUT',
    model: '14 free APIs',
    description: 'Aggregates jobs from 14 sources in parallel. Deduplicates by URL. Keyword-matches against 60+ role titles across all 3 CV tracks.',
    output: 'ScoutResult[]',
    table: 'jobs',
    color: TEAL,
  },
  {
    id: 'classifier',
    label: 'CLASSIFIER',
    model: 'Groq (llama-3.3)',
    description: 'Scores each job 0–10 against your profile. Assigns CV track (ux/pm/devrel). Filters out scores below 3.0.',
    output: 'ClassifierResult',
    table: 'agent_runs',
    color: TEAL,
  },
  {
    id: 'cvselector',
    label: 'CV SELECTOR',
    model: 'Supabase query',
    description: 'Picks the right CV version from Supabase based on the classified track. Three tracks: UX Engineer, Product Manager, Developer Relations.',
    output: 'cv_track + base CV',
    table: 'cv_versions',
    color: TEAL,
    branches: true,
  },
  {
    id: 'resumetailor',
    label: 'RESUME TAILOR',
    model: 'OpenRouter (free)',
    description: 'Rewrites CV bullets to mirror the job description language. Track-specific emphasis. Preserves all truthful content.',
    output: 'tailored_resume',
    table: 'application_artifacts',
    color: TEAL,
  },
  {
    id: 'coverletter',
    label: 'COVER LETTER',
    model: 'OpenRouter (free)',
    description: 'Generates a 3-paragraph cover letter from the tailored CV + JD. Tone matches the track voice.',
    output: 'cover_letter',
    table: 'application_artifacts',
    color: TEAL,
  },
  {
    id: 'formmapper',
    label: 'FORM MAPPER',
    model: 'OpenRouter (free)',
    description: 'Maps application form fields to the tailored content. Handles custom questions, portfolio links, salary fields.',
    output: 'form_mapping',
    table: 'application_artifacts',
    color: TEAL,
  },
  {
    id: 'screenshot',
    label: 'SCREENSHOT',
    model: 'Cloudflare Puppeteer',
    description: 'Captures before/after screenshots of the job posting. Creates a visual audit trail for each application.',
    output: 'screenshot_urls',
    table: 'application_artifacts',
    color: TEAL,
  },
  {
    id: 'gatekeeper',
    label: 'REVIEW GATEKEEPER',
    model: '⚠ HUMAN IN THE LOOP',
    description: 'Hard gate — nothing is submitted without human approval. You review the tailored CV, cover letter, form mapping, and screenshots before approving.',
    output: 'approved / rejected',
    table: 'application_review_queue',
    color: AMBER,
    isGate: true,
  },
  {
    id: 'status',
    label: 'STATUS TRACKER',
    model: 'Gmail MCP',
    description: 'Monitors your inbox for responses. Tracks application state: applied → interview → offered → rejected / accepted.',
    output: 'application_status',
    table: 'jobs',
    color: GREEN,
  },
]

const SUPABASE_TABLES = [
  { name: 'jobs', desc: 'discovered postings + status', color: TEAL },
  { name: 'agent_runs', desc: 'full audit log per agent', color: '#64748b' },
  { name: 'application_artifacts', desc: 'resume, cover letter, form, screenshots', color: PURPLE },
  { name: 'application_review_queue', desc: 'human approval state machine', color: AMBER },
  { name: 'cv_versions', desc: 'base CV per track (ux/pm/devrel)', color: ORANGE },
]

const CV_TRACKS = [
  { key: 'ux', label: 'UX Engineer', color: TEAL },
  { key: 'pm', label: 'Product Manager', color: PURPLE },
  { key: 'devrel', label: 'Developer Relations', color: ORANGE },
]

const COGNEE_NODES = [
  'Company → Roles Graph',
  'Skills → Requirements Map',
  'Application History',
  'Outcome Patterns',
  'Sector Relationships',
]

export default function PipelineVisualization() {
  const [selected, setSelected] = useState<string | null>(null)
  const [showAllSources, setShowAllSources] = useState(false)

  const selectedAgent = AGENTS.find(a => a.id === selected)
  const visibleSources = showAllSources ? DATA_SOURCES : DATA_SOURCES.slice(0, 6)

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'Space Mono, monospace', color: '#e2e8f0' }}>

      {/* Nav */}
      <div style={{ borderBottom: '1px solid #1e293b', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: '12px' }}>← BACK TO TRACKER</Link>
        <div style={{ fontSize: '11px', color: '#64748b' }}>JOB TRACKER // PIPELINE ARCHITECTURE v2026</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: '11px', color: GREEN }}>LIVE — 3 USERS</span>
        </div>
      </div>

      {/* Langfuse bar */}
      <div style={{ background: '#0d1117', borderBottom: '1px solid #1a2e1a', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '10px', color: GREEN, letterSpacing: '2px' }}>LANGFUSE OBSERVABILITY</span>
        {['scout.run', 'classifier.score', 'resumeTailor.generate', 'coverLetter.generate', 'gate.review'].map(span => (
          <span key={span} style={{ fontSize: '10px', color: '#334155', background: '#111827', border: '1px solid #1e3a1e', padding: '2px 8px', borderRadius: '2px' }}>
            {span}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#334155' }}>+ traces wired to each agent call</span>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-1px' }}>
            9-AGENT JOB APPLICATION PIPELINE
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '8px', fontFamily: 'Space Mono' }}>
            Scout → Classify → Select → Tailor → Write → Map → Screenshot → Gate → Track
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 240px', gap: '24px', alignItems: 'start' }}>

          {/* LEFT — Data Sources */}
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '2px', marginBottom: '12px' }}>DATA SOURCES ({DATA_SOURCES.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {visibleSources.map(s => (
                <div key={s.name} style={{ background: '#0f1923', border: '1px solid #1e293b', borderRadius: '3px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{s.name}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ fontSize: '9px', color: '#475569', background: '#1e293b', padding: '1px 5px', borderRadius: '2px' }}>{s.type}</span>
                    <span style={{ fontSize: '9px', color: '#475569', background: '#1e293b', padding: '1px 5px', borderRadius: '2px' }}>{s.geo}</span>
                  </div>
                </div>
              ))}
              {!showAllSources && (
                <button
                  onClick={() => setShowAllSources(true)}
                  style={{ background: 'transparent', border: '1px dashed #1e293b', borderRadius: '3px', padding: '6px 10px', color: '#475569', fontSize: '11px', cursor: 'pointer', textAlign: 'left' }}
                >
                  + {DATA_SOURCES.length - 6} more sources
                </button>
              )}
            </div>

            {/* Arrow to Scout */}
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <div style={{ width: '1px', height: '32px', background: `linear-gradient(${TEAL}, transparent)`, margin: '0 auto 4px', opacity: 0.4 }} />
              <span style={{ fontSize: '10px', color: '#475569' }}>14 parallel fetches</span>
            </div>
          </div>

          {/* CENTER — Pipeline */}
          <div>
            {AGENTS.map((agent, i) => (
              <div key={agent.id}>
                {/* CV track branches after CV Selector */}
                {agent.branches && (
                  <div style={{ display: 'flex', gap: '8px', margin: '8px 0', justifyContent: 'center' }}>
                    {CV_TRACKS.map(t => (
                      <div key={t.key} style={{ flex: 1, border: `1px solid ${t.color}22`, borderRadius: '3px', padding: '6px 8px', textAlign: 'center', background: `${t.color}08` }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color, margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '9px', color: t.color, letterSpacing: '1px' }}>{t.key.toUpperCase()}</div>
                        <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{t.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agent node */}
                <div
                  onClick={() => setSelected(selected === agent.id ? null : agent.id)}
                  style={{
                    border: `1px solid ${selected === agent.id ? agent.color : (agent.isGate ? `${AMBER}44` : '#1e293b')}`,
                    borderRadius: '4px',
                    padding: '14px 20px',
                    cursor: 'pointer',
                    background: selected === agent.id ? `${agent.color}0a` : (agent.isGate ? '#1a1400' : '#0a0f1a'),
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: agent.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', color: agent.isGate ? AMBER : '#e2e8f0' }}>
                        {agent.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#475569', background: '#111827', border: '1px solid #1e293b', padding: '2px 7px', borderRadius: '2px' }}>
                        {agent.model}
                      </span>
                      <span style={{ fontSize: '10px', color: '#334155' }}>→ {agent.table}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {selected === agent.id && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${agent.color}22` }}>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.6 }}>{agent.description}</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '10px', color: agent.color, background: `${agent.color}11`, border: `1px solid ${agent.color}33`, padding: '2px 8px', borderRadius: '2px' }}>
                          OUTPUT: {agent.output}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b', background: '#111827', border: '1px solid #1e293b', padding: '2px 8px', borderRadius: '2px' }}>
                          TABLE: {agent.table}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Connector line */}
                {i < AGENTS.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{ width: 1, height: 16, background: `linear-gradient(${agent.color}66, ${AGENTS[i + 1].color}44)` }} />
                      <div style={{ fontSize: '8px', color: '#334155' }}>↓</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* RIGHT — Supabase */}
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '2px', marginBottom: '12px' }}>SUPABASE TABLES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SUPABASE_TABLES.map(t => (
                <div key={t.name} style={{ border: `1px solid ${t.color}22`, borderRadius: '3px', padding: '8px 10px', background: `${t.color}05` }}>
                  <div style={{ fontSize: '11px', color: t.color, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>{t.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px', fontSize: '10px', color: '#64748b', letterSpacing: '2px', marginBottom: '12px' }}>AI PROVIDERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { name: 'Groq', use: 'Classifier (fast inference)', color: ORANGE },
                { name: 'OpenRouter', use: 'Document agents (free)', color: PURPLE },
                { name: 'Anthropic', use: 'Fallback / SDK direct', color: TEAL },
              ].map(p => (
                <div key={p.name} style={{ background: '#0f1923', border: '1px solid #1e293b', borderRadius: '3px', padding: '6px 10px' }}>
                  <div style={{ fontSize: '11px', color: p.color }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: '#475569' }}>{p.use}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COGNEE Layer */}
        <div style={{ marginTop: '40px', border: `1px solid ${PURPLE}33`, borderRadius: '6px', padding: '24px', background: `${PURPLE}05`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 12, right: 16, fontSize: '9px', color: PURPLE, background: `${PURPLE}22`, border: `1px solid ${PURPLE}44`, padding: '3px 10px', borderRadius: '2px', letterSpacing: '2px' }}>
            NEW — HACKATHON ADDITION
          </div>

          <div style={{ fontSize: '10px', color: PURPLE, letterSpacing: '3px', marginBottom: '16px' }}>COGNEE KNOWLEDGE GRAPH LAYER</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.7 }}>
                Cognee adds persistent memory across every run. Instead of each application being stateless, the pipeline builds a knowledge graph of companies, roles, and required skills — so future runs get smarter.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { agent: 'Classifier', gain: 'scores anchored to outcome history, not just profile match' },
                  { agent: 'CV Selector', gain: 'track choice informed by which track got responses at this company' },
                  { agent: 'Resume Tailor', gain: 'bullets emphasise skills that appear across similar successful JDs' },
                ].map(row => (
                  <div key={row.agent} style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                    <span style={{ color: PURPLE, minWidth: '110px', fontWeight: 700 }}>{row.agent}</span>
                    <span style={{ color: '#64748b' }}>+ {row.gain}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {COGNEE_NODES.map((node, i) => {
                const angle = (i / COGNEE_NODES.length) * 2 * Math.PI
                return (
                  <div key={node} style={{ border: `1px solid ${PURPLE}44`, borderRadius: '3px', padding: '8px 12px', fontSize: '11px', color: `${PURPLE}cc`, background: `${PURPLE}08`, whiteSpace: 'nowrap' }}>
                    {node}
                  </div>
                )
              })}
              <div style={{ width: '100%', textAlign: 'center', fontSize: '10px', color: '#334155', marginTop: '4px' }}>
                graph persists across all pipeline runs
              </div>
            </div>
          </div>
        </div>

        {/* Stats footer */}
        <div style={{ marginTop: '32px', display: 'flex', gap: '32px', borderTop: '1px solid #1e293b', paddingTop: '24px' }}>
          {[
            { label: 'DATA SOURCES', value: '14' },
            { label: 'AGENTS', value: '9' },
            { label: 'CV TRACKS', value: '3' },
            { label: 'ACTIVE USERS', value: '3' },
            { label: 'HUMAN GATES', value: '1', color: AMBER },
            { label: 'DEPLOY', value: 'CF Pages' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '22px', fontWeight: 900, fontFamily: 'Syne, sans-serif', color: s.color || TEAL }}>{s.value}</div>
              <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '1px', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
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
