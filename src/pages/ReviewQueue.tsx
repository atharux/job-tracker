import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Search, Key, Send, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import type { ReviewQueueRecord } from '../agents/types'
import { runScoutOnly, approveAndSubmit } from '../services/agentOrchestrator'
import type { SubmissionResult } from '../agents/submitter'
import JobQueueList from './review-queue/JobQueueList'
import JobDetailPanel from './review-queue/JobDetailPanel'
import ApiKeySettings from '../components/ApiKeySettings'

type StatusFilter = 'all' | 'pending_review' | 'approved' | 'submitted' | 'rejected'
type TrackFilter = 'all' | 'ux' | 'pm' | 'devrel'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  pending_review: 'Pending',
  approved: 'Approved',
  submitted: 'Submitted',
  rejected: 'Rejected',
}

const TRACK_META: Record<TrackFilter, { label: string; color: string }> = {
  all:    { label: 'All Tracks',  color: '#475569' },
  ux:     { label: 'UX Engineer', color: '#06b6d4' },
  pm:     { label: 'PM',          color: '#8b5cf6' },
  devrel: { label: 'DevRel',      color: '#f97316' },
}

interface BatchJobResult {
  id: string
  jobId: string
  company: string
  title: string
  result: SubmissionResult | null
  error: string | null
}

interface Props {
  onOpenSettings?: () => void
}

function hasApiKey(): boolean {
  return !!(
    localStorage.getItem('openrouter_api_key') ||
    localStorage.getItem('groq_api_key')
  )
}

