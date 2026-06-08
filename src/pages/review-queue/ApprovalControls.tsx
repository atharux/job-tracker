import React, { useState } from 'react'
import { Check, X, Edit2, ExternalLink } from 'lucide-react'
import type { SubmissionResult } from '../../agents/submitter'

interface Props {
  jobId: string
  status: 'pending_review' | 'approved' | 'rejected' | 'submitted' | 'archived'
  generatingDocs?: boolean
  submissionResult?: SubmissionResult | null
  onApprove: (jobId: string, notes?: string) => Promise<void>
  onReject: (jobId: string, notes?: string) => Promise<void>
  onRunDocuments: (jobId: string) => Promise<void>
}

export default function ApprovalControls({
  jobId,
  status,
  generatingDocs = false,
  submissionResult,
  onApprove,
  onReject,
  onRunDocuments,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')

  const handleApprove = async () => {
    setBusy(true)
    try {
      await onApprove(jobId, notes || undefined)
      setShowNotesModal(null)
      setNotes('')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    setBusy(true)
    try {
      await onReject(jobId, notes || undefined)
      setShowNotesModal(null)
      setNotes('')
    } finally {
      setBusy(false)
    }
  }

  const handleRunDocuments = async () => {
    setBusy(true)
    try {
      await onRunDocuments(jobId)
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || generatingDocs || status === 'submitted'

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderTop: '1px solid #1e1e2e', flexWrap: 'wrap' }}>
        {status === 'pending_review' && (
          <>
            <button
              onClick={() => setShowNotesModal('approve')}
              disabled={disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                background: disabled ? '#1e1e2e' : '#06b6d4',
                color: disabled ? '#475569' : '#000',
                border: 'none', borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              <Check size={14} /> APPROVE &amp; SUBMIT
            </button>

            <button
              onClick={() => setShowNotesModal('reject')}
              disabled={disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                background: 'transparent',
                color: disabled ? '#475569' : '#ef4444',
                border: `1px solid ${disabled ? '#1e1e2e' : 'rgba(239,68,68,0.4)'}`,
                borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'Space Mono, monospace', fontSize: '0.75rem',
              }}
            >
              <X size={14} /> REJECT
            </button>
          </>
        )}

        <button
          onClick={handleRunDocuments}
          disabled={disabled}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            background: 'transparent',
            color: disabled ? '#475569' : '#8b5cf6',
            border: `1px solid ${disabled ? '#1e1e2e' : 'rgba(139,92,246,0.4)'}`,
            borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: 'Space Mono, monospace', fontSize: '0.75rem',
          }}
        >
          <Edit2 size={14} /> {generatingDocs ? 'GENERATING...' : busy ? 'RUNNING...' : 'REGENERATE DOCS'}
        </button>

        {status !== 'pending_review' && (
          <span style={{
            padding: '0.6rem 1rem',
            fontFamily: 'Space Mono, monospace', fontSize: '0.7rem',
            color: status === 'submitted' ? '#06b6d4' : status === 'approved' ? '#22c55e' : '#ef4444',
          }}>
            ● {status.toUpperCase()}
          </span>
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
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
                color: '#fdba74', textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              APPLY MANUALLY <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

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
                {busy ? '...' : showNotesModal === 'approve' ? 'CONFIRM APPROVE' : 'CONFIRM REJECT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
