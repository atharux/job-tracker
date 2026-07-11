import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()

vi.mock('../../services/gmailAuth', () => ({
  getGmailToken: vi.fn(async () => 'test-gmail-token'),
  isGmailConnected: vi.fn(() => true),
}))

vi.mock('../../supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { syncStatus, watchJob } from '../statusTracker'
import { supabase } from '../../supabaseClient'

const mockFrom = vi.mocked(supabase.from)

const submittedJob = {
  id: 'job-1',
  title: 'Senior UX Engineer',
  company: 'Acme GmbH',
  location: 'Berlin',
  url: 'https://acme.de/jobs/1',
  source: 'linkedin',
  raw_jd: 'Looking for UX Engineer...',
  status: 'submitted',
  scraped_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('groq_api_key', 'test-groq-key')
  vi.stubGlobal('fetch', mockFetch)
})

// statusTracker searches Gmail directly via REST (list, then get message), then
// (only if an email was found) classifies it via callAI's Groq REST endpoint —
// three possible fetch targets, routed here by URL.
function mockGmail({ found }: { found: boolean }) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('gmail.googleapis.com/gmail/v1/users/me/messages?q=')) {
      return {
        ok: true,
        json: async () => (found ? { messages: [{ id: 'msg-1' }] } : {}),
      }
    }
    if (url.includes('gmail.googleapis.com/gmail/v1/users/me/messages/msg-1')) {
      return {
        ok: true,
        json: async () => ({
          snippet: 'We would like to move forward with your application.',
          payload: { headers: [{ name: 'Subject', value: 'Re: your application' }, { name: 'From', value: 'hr@acme.de' }] },
        }),
      }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
}

function mockGmailThenClassify(classification: string) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('gmail.googleapis.com/gmail/v1/users/me/messages?q=')) {
      return { ok: true, json: async () => ({ messages: [{ id: 'msg-1' }] }) }
    }
    if (url.includes('gmail.googleapis.com/gmail/v1/users/me/messages/msg-1')) {
      return {
        ok: true,
        json: async () => ({
          snippet: 'Email body',
          payload: { headers: [{ name: 'Subject', value: 'Re: your application' }, { name: 'From', value: 'hr@acme.de' }] },
        }),
      }
    }
    if (url.includes('api.groq.com')) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: classification } }] }) }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
}

describe('statusTracker', () => {
  describe('syncStatus()', () => {
    it('returns empty array when no submitted jobs', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof supabase.from>)

      const results = await syncStatus()
      expect(results).toHaveLength(0)
    })

    it('returns no updates when no email found for job', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [submittedJob], error: null }),
      } as unknown as ReturnType<typeof supabase.from>)

      mockGmail({ found: false })

      const results = await syncStatus()
      // no_reply statuses are not persisted
      expect(results).toHaveLength(0)
    })

    it('classifies and returns screening status when email found', async () => {
      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [submittedJob], error: null }),
          } as unknown as ReturnType<typeof supabase.from>
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as unknown as ReturnType<typeof supabase.from>
      })

      mockGmailThenClassify('screening')

      const results = await syncStatus()
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('screening')
    })
  })

  describe('watchJob()', () => {
    it('returns no_reply when no email found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: submittedJob, error: null }),
      } as unknown as ReturnType<typeof supabase.from>)

      mockGmail({ found: false })

      const status = await watchJob('job-1')
      expect(status).toBe('no_reply')
    })

    it('returns interview when interview email found', async () => {
      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: submittedJob, error: null }),
          } as unknown as ReturnType<typeof supabase.from>
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as unknown as ReturnType<typeof supabase.from>
      })

      mockGmailThenClassify('interview')

      const status = await watchJob('job-1')
      expect(status).toBe('interview')
    })

    it('throws when job not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      } as unknown as ReturnType<typeof supabase.from>)

      await expect(watchJob('nonexistent')).rejects.toThrow('Job not found: nonexistent')
    })
  })
})
