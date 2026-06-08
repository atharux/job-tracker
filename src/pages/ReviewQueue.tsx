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

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  pending_review: 'Pending',
  approved: 'Approved',
  submitted: 'Submitted',
  rejected: 'Rejected',
}

interface Props {
  onOpenSettings?: () => void
}

export default function ReviewQueue({ onOpenSettings }: Props) {
  const [records, setRecords] = useState<ReviewQueueRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [scouting, setScouting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('pending_review')
  const [scoutError, setScoutError] = useState<string | null>(null)
  const [showApiSettings, setShowApiSettings] = useState(false)

  const handleOpenSettings = onOpenSettings ?? (() => setShowApiSettings(true))

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
    setScouting(true)
    setScoutError(null)
    try {
      await runScoutOnly()
      await loadQueue()
    } catch (err) {
      setScoutError(err instanceof Error ? err.message : 'Scout failed')
    } finally {
      setScouting(false)
    }
  }

  const filteredRecords = records.filter((r) =>
    filter === 'all' ? true : r.status === filter
  )

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

          <button
            onClick={handleRunScout}
            disabled={scouting}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: scouting ? '#1e1e2e' : '#8b5cf6', border: 'none', borderRadius: '4px', color: scouting ? '#475569' : '#fff', cursor: scouting ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}
          >
            <Search size={12} />
            {scouting ? 'SCOUTING...' : 'RUN SCOUT'}
          </button>
        </div>
      </div>

      {scoutError && (
        <div style={{ padding: '0.6rem 1.5rem', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#ef4444', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}>
            ⚠ {scoutError}
          </span>
          {/api key|settings/i.test(scoutError) && (
            <button
              onClick={handleOpenSettings}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.6rem', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '3px', color: '#c4b5fd', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}
            >
              <Key size={10} /> ADD API KEY
            </button>
          )}
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

      <ApiKeySettings isOpen={showApiSettings} onClose={() => setShowApiSettings(false)} />
    </div>
  )
}
