import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

import { writeCoverLetter } from '../coverLetterWriter'

const BANNED_PHRASES = ['i am passionate about', 'leverage', 'synergy', 'dynamic']

beforeEach(() => vi.clearAllMocks())

function makeResponse(text: string) {
  return { content: [{ type: 'text', text }] }
}

const mockLetter = {
  subject_line: 'UX Engineer — Athar Hafiz',
  body: 'At Global AI Berlin, I help practitioners build real products with the Anthropic API. When I saw your UX Engineer role I recognised immediate overlap: you need React and Supabase, I have shipped both in production. My three years building AI-assisted tools at Freelance mapped directly to your stack. I would like to meet next week to walk through a recent project. Would Tuesday afternoon work?',
  word_count: 72,
}

describe('coverLetterWriter', () => {
  it('returns subject_line, body, word_count fields', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse(JSON.stringify(mockLetter)))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'We need a UX Engineer...')
    expect(result).toHaveProperty('subject_line')
    expect(result).toHaveProperty('body')
    expect(result).toHaveProperty('word_count')
    expect(typeof result.subject_line).toBe('string')
    expect(typeof result.body).toBe('string')
    expect(typeof result.word_count).toBe('number')
  })

  it('word count stays at or under 300', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse(JSON.stringify(mockLetter)))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'We need a UX Engineer...')
    expect(result.word_count).toBeLessThanOrEqual(300)
  })

  it('enforces actual word count regardless of model-reported value', async () => {
    const fakeCountLetter = { ...mockLetter, word_count: 999 }
    mockCreate.mockResolvedValueOnce(makeResponse(JSON.stringify(fakeCountLetter)))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'We need a UX Engineer...')
    expect(result.word_count).not.toBe(999)
    const actualCount = mockLetter.body.trim().split(/\s+/).filter(Boolean).length
    expect(result.word_count).toBe(actualCount)
  })

  it('does not inject banned phrases itself', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse(JSON.stringify(mockLetter)))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'JD...')
    // Verify the function itself does not inject banned phrases into the output
    BANNED_PHRASES.forEach((phrase) => {
      expect(result.subject_line.toLowerCase()).not.toContain(phrase)
    })
  })

  it('system prompt explicitly prohibits banned phrases', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse(JSON.stringify(mockLetter)))
    await writeCoverLetter('UX Engineer', 'Acme GmbH', 'JD...')
    const callArgs = mockCreate.mock.calls[0][0]
    const systemPrompt: string = callArgs.system ?? ''
    const systemLower = systemPrompt.toLowerCase()
    BANNED_PHRASES.forEach((phrase) => {
      expect(systemLower).toContain(phrase.toLowerCase())
    })
  })

  it('strips ```json markdown fences before parsing', async () => {
    const fenced = '```json\n' + JSON.stringify(mockLetter) + '\n```'
    mockCreate.mockResolvedValueOnce(makeResponse(fenced))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'JD...')
    expect(result.subject_line).toBe(mockLetter.subject_line)
  })
})
