import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScoutResult, ClassifierResult } from '../types'

vi.mock('../scout', () => ({ runScout: vi.fn() }))
vi.mock('../classifier', () => ({ classifyBatch: vi.fn() }))
vi.mock('../cvSelector', () => ({ selectCV: vi.fn() }))
vi.mock('../resumeTailor', () => ({ tailorResume: vi.fn() }))
vi.mock('../coverLetterWriter', () => ({ writeCoverLetter: vi.fn() }))
vi.mock('../formMapper', () => ({ mapForm: vi.fn() }))
vi.mock('../screenshotCapturer', () => ({ captureScreenshots: vi.fn() }))
vi.mock('../reviewGatekeeper', () => ({
  enqueue: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  submit: vi.fn(),
  getQueue: vi.fn(),
  getAll: vi.fn(),
}))
vi.mock('../statusTracker', () => ({ syncStatus: vi.fn(), watchJob: vi.fn(), isStatusTrackerReady: vi.fn(() => false) }))
vi.mock('../submitter', () => ({
  submitApplication: vi.fn(async () => ({ success: true, method: 'api', message: 'ok', applicationUrl: 'x', requiresManual: false })),
}))
vi.mock('../../supabaseClient', () => ({
  supabase: {
    // Every orchestrator entrypoint calls getCurrentUserId() → auth.getUser().
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'test-user' } } })) },
    from: vi.fn(),
  },
}))

import { runScoutOnly, runDocumentsForJob, approveAndSubmit, runStatusSync } from '../../services/agentOrchestrator'
import { runScout } from '../scout'
import { classifyBatch } from '../classifier'
import { selectCV } from '../cvSelector'
import { tailorResume } from '../resumeTailor'
import { writeCoverLetter } from '../coverLetterWriter'
import { enqueue, approve, submit } from '../reviewGatekeeper'
import { syncStatus, watchJob } from '../statusTracker'
import { supabase } from '../../supabaseClient'

const mockFrom = vi.mocked(supabase.from)
const mockRunScout = vi.mocked(runScout)
const mockClassifyBatch = vi.mocked(classifyBatch)
const mockSelectCV = vi.mocked(selectCV)
const mockTailorResume = vi.mocked(tailorResume)
const mockWriteCoverLetter = vi.mocked(writeCoverLetter)
const mockEnqueue = vi.mocked(enqueue)
const mockApprove = vi.mocked(approve)
const mockSubmit = vi.mocked(submit)
const mockSyncStatus = vi.mocked(syncStatus)
const mockWatchJob = vi.mocked(watchJob)

const mockScoutResults: ScoutResult[] = [{
  title: 'Senior UX Engineer', company: 'Acme GmbH', location: 'Berlin',
  url: 'https://acme.de/jobs/1', source: 'linkedin',
  raw_jd: 'Looking for UX Engineer with React...', scraped_at: new Date().toISOString(),
  verified: true, verificationSource: 'manual',
}]

const mockClassification: ClassifierResult = {
  job_id: 'job-1', score: 8.0, cv_track: 'ux', industry: 'Other',
  score_rationale: 'Strong UX match.', key_matches: ['React', 'UX design'], red_flags: [],
  passedThreshold: true, verdict: 'apply_first', hard_cap_reason: null, bonus_count: 2,
}

const mockCVVersion = {
  id: 'cv-1', track: 'ux' as const, label: 'UX Engineer', accent_color: '#06b6d4',
  content: { summary: 'Experienced UX Engineer.', experience: [{ company: 'Apple', role: 'UX Lead', bullets: ['Built design system'] }], skills: ['React'] },
  updated_at: new Date().toISOString(),
}

const mockTailored = {
  summary: 'Tailored summary.', experience: [{ company: 'Apple', role: 'UX Lead', bullets: ['Tailored bullet'] }],
  skills: ['React'], diff: [{ field: 'summary', original: 'Original', tailored: 'Tailored' }],
}

const mockLetter = { subject_line: 'UX Engineer — Athar Hafiz', body: 'Cover letter body.', word_count: 3 }

function makeAgentRunRecord() { return { data: { id: 'run-1' }, error: null } }
function makeJobRecord() {
  return { data: { id: 'job-1', raw_jd: 'Looking for UX Engineer...', title: 'Senior UX Engineer', company: 'Acme GmbH', url: 'https://acme.de/jobs/1' }, error: null }
}

