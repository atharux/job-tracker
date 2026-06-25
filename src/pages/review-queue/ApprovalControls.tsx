import React, { useState } from 'react'
import { Check, X, Edit2, ExternalLink, RotateCcw, Send } from 'lucide-react'
import type { SubmissionResult } from '../../agents/submitter'

interface Props {
  jobId: string
  status: 'pending_review' | 'approved' | 'rejected' | 'submitted' | 'archived'
  generatingDocs?: boolean
  submissionResult?: SubmissionResult | null
  onApprove: (jobId: string, notes?: string) => Promise<void>
  onReject: (jobId: string, notes?: string) => Promise<void>
  onMarkSubmitted: (jobId: string) => Promise<void>
  onReopen: (jobId: string) => Promise<void>
  onRunDocuments: (jobId: string) => Promise<void>
}

const STATUS_COLOR: Record<string, string> = {
  pending_review: '#f59e0b',
  approved:       '#22c55e',
  submitted:      '#06b6d4',
  rejected:       '#ef4444',
  archived:       '#475569',
}

export default function ApprovalControls({
  jobId,
  status,
  generatingDocs = false,
  submissionResult,
  onApprove,
  onReject,
  onMarkSubmitted,
  onReopen,
  onRunDocuments,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const handleApprove = async () => run(async () => {
    await onApprove(jobId, notes || undefined)
    setShowNotesModal(null)
    setNotes('')
  })

  const handleReject = async () => run(async () => {
    await onReject(jobId, notes || undefined)
    setShowNotesModal(null)
    setNotes('')
  })

  const disabled = busy || generatingDocs

  const btn = (
    label: React.ReactNode,
    onClick: () => void,
    color: string,
    variant: 'solid' | 'outline' = 'outline',
    title?: string
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.55rem 1rem',
        background: disabled ? '#1e1e2e' : variant === 'solid' ? color : 'transparent',
        color: disabled ? '#475569' : variant === 'solid' ? '#000' : color,
        border: `1px solid ${disabled ? '#1e1e2e' : variant === 'solid' ? color : `${color}55`}`,
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Space Mono, monospace',
        fontSize: '0.7rem',
        fontWeight: variant === 'solid' ? 700 : 400,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )

  return (
    <>
      <div style={{
        display: 'flex', gap: '0.6rem', padding: '0.875rem 1rem',
        borderTop: '1px solid #1e1e2e', flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Status badge — always visible */}
        <span style={{
          padding: '0.35rem 0.75rem',
          background: `${STATUS_COLOR[status] ?? '#475569'}18`,
          border: `1px solid ${STATUS_COLOR[status] ?? '#475569'}44`,
          borderRadius: '3px',
          fontFamily: 'Space Mono, monospace', fontSize: '0.65rem',
          color: STATUS_COLOR[status] ?? '#475569',
          letterSpacing: '0.08em',
        }}>
          ● {status.replace('_', ' ').toUpperCase()}
        </span>

        <div style={{ width: '1px', height: '20px', background: '#1e293b', flexShrink: 0 }} />

        {/* pending_review: approve or reject */}
        {status === 'pending_review' && <>
          {btn(<><Check size={13} /> APPROVE &amp; SUBMIT</>, () => setShowNotesModal('approve'), '#06b6d4', 'solid')}
          {btn(<><X size={13} /> REJECT</>, () => setShowNotesModal('reject'), '#ef4444')}
        </>}

        {/* approved: mark as manually submitted, or reject */}
        {status === 'approved' && <>
          {btn(
            <><Send size={13} /> MARK AS SUBMITTED</>,
            () => run(() => onMarkSubmitted(jobId)),
            '#06b6d4', 'solid',
            'I applied manually — mark this as submitted without auto-submitting'
          )}
          {btn(<><X size={13} /> REJECT</>, () => setShowNotesModal('reject'), '#ef4444')}
          {btn(<><RotateCcw size={13} /> RE-OPEN</>, () => run(() => onReopen(jobId)), '#475569')}
        </>}

        {/* rejected: re-open to pending */}
        {status === 'rejected' && <>
          {btn(<><RotateCcw size={13} /> RE-OPEN</>, () => run(() => onReopen(jobId)), '#f59e0b')}
        </>}

        {/* submitted: read-only status, can only re-open */}
        {status === 'submitted' && <>
          {btn(<><RotateCcw size={13} /> RE-OPEN</>, () => run(() => onReopen(jobId)), '#475569')}
        </>}

        {/* Regenerate docs — always available unless submitted */}
        {status !== 'submitted' && (
          btn(
            <><Edit2 size={13} /> {generatingDocs ? 'GENERATING…' : busy ? 'RUNNING…' : 'REGENERATE DOCS'}</>,
            () => run(() => onRunDocuments(jobId)),
            '#8b5cf6'
          )
        )}
      </div>

      {/* Submission result banner */}
      {submissionResult && (
        <div style={{
          margin: '0 1rem 1rem',
          padding: '0.75rem 1rem',
          borderRadius: '4px',
          background: submissionResult.success
            ? 'rgba(6,182,212,0.08)'
            : submissionResult.requiresManual
              ? 'rgba(249,115,22,0.08)'
              : 'rgba(239,68,68,0.08)',
          border: `1px solid ${submissionResult.success ? 'rgba(6,182,212,0.25)' : submissionResult.requiresManual ? 'rgba(249,115,22,0.25)' : 'rgba(239,68,68,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.75rem', flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: submissionResult.success ? '#67e8f9' : submissionResult.requiresManual ? '#fdba74' : '#fca5a5', margin: '0 0 2px' }}>
              {submissionResult.success ? 'SUBMITTED' : submissionResult.requiresManual ? 'MANUAL APPLY REQUIRED' : 'SUBMISSION FAILED'}
            </p>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#64748b', margin: 0 }}>
              {submissionResult.message}
              {submissionResult.reference && ` — ref: ${submissionResult.reference}`}
            </p>
          </div>
          {submissionResult.requiresManual && submissionResult.applicationUrl && (
            <a
              href={submissionResult.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.75rem',
                background: 'rgba(249,115,22,0.15)',
                border: '1px solid rgba(249,115,22,0.35)',
                borderRadius: '3px',
                fontFamily: 'Space Mono, monospace', fontSize: '0.65rem',
                color: '#fdba74', textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              APPLY MANUALLY <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {/* Notes modal for approve / reject */}
      {showNotesModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowNotesModal(null)}
        >
          <div
            style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '1.5rem', width: '400px', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: 'Syne, sans-serif', color: '#e2e8f0', marginBottom: '1rem', fontSize: '1rem' }}>
              {showNotesModal === 'approve' ? 'Approve & Submit' : 'Reject Application'}
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              style={{ width: '100%', background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#e2e8f0', padding: '0.5rem', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'Space Mono, monospace', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNotesModal(null)}
                style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#475569', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}
              >
                CANCEL
              </button>
              <button
                onClick={showNotesModal === 'approve' ? handleApprove : handleReject}
                disabled={busy}
                style={{
                  padding: '0.5rem 1rem',
                  background: showNotesModal === 'approve' ? '#06b6d4' : '#ef4444',
                  border: 'none', borderRadius: '4px',
                  color: showNotesModal === 'approve' ? '#000' : '#fff',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', fontWeight: 700,
                }}
              >
                {busy ? '…' : showNotesModal === 'approve' ? 'CONFIRM APPROVE' : 'CONFIRM REJECT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