export default function ReviewQueue({ onOpenSettings }: Props) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('forge.theme') || 'dark')
  }, [])

  const [records, setRecords] = useState<ReviewQueueRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [scouting, setScouting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('pending_review')
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all')
  const [scoutError, setScoutError] = useState<string | null>(null)
  const [showApiSettings, setShowApiSettings] = useState(false)
  const [keyPresent, setKeyPresent] = useState(hasApiKey)

  // Batch state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchPhase, setBatchPhase] = useState<'idle' | 'confirming' | 'running' | 'done'>('idle')
  const [batchResults, setBatchResults] = useState<BatchJobResult[]>([])
  const [batchProgress, setBatchProgress] = useState(0)

  const openSettings = onOpenSettings ?? (() => setShowApiSettings(true))

  const handleOpenSettings = () => {
    setScoutError(null)
    openSettings()
  }

  const handleSettingsClose = () => {
    setShowApiSettings(false)
    setKeyPresent(hasApiKey())
    if (hasApiKey()) setScoutError(null)
  }

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('application_review_queue')
      .select(`*, job:jobs(*)`)
      .order('classifier_score', { ascending: false })

    if (!error && data) setRecords(data as ReviewQueueRecord[])
    setLoading(false)
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])

  // Clear selection when filter/track changes
  useEffect(() => { setSelectedIds(new Set()) }, [filter, trackFilter])

  const handleRunScout = async () => {
    if (!hasApiKey()) {
      setKeyPresent(false)
      handleOpenSettings()
      return
    }
    setScouting(true)
    setScoutError(null)
    try {
      await runScoutOnly()
      await loadQueue()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scout failed'
      setScoutError(msg)
      if (/api key|no key|not found/i.test(msg)) handleOpenSettings()
    } finally {
      setScouting(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pendingSelected = filteredRecords().filter(r => selectedIds.has(r.id))

  function filteredRecords() {
    return records.filter((r) => {
      const statusOk = filter === 'all' || r.status === filter
      const trackOk = trackFilter === 'all' || r.cv_track === trackFilter
      return statusOk && trackOk
    })
  }

  async function runBatchSubmit() {
    setBatchPhase('running')
    setBatchProgress(0)
    const toSubmit = pendingSelected
    const results: BatchJobResult[] = toSubmit.map(r => ({
      id: r.id,
      jobId: r.job_id,
      company: r.job?.company ?? '—',
      title: r.job?.title ?? '—',
      result: null,
      error: null,
    }))
    setBatchResults([...results])

    for (let i = 0; i < toSubmit.length; i++) {
      const record = toSubmit[i]
      try {
        const result = await approveAndSubmit(record.job_id)
        results[i] = { ...results[i], result }
      } catch (err) {
        results[i] = { ...results[i], error: err instanceof Error ? err.message : 'Failed' }
      }
      setBatchResults([...results])
      setBatchProgress(i + 1)
    }

    setSelectedIds(new Set())
    setBatchPhase('done')
    await loadQueue()
  }

  const filtered = filteredRecords()
  const selectedRecord = records.find((r) => r.id === selectedId) ?? null

  const counts: Record<StatusFilter, number> = {
    all: records.length,
    pending_review: records.filter((r) => r.status === 'pending_review').length,
    approved: records.filter((r) => r.status === 'approved').length,
    submitted: records.filter((r) => r.status === 'submitted').length,
    rejected: records.filter((r) => r.status === 'rejected').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1e1e2e', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', textDecoration: 'none', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}
          >
            <ArrowLeft size={14} /> FORGE
          </Link>
          <span style={{ color: '#1e1e2e' }}>·</span>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
            REVIEW QUEUE
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={loadQueue}
            disabled={loading}
            title="Refresh queue"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#475569', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            REFRESH
          </button>

          {!keyPresent ? (
            <button
              onClick={handleOpenSettings}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#f97316', border: 'none', borderRadius: '4px', color: '#07080c', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}
            >
              <Key size={12} />
              ADD API KEY
            </button>
          ) : (
            <button
              onClick={handleRunScout}
              disabled={scouting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: scouting ? '#1e1e2e' : '#8b5cf6', border: 'none', borderRadius: '4px', color: scouting ? '#475569' : '#fff', cursor: scouting ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}
            >
              <Search size={12} />
              {scouting ? 'SCOUTING...' : 'RUN SCOUT'}
            </button>
          )}
        </div>
      </div>

      {/* No-key banner */}
      {!keyPresent && (
        <div style={{ padding: '0.65rem 1.5rem', background: 'rgba(249,115,22,0.07)', borderBottom: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Key size={13} style={{ color: '#fb923c', flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', flex: 1 }}>
            Agents need an API key to run. Groq is free —&nbsp;
            <button
              onClick={handleOpenSettings}
              style={{ background: 'none', border: 'none', padding: 0, color: '#fb923c', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              add one in Settings ↗
            </button>
          </span>
        </div>
      )}

      {/* Scout error banner */}
      {scoutError && keyPresent && (
        <div style={{ padding: '0.6rem 1.5rem', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#ef4444', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}>
            ⚠ {scoutError}
          </span>
          <button
            onClick={() => setScoutError(null)}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', padding: '0 4px' }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Batch action bar */}
      {selectedIds.size > 0 && filter === 'pending_review' && (
        <div style={{ padding: '0.6rem 1.5rem', background: 'rgba(139,92,246,0.1)', borderBottom: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#a78bfa' }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setBatchPhase('confirming')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.875rem', background: '#8b5cf6', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', fontWeight: 700 }}
          >
            <Send size={11} />
            SUBMIT SELECTED ({selectedIds.size})
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid #374151', borderRadius: '4px', color: '#475569', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}
          >
            <X size={11} /> CLEAR
          </button>
        </div>
      )}

      {/* Status filters */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #1e1e2e', padding: '0 1.5rem' }}>
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '0.6rem 0.875rem',
              background: 'transparent',
              border: 'none',
              borderBottom: filter === s ? '2px solid #8b5cf6' : '2px solid transparent',
              color: filter === s ? '#e2e8f0' : '#475569',
              cursor: 'pointer',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.65rem',
              marginBottom: '-1px',
              whiteSpace: 'nowrap',
            }}
          >
            {STATUS_LABELS[s]}
            <span style={{ marginLeft: '0.4rem', color: filter === s ? '#8b5cf6' : '#374151' }}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Track filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', borderBottom: '1px solid #0f0f1a', background: 'rgba(255,255,255,0.01)' }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#374151', marginRight: '0.25rem', letterSpacing: '0.08em' }}>TRACK</span>
        {(Object.keys(TRACK_META) as TrackFilter[]).map((t) => {
          const { label, color } = TRACK_META[t]
          const active = trackFilter === t
          return (
            <button
              key={t}
              onClick={() => setTrackFilter(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.25rem 0.6rem',
                background: active ? `${color}18` : 'transparent',
                border: `1px solid ${active ? color : '#1e1e2e'}`,
                borderRadius: '3px',
                color: active ? color : '#475569',
                cursor: 'pointer',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.62rem',
                transition: 'all 0.1s',
              }}
            >
              {t !== 'all' && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? color : '#374151', flexShrink: 0 }} />
              )}
              {label}
            </button>
          )
        })}
      </div>

      {/* Main split layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '30% 70%', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ borderRight: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>
              LOADING...
            </div>
          ) : (
            <JobQueueList
              records={filtered}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />
          )}
        </div>

        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selectedRecord ? (
            <JobDetailPanel
              record={selectedRecord}
              onStatusChange={loadQueue}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#374151', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>
              SELECT A JOB FROM THE LIST
            </div>
          )}
        </div>
      </div>

      <ApiKeySettings isOpen={showApiSettings} onClose={handleSettingsClose} />

      {/* Batch confirmation modal */}
      {batchPhase === 'confirming' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setBatchPhase('idle')}
        >
          <div
            style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '1.5rem', width: '480px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: 'Syne, sans-serif', color: '#e2e8f0', marginBottom: '0.25rem', fontSize: '1rem' }}>
              Submit {selectedIds.size} Application{selectedIds.size > 1 ? 's' : ''}
            </h3>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569', marginBottom: '1rem' }}>
              Each will be approved and submitted sequentially. This cannot be undone.
            </p>

            <div style={{ overflowY: 'auto', flex: 1, marginBottom: '1rem', borderTop: '1px solid #1e1e2e', borderBottom: '1px solid #1e1e2e' }}>
              {pendingSelected.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #0f0f1a' }}>
                  <div>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.85rem', color: '#e2e8f0' }}>{r.job?.company ?? '—'}</span>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569', display: 'block' }}>{r.job?.title ?? '—'}</span>
                  </div>
                  {r.classifier_score !== null && (
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#8b5cf6' }}>{r.classifier_score?.toFixed(1)}</span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBatchPhase('idle')}
                style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#475569', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}
              >
                CANCEL
              </button>
              <button
                onClick={runBatchSubmit}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#8b5cf6', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', fontWeight: 700 }}
              >
                <Send size={12} />
                CONFIRM SUBMIT ALL ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch progress / results modal */}
      {(batchPhase === 'running' || batchPhase === 'done') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '1.5rem', width: '500px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', color: '#e2e8f0', fontSize: '1rem', margin: 0 }}>
                {batchPhase === 'running'
                  ? `Submitting… ${batchProgress} / ${batchResults.length}`
                  : `Done — ${batchResults.filter(r => r.result?.success).length} submitted, ${batchResults.filter(r => !r.result?.success || r.error).length} manual`
                }
              </h3>
              {batchPhase === 'done' && (
                <button
                  onClick={() => setBatchPhase('idle')}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Progress bar */}
            {batchPhase === 'running' && (
              <div style={{ height: '3px', background: '#1e1e2e', borderRadius: '2px', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#8b5cf6', width: `${(batchProgress / batchResults.length) * 100}%`, transition: 'width 0.3s' }} />
              </div>
            )}

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {batchResults.map((item) => {
                const pending = item.result === null && item.error === null
                const success = item.result?.success === true
                const manual = item.result?.requiresManual
                const failed = item.error !== null || item.result?.success === false

                return (
                  <div key={item.id} style={{ padding: '0.65rem 0', borderBottom: '1px solid #0f0f1a', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: '1px' }}>
                      {pending ? '⏳' : success ? '✓' : manual ? '↗' : '✗'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.82rem', color: '#e2e8f0' }}>{item.company}</span>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: success ? '#06b6d4' : manual ? '#f97316' : failed ? '#ef4444' : '#475569', flexShrink: 0 }}>
                          {pending ? 'PENDING' : success ? 'SUBMITTED' : manual ? 'MANUAL' : 'FAILED'}
                        </span>
                      </div>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#475569', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </p>
                      {(item.result?.message || item.error) && (
                        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#374151', margin: '2px 0 0' }}>
                          {item.error ?? item.result?.message}
                        </p>
                      )}
                      {item.result?.requiresManual && item.result.applicationUrl && (
                        <a
                          href={item.result.applicationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#f97316', textDecoration: 'none' }}
                        >
                          APPLY MANUALLY ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {batchPhase === 'done' && (
              <button
                onClick={() => setBatchPhase('idle')}
                style={{ marginTop: '1rem', padding: '0.5rem', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#475569', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}
              >
                CLOSE
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
