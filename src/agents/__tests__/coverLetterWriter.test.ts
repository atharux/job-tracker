import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()

import { writeCoverLetter } from '../coverLetterWriter'

const BANNED_PHRASES = ['i am passionate about', 'leverage', 'synergy', 'dynamic']

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('groq_api_key', 'test-groq-key')
  vi.stubGlobal('fetch', mockFetch)
})

function makeResponse(content: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  }
}

const mockLetter = {
  subject_line: 'UX Engineer — Athar Hafiz',
  body: 'At Global AI Berlin, I help practitioners build real products with the Anthropic API. When I saw your UX Engineer role I recognised immediate overlap: you need React and Supabase, I have shipped both in production. My three years building AI-assisted tools at Freelance mapped directly to your stack. I would like to meet next week to walk through a recent project. Would Tuesday afternoon work?',
  word_count: 72,
}

describe('coverLetterWriter', () => {
  it('returns subject_line, body, word_count fields', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(JSON.stringify(mockLetter)))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'We need a UX Engineer...')
    expect(result).toHaveProperty('subject_line')
    expect(result).toHaveProperty('body')
    expect(result).toHaveProperty('word_count')
    expect(typeof result.subject_line).toBe('string')
    expect(typeof result.body).toBe('string')
    expect(typeof result.word_count).toBe('number')
  })

  it('word count stays at or under 300', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(JSON.stringify(mockLetter)))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'We need a UX Engineer...')
    expect(result.word_count).toBeLessThanOrEqual(300)
  })

  it('enforces actual word count regardless of model-reported value', async () => {
    const fakeCountLetter = { ...mockLetter, word_count: 999 }
    mockFetch.mockResolvedValueOnce(makeResponse(JSON.stringify(fakeCountLetter)))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'We need a UX Engineer...')
    expect(result.word_count).not.toBe(999)
    const actualCount = mockLetter.body.trim().split(/\s+/).filter(Boolean).length
    expect(result.word_count).toBe(actualCount)
  })

  it('does not inject banned phrases itself', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(JSON.stringify(mockLetter)))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'JD...')
    // Verify the function itself does not inject banned phrases into the output
    BANNED_PHRASES.forEach((phrase) => {
      expect(result.subject_line.toLowerCase()).not.toContain(phrase)
    })
  })

  it('system prompt explicitly prohibits banned phrases', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(JSON.stringify(mockLetter)))
    await writeCoverLetter('UX Engineer', 'Acme GmbH', 'JD...')
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body as string) as { messages: Array<{ role: string; content: string }> }
    // The banned-phrase rules live in the user prompt (buildPrompt/BASE_RULES),
    // not a separate Anthropic-style "system" param — callAI sends one flat
    // messages array to the Groq/OpenRouter chat-completions endpoint.
    const fullPrompt = body.messages.map(m => m.content).join('\n').toLowerCase()
    BANNED_PHRASES.forEach((phrase) => {
      expect(fullPrompt).toContain(phrase.toLowerCase())
    })
  })

  it('strips ```json markdown fences before parsing', async () => {
    const fenced = '```json\n' + JSON.stringify(mockLetter) + '\n```'
    mockFetch.mockResolvedValueOnce(makeResponse(fenced))
    const result = await writeCoverLetter('UX Engineer', 'Acme GmbH', 'JD...')
    expect(result.subject_line).toBe(mockLetter.subject_line)
  })
})
