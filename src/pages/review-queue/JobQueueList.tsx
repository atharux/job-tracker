import React from 'react'
import type { ReviewQueueRecord } from '../../agents/types'

interface Props {
  records: ReviewQueueRecord[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const TRACK_COLORS: Record<string, string> = {
  ux: '#06b6d4',
  pm: '#8b5cf6',
  devrel: '#f97316',
}

const STATUS_COLORS: Record<string, string> = {
  pending_review: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  submitted: '#06b6d4',
  archived: '#475569',
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null

  // Interpolate color: red (1) → yellow (5) → teal (10)
  let color: string
  if (score <= 5) {
    const t = (score - 1) / 4
    const r = Math.round(239 + t * (234 - 239))
    const g = Math.round(68 + t * (179 - 68))
    const b = Math.round(68 + t * (8 - 68))
    color = `rgb(${r},${g},${b})`
  } else {
    const t = (score - 5) / 5
    const r = Math.round(234 + t * (6 - 234))
    const g = Math.round(179 + t * (182 - 179))
    const b = Math.round(8 + t * (212 - 8))
    color = `rgb(${r},${g},${b})`
  }

  return (
    <span style={{
      fontFamily: 'Space Mono, monospace',
      fontSize: '0.7rem',
      fontWeight: 700,
      color,
      border: `1px solid ${color}`,
      padding: '1px 6px',
      borderRadius: '3px',
      minWidth: '32px',
      textAlign: 'center',
      display: 'inline-block',
    }}>
      {score.toFixed(1)}
    </span>
  )
}

export default function JobQueueList({ records, selectedId, onSelect }: Props) {
  if (records.length === 0) {
    return (
      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>
        QUEUE EMPTY
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {records.map((record) => {
        const job = record.job
        const isSelected = record.id === selectedId
        const trackColor = record.cv_track ? TRACK_COLORS[record.cv_track] : '#475569'
        const statusColor = STATUS_COLORS[record.status] ?? '#475569'

        return (
          <button
            key={record.id}
            onClick={() => onSelect(record.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '0.875rem 1rem',
              background: isSelected ? 'rgba(139,92,246,0.08)' : 'transparent',
              borderLeft: isSelected ? '2px solid #8b5cf6' : '2px solid transparent',
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: '1px solid #0f0f1a',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ color: '#e2e8f0', fontFamily: 'Syne, sans-serif', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3, flex: 1 }}>
                {job?.company ?? '—'}
              </span>
              <ScoreBadge score={record.classifier_score} />
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '0.4rem', lineHeight: 1.3 }}>
              {job?.title ?? '—'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {record.cv_track && (
                <span style={{
                  display: 'inline-block',
                  width: '8px', height: '8px',
                  borderRadius: '50%',
                  background: trackColor,
                  flexShrink: 0,
                }} title={record.cv_track.toUpperCase()} />
              )}
              <span style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.62rem',
                color: statusColor,
                textTransform: 'uppercase',
              }}>
                {record.status.replace('_', ' ')}
              </span>
              {job?.location && (
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#374151' }}>
                  · {job.location}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
