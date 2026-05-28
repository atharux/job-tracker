import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enqueue, approve, reject, submit, getQueue } from '../reviewGatekeeper'

// Chainable Supabase mock
function makeChain(resolveWith: object) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveWith),
  }
  return chain
}

vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

let mockFrom: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../../supabaseClient')
  mockFrom = vi.mocked(mod.supabase.from)
})

const pendingRecord = {
  id: 'queue-1',
  job_id: 'job-1',
  status: 'pending_review',
  classifier_score: 7.5,
  cv_track: 'ux',
  review_notes: null,
  reviewed_at: null,
  submitted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const approvedRecord = { ...pendingRecord, status: 'approved', reviewed_at: new Date().toISOString() }
const rejectedRecord = { ...pendingRecord, status: 'rejected', reviewed_at: new Date().toISOString() }
const submittedRecord = { ...approvedRecord, status: 'submitted', submitted_at: new Date().toISOString() }

describe('reviewGatekeeper', () => {
  describe('enqueue()', () => {
    it('sets status to pending_review', async () => {
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: pendingRecord, error: null }),
      })

      const result = await enqueue('job-1', 7.5, 'ux')
      expect(result.status).toBe('pending_review')
    })
  })

  describe('approve()', () => {
    it('transitions status to approved', async () => {
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: approvedRecord, error: null }),
      })

      const result = await approve('job-1', 'Looks good')
      expect(result.status).toBe('approved')
    })
  })

  describe('reject()', () => {
    it('transitions status to rejected', async () => {
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: rejectedRecord, error: null }),
      })

      const result = await reject('job-1', 'Not a good fit')
      expect(result.status).toBe('rejected')
    })
  })

  describe('submit()', () => {
    it('cannot be called when status !== approved', async () => {
      // First call (status check) returns pending_review
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { status: 'pending_review' }, error: null }),
      })

      await expect(submit('job-1')).rejects.toThrow("Cannot submit job job-1: status is 'pending_review', must be 'approved'")
    })

    it('cannot be called when status is rejected', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { status: 'rejected' }, error: null }),
      })

      await expect(submit('job-1')).rejects.toThrow("Cannot submit job job-1: status is 'rejected', must be 'approved'")
    })

    it('transitions to submitted when status is approved', async () => {
      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // status check fetch
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { status: 'approved' }, error: null }),
          }
        }
        if (callCount === 2) {
          // update to submitted
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: submittedRecord, error: null }),
          }
        }
        // jobs table update
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      })

      const result = await submit('job-1')
      expect(result.status).toBe('submitted')
    })
  })

  describe('getQueue()', () => {
    it('only returns pending_review records', async () => {
      const pendingRecords = [pendingRecord, { ...pendingRecord, id: 'queue-2', job_id: 'job-2' }]

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: pendingRecords, error: null }),
      })

      const results = await getQueue()
      expect(results.length).toBe(2)
      results.forEach((r) => expect(r.status).toBe('pending_review'))
    })

    it('returns empty array when queue is empty', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      const results = await getQueue()
      expect(results).toHaveLength(0)
    })
  })
})