// Fully chainable query double — every builder method returns the builder;
// terminal reads resolve to canned data; awaited writes resolve too. Covers
// the full chain the orchestrator uses (gte/maybeSingle/in/order).
function chain(opts: { single?: unknown; maybeSingle?: unknown; resolve?: unknown }) {
  const b: Record<string, unknown> = {}
  for (const m of ['insert', 'update', 'upsert', 'select', 'eq', 'gte', 'in', 'order', 'not']) {
    b[m] = () => b
  }
  b.single = () => Promise.resolve(opts.single ?? { data: null, error: null })
  b.maybeSingle = () => Promise.resolve(opts.maybeSingle ?? { data: null, error: null })
  b.then = (res: (v: unknown) => void) => res(opts.resolve ?? { data: null, error: null })
  return b as unknown as ReturnType<typeof supabase.from>
}

// loadLatestArtifacts() reads these back so approveAndSubmit has docs to submit.
const artifactRows = {
  data: [
    { artifact_type: 'resume_tailored', content: mockTailored, created_at: new Date().toISOString() },
    { artifact_type: 'cover_letter', content: mockLetter, created_at: new Date().toISOString() },
  ],
  error: null,
}

function setupSupabaseMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'agent_runs') return chain({ single: makeAgentRunRecord() })
    // jobs: single() serves upsert + getJobRawJd; maybeSingle() is the dedup
    // check — null means "not seen recently", so the job proceeds.
    if (table === 'jobs') return chain({ single: makeJobRecord(), maybeSingle: { data: null, error: null } })
    if (table === 'application_artifacts') return chain({ resolve: artifactRows })
    return chain({})
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupSupabaseMocks()
})

describe('agentOrchestrator', () => {
  describe('runScoutOnly()', () => {
    it('calls scout then classifier then enqueue in order', async () => {
      mockRunScout.mockResolvedValueOnce({ results: mockScoutResults, suggestedCompanies: [] })
      mockClassifyBatch.mockResolvedValueOnce([mockClassification])
      mockEnqueue.mockResolvedValueOnce({ id: 'queue-1', job_id: 'job-1', status: 'pending_review' } as never)

      await runScoutOnly()

      expect(mockRunScout).toHaveBeenCalledTimes(1)
      expect(mockClassifyBatch).toHaveBeenCalledTimes(1)
      expect(mockEnqueue).toHaveBeenCalledWith('job-1', 8.0, 'ux')
    })
  })

  describe('runDocumentsForJob()', () => {
    it('calls cvSelector, resumeTailor, coverLetterWriter in order', async () => {
      // queue record lookup returns cv_track
      mockFrom.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { cv_track: 'ux', classifier_score: 8.0 }, error: null }),
      } as unknown as ReturnType<typeof supabase.from>))

      setupSupabaseMocks()

      mockSelectCV.mockResolvedValueOnce(mockCVVersion as never)
      mockTailorResume.mockResolvedValueOnce(mockTailored as never)
      mockWriteCoverLetter.mockResolvedValueOnce(mockLetter as never)

      await runDocumentsForJob('job-1')

      expect(mockSelectCV).toHaveBeenCalledWith('ux', 'test-user')
      expect(mockTailorResume).toHaveBeenCalledTimes(1)
      expect(mockWriteCoverLetter).toHaveBeenCalledTimes(1)
    })
  })

  describe('approveAndSubmit()', () => {
    it('calls approve then submit in order', async () => {
      mockApprove.mockResolvedValueOnce({ status: 'approved' } as never)
      mockSubmit.mockResolvedValueOnce({ status: 'submitted' } as never)
      mockWatchJob.mockResolvedValueOnce('no_reply')

      await approveAndSubmit('job-1', 'LGTM')

      expect(mockApprove).toHaveBeenCalledWith('job-1', 'LGTM')
      expect(mockSubmit).toHaveBeenCalledWith('job-1')
    })

    it('does not call submit if approve throws', async () => {
      mockApprove.mockRejectedValueOnce(new Error('Not found'))

      await expect(approveAndSubmit('job-1')).rejects.toThrow('Not found')
      expect(mockSubmit).not.toHaveBeenCalled()
    })
  })

  describe('runStatusSync()', () => {
    it('calls syncStatus and writes agent_run record', async () => {
      mockSyncStatus.mockResolvedValueOnce([])

      await runStatusSync()

      expect(mockSyncStatus).toHaveBeenCalledTimes(1)
      expect(mockFrom).toHaveBeenCalledWith('agent_runs')
    })
  })

  describe('failure handling', () => {
    it('writes failed agent_run record when scout throws', async () => {
      mockRunScout.mockRejectedValueOnce(new Error('Network error'))

      await expect(runScoutOnly()).rejects.toThrow('Network error')
      expect(mockFrom).toHaveBeenCalledWith('agent_runs')
    })
  })
})
