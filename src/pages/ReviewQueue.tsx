import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Search, Key } from 'lucide-react'
import { supabase } from '../supabaseClient'
import type { ReviewQueueRecord } from '../agents/types'
import { runScoutOnly } from '../services/agentOrchestrator'
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
  // This is a separate route — apply the persisted theme so it isn't dark-only.
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

  const openSettings = onOpenSettings ?? (() => setShowApiSettings(true))

  const handleOpenSettings = () => {
    setScoutError(null)
    openSettings()
  }

  // Re-check key status when settings modal closes
  const handleSettingsClose = () => {
    setShowApiSettings(false)
    setKeyPresent(hasApiKey())
    // If a key was just added, clear any prior error
    if (hasApiKey()) setScoutError(null)
  }

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('application_review_queue')
      .select(`
        *,
        job:jobs(*)
      `)
      .order('classifier_score', { ascending: false })

    if (!error && data) {
      setRecords(data as ReviewQueueRecord[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const handleRunScout = async () => {
    // Pre-flight: open settings immediately if no key present
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
      // If the error is still about missing key, open settings automatically
      if (/api key|no key|not found/i.test(msg)) {
        handleOpenSettings()
      }
    } finally {
      setScouting(false)
    }
  }

  const filteredRecords = records.filter((r) => {
    const statusOk = filter === 'all' || r.status === filter
    const trackOk = trackFilter === 'all' || r.cv_track === trackFilter
    return statusOk && trackOk
  })

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

      {/* No-key banner (persistent until key added) */}
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

      {/* Scout error banner (non-key errors) */}
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
        {/* Left — job list */}
        <div style={{ borderRight: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>
              LOADING...
            </div>
          ) : (
            <JobQueueList
              records={filteredRecords}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
          )}
        </div>

        {/* Right — detail panel */}
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
    </div>
  )
}
