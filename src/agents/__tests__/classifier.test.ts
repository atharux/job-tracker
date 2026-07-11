import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScoutResult } from '../types'

const mockFetch = vi.fn()

import { classifyJob, classifyBatch, SCORE_THRESHOLD } from '../classifier'

const mockJob: ScoutResult = {
  title: 'Senior UX Engineer',
  company: 'Acme GmbH',
  location: 'Berlin, Germany',
  url: 'https://acme.de/jobs/ux-engineer',
  source: 'linkedin',
  raw_jd: 'We are looking for a Senior UX Engineer with React experience...',
  scraped_at: new Date().toISOString(),
  verified: true,
  verificationSource: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('groq_api_key', 'test-groq-key')
  vi.stubGlobal('fetch', mockFetch)
})

function makeGroqResponse(content: string | null) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  }
}

describe('classifier', () => {
  it('returns a score between 1 and 10', async () => {
    mockFetch.mockResolvedValueOnce(makeGroqResponse(JSON.stringify({
      job_id: 'test-id', score: 7.5, cv_track: 'ux',
      score_rationale: 'Great match.', key_matches: ['React'], red_flags: [],
    })))
    const result = await classifyJob(mockJob, 'test-id')
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThanOrEqual(1)
    expect(result!.score).toBeLessThanOrEqual(10)
  })

  it('flags passedThreshold correctly without discarding either job', async () => {
    mockFetch
      .mockResolvedValueOnce(makeGroqResponse(JSON.stringify({ job_id: 'low-id', score: 2.0, cv_track: 'ux', score_rationale: 'Poor fit.', key_matches: [], red_flags: ['Wrong domain'] })))
      .mockResolvedValueOnce(makeGroqResponse(JSON.stringify({ job_id: 'high-id', score: 8.0, cv_track: 'ux', score_rationale: 'Strong fit.', key_matches: ['React'], red_flags: [] })))

    const jobs = [{ ...mockJob, id: 'low-id' }, { ...mockJob, id: 'high-id' }]
    const results = await classifyBatch(jobs)

    // classifyBatch keeps every classified job (a skipped/low-score verdict still
    // needs to surface in the review queue) — passedThreshold is metadata, not a filter.
    expect(results).toHaveLength(2)
    const low = results.find(r => r.job_id === 'low-id')
    const high = results.find(r => r.job_id === 'high-id')
    expect(low!.passedThreshold).toBe(false)
    expect(high!.passedThreshold).toBe(true)
    expect(high!.score).toBeGreaterThanOrEqual(SCORE_THRESHOLD)
  })

  it('assigns ux cv_track for a UX Engineer role', async () => {
    mockFetch.mockResolvedValueOnce(makeGroqResponse(JSON.stringify({ job_id: 'ux-id', score: 8.0, cv_track: 'ux', score_rationale: 'UX role.', key_matches: ['UX'], red_flags: [] })))
    const result = await classifyJob(mockJob, 'ux-id')
    expect(result!.cv_track).toBe('ux')
  })

  it('assigns pm cv_track for a Product Manager role', async () => {
    mockFetch.mockResolvedValueOnce(makeGroqResponse(JSON.stringify({ job_id: 'pm-id', score: 7.0, cv_track: 'pm', score_rationale: 'PM role.', key_matches: ['Product roadmap'], red_flags: [] })))
    const result = await classifyJob({ ...mockJob, title: 'Product Manager' }, 'pm-id')
    expect(result!.cv_track).toBe('pm')
  })

  it('assigns devrel cv_track for a Developer Relations role', async () => {
    mockFetch.mockResolvedValueOnce(makeGroqResponse(JSON.stringify({ job_id: 'devrel-id', score: 9.0, cv_track: 'devrel', score_rationale: 'DevRel role.', key_matches: ['community'], red_flags: [] })))
    const result = await classifyJob({ ...mockJob, title: 'Developer Relations Engineer' }, 'devrel-id')
    expect(result!.cv_track).toBe('devrel')
  })

  it('handles malformed API response without throwing', async () => {
    mockFetch.mockResolvedValueOnce(makeGroqResponse('NOT JSON AT ALL !!!'))
    const result = await classifyJob(mockJob, 'bad-id')
    expect(result).toBeNull()
  })

  it('handles null content in API response without throwing', async () => {
    mockFetch.mockResolvedValueOnce(makeGroqResponse(null))
    const result = await classifyJob(mockJob, 'null-id')
    expect(result).toBeNull()
  })
})
