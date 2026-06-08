import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import type { ReviewQueueRecord, TailoredResume, CoverLetter, FormMapping, ScreenshotResult } from '../../agents/types'
import type { SubmissionResult } from '../../agents/submitter'
import ResumeDiffViewer from './ResumeDiffViewer'
import CoverLetterPreview from './CoverLetterPreview'
import FormMappingTable from './FormMappingTable'
import ScreenshotComparison from './ScreenshotComparison'
import ApprovalControls from './ApprovalControls'
import { approveAndSubmit, runDocumentsForJob } from '../../services/agentOrchestrator'
import * as gatekeeper from '../../agents/reviewGatekeeper'

type Tab = 'diff' | 'letter' | 'form' | 'screenshots'

interface Artifacts {
  tailored: TailoredResume | null
  letter: CoverLetter | null
  mapping: FormMapping | null
  screenshots: ScreenshotResult | null
}

interface Props {
  record: ReviewQueueRecord
  onStatusChange: () => void
}

export default function JobDetailPanel({ record, onStatusChange }: Props) {
  const [tab, setTab] = useState<Tab>('diff')
  const [artifacts, setArtifacts] = useState<Artifacts>({ tailored: null, letter: null, mapping: null, screenshots: null })
  const [loadingArtifacts, setLoadingArtifacts] = useState(true)
  const [generatingDocs, setGeneratingDocs] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null)

  useEffect(() => {
    loadArtifacts()
    setDocError(null)
  }, [record.job_id])

  async function loadArtifacts() {
    setLoadingArtifacts(true)
    const { data } = await supabase
      .from('application_artifacts')
      .select('artifact_type, content, storage_url, created_at')
      .eq('job_id', record.job_id)
      .order('created_at', { ascending: false })

    if (!data) { setLoadingArtifacts(false); return }

    const fresh: Artifacts = { tailored: null, letter: null, mapping: null, screenshots: null }

    for (const row of data) {
      if (row.artifact_type === 'resume_tailored' && !fresh.tailored) {
        fresh.tailored = row.content as TailoredResume
      }
      if (row.artifact_type === 'cover_letter' && !fresh.letter) {
        fresh.letter = row.content as CoverLetter
      }
      if (row.artifact_type === 'form_mapping' && !fresh.mapping) {
        fresh.mapping = row.content as FormMapping
      }
      if (row.artifact_type === 'screenshot_before' && !fresh.screenshots) {
        const filledRow = data.find((r) => r.artifact_type === 'screenshot_filled')
        fresh.screenshots = {
          job_id: record.job_id,
          before_url: row.storage_url ?? '',
          filled_url: filledRow?.storage_url ?? '',
          captured_at: row.created_at,
        }
      }
    }

    setArtifacts(fresh)
    setLoadingArtifacts(false)

    // Auto-generate if no documents exist yet
    const hasAny = fresh.tailored || fresh.letter || fresh.mapping || fresh.screenshots
    if (!hasAny) {
      setGeneratingDocs(true)
      setDocError(null)
      runDocumentsForJob(record.job_id)
        .then(() => loadArtifacts())
        .catch(err => {
          setDocError(err instanceof Error ? err.message : 'Failed to generate documents')
        })
        .finally(() => setGeneratingDocs(false))
    }
  }

  async function handleApprove(jobId: string, notes?: string) {
    const result = await approveAndSubmit(jobId, notes)
    setSubmissionResult(result)
    onStatusChange()
  }

  async function handleReject(jobId: string, notes?: string) {
    await gatekeeper.reject(jobId, notes)
    onStatusChange()
  }

  async function handleRunDocuments(jobId: string) {
    setDocError(null)
    setGeneratingDocs(true)
    try {
      await runDocumentsForJob(jobId)
      await loadArtifacts()
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Failed to generate documents')
    } finally {
      setGeneratingDocs(false)
    }
  }

  const job = record.job
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'diff', label: 'Resume Diff' },
    { key: 'letter', label: 'Cover Letter' },
    { key: 'form', label: 'Form' },
    { key: 'screenshots', label: 'Screenshots' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f' }}>
      {/* Job header */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e1e2e' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', color: '#e2e8f0', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
          {job?.company ?? '—'}
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{job?.title ?? '—'}</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {job?.location && (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#475569' }}>{job.location}</span>
          )}
          {job?.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#06b6d4', textDecoration: 'none' }}>
              VIEW POSTING ↗
            </a>
          )}
          {record.cv_track && (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#8b5cf6' }}>
              {record.cv_track.toUpperCase()} TRACK
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e', padding: '0 1.5rem' }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === key ? '2px solid #8b5cf6' : '2px solid transparent',
              color: tab === key ? '#e2e8f0' : '#475569',
              cursor: 'pointer',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.7rem',
              marginBottom: '-1px',
              transition: 'color 0.1s',
            }}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {docError && (
        <div style={{ padding: '0.5rem 1.5rem', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}>
          ⚠ {docError}
        </div>
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingArtifacts || generatingDocs ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>
            {generatingDocs ? '⚙ GENERATING DOCUMENTS...' : 'LOADING ARTIFACTS...'}
          </div>
        ) : (
          <>
            {tab === 'diff' && <ResumeDiffViewer tailored={artifacts.tailored} jobId={record.job_id} onSaved={loadArtifacts} />}
            {tab === 'letter' && <CoverLetterPreview letter={artifacts.letter} jobId={record.job_id} onSaved={loadArtifacts} />}
            {tab === 'form' && <FormMappingTable mapping={artifacts.mapping} />}
            {tab === 'screenshots' && <ScreenshotComparison screenshots={artifacts.screenshots} />}
          </>
        )}
      </div>

      {/* Approval controls */}
      <ApprovalControls
        jobId={record.job_id}
        status={record.status}
        generatingDocs={generatingDocs}
        submissionResult={submissionResult}
        onApprove={handleApprove}
        onReject={handleReject}
        onRunDocuments={handleRunDocuments}
      />
    </div>
  )
}
