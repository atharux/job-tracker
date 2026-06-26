import { useState } from 'react'
import { X, Zap, CheckCircle, XCircle, Loader } from 'lucide-react'
import { runManualJob, type AgentStatus } from '../services/agentOrchestrator'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const STEPS = [
  { key: 'classifier',       label: 'CLASSIFY' },
  { key: 'cvSelector',       label: 'CV SELECT' },
  { key: 'resumeTailor',     label: 'TAILOR' },
  { key: 'coverLetterWriter',label: 'COVER LETTER' },
  { key: 'formMapper',       label: 'FORM MAP' },
  { key: 'reviewGatekeeper', label: 'REVIEW QUEUE' },
]

type StepState = Record<string, AgentStatus | 'idle'>

export default function AddJobModal({ isOpen, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [jd, setJd] = useState('')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<StepState>({})

  function reset() {
    setUrl('')
    setJd('')
    setRunning(false)
    setDone(false)
    setError(null)
    setSteps({})
  }

  function handleClose() {
    if (!running) { reset(); onClose() }
  }

  async function handleRun() {
    if (!url.trim()) return
    setRunning(true)
    setDone(false)
    setError(null)
    setSteps({})

    try {
      await runManualJob(url.trim(), jd.trim(), (agent, status) => {
        setSteps(prev => ({ ...prev, [agent]: status }))
      })
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div style={{
        background: '#0d1117',
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: '2px solid #06b6d4',
        borderRadius: '8px',
        padding: '32px',
        width: '100%',
        maxWidth: '520px',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={16} color="#06b6d4" />
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.1em', color: '#06b6d4' }}>
              ADD JOB TO PIPELINE
            </span>
          </div>
          <button
            onClick={handleClose}
            disabled={running}
            style={{ background: 'transparent', border: 'none', cursor: running ? 'not-allowed' : 'pointer', color: '#475569', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* URL */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', letterSpacing: '0.1em', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            JOB URL *
          </label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={running || done}
            placeholder="https://jobs.lever.co/company/position"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px', padding: '10px 12px',
              fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#e2e8f0',
              outline: 'none',
            }}
          />
        </div>

        {/* JD */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', letterSpacing: '0.1em', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            JOB DESCRIPTION <span style={{ color: '#334155' }}>— paste for better tailoring</span>
          </label>
          <textarea
            value={jd}
            onChange={e => setJd(e.target.value)}
            disabled={running || done}
            placeholder="Paste the full job description here..."
            rows={6}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px', padding: '10px 12px',
              fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#94a3b8',
              lineHeight: 1.5, outline: 'none',
            }}
          />
        </div>

        {/* Progress steps */}
        {(running || done || error) && (
          <div style={{ marginBottom: '24px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STEPS.map(s => {
              const st = steps[s.key] ?? 'idle'
              const color = st === 'success' ? '#4ade80' : st === 'failed' ? '#f87171' : st === 'skipped' ? '#94a3b8' : st === 'running' ? '#06b6d4' : '#1e293b'
              return (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 8px', borderRadius: '3px',
                  border: `1px solid ${color}40`,
                  background: `${color}0a`,
                }}>
                  {st === 'running' && <Loader size={9} color={color} style={{ animation: 'spin 1s linear infinite' }} />}
                  {st === 'success' && <CheckCircle size={9} color={color} />}
                  {st === 'failed' && <XCircle size={9} color={color} />}
                  {(st === 'idle' || st === 'skipped') && <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />}
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '8px', letterSpacing: '0.08em', color }}>{s.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginBottom: '20px', padding: '10px 12px', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '4px' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#f87171' }}>{error}</span>
          </div>
        )}

        {/* Done */}
        {done && (
          <div style={{ marginBottom: '20px', padding: '10px 12px', background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '4px' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#4ade80' }}>
              Done — check Review Queue for your tailored CV and cover letter.
            </span>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {done ? (
            <button
              onClick={reset}
              style={{ padding: '9px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '10px', letterSpacing: '0.06em' }}
            >
              ADD ANOTHER
            </button>
          ) : (
            <button
              onClick={handleClose}
              disabled={running}
              style={{ padding: '9px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#475569', cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '10px', letterSpacing: '0.06em' }}
            >
              CANCEL
            </button>
          )}
          {!done && (
            <button
              onClick={handleRun}
              disabled={running || !url.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 20px',
                background: running || !url.trim() ? 'rgba(6,182,212,0.2)' : '#06b6d4',
                border: 'none', borderRadius: '4px',
                color: running || !url.trim() ? '#0e7490' : '#07080c',
                cursor: running || !url.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'Space Mono, monospace', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
              }}
            >
              {running ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> RUNNING…</> : 'RUN PIPELINE →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
