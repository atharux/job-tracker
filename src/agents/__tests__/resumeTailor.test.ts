import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CVContent, TailoredResume } from '../types'

const mockFetch = vi.fn()

import { tailorResume } from '../resumeTailor'

const baseResume: CVContent = {
  summary: 'Experienced UX Engineer with 10+ years.',
  experience: [
    { company: 'Apple', role: 'UX Lead', bullets: ['Led design system for iOS', 'Collaborated with PM team'] },
    { company: 'Freelance', role: 'Product Designer', bullets: ['Designed B2B SaaS dashboards', 'Ran user research sessions'] },
  ],
  skills: ['Figma', 'React', 'TypeScript', 'Supabase'],
}

const rawJd = 'We need a UX Engineer with React and Supabase experience to build design systems.'

const mockTailored: TailoredResume = {
  summary: 'UX Engineer specialising in React-based design systems with 10+ years experience.',
  experience: [
    { company: 'Apple', role: 'UX Lead', bullets: ['Built and maintained design system used by 50+ engineers', 'Collaborated with PM team on roadmap'] },
    { company: 'Freelance', role: 'Product Designer', bullets: ['Designed B2B SaaS dashboards with React components', 'Ran user research to validate design decisions'] },
  ],
  skills: ['Figma', 'React', 'TypeScript', 'Supabase', 'Design Systems'],
  diff: [
    { field: 'summary', original: 'Experienced UX Engineer with 10+ years.', tailored: 'UX Engineer specialising in React-based design systems with 10+ years experience.' },
    { field: 'experience[0].bullets[0]', original: 'Led design system for iOS', tailored: 'Built and maintained design system used by 50+ engineers' },
  ],
}

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

describe('resumeTailor', () => {
  it('returns a valid TailoredResume shape', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(JSON.stringify(mockTailored)))
    const result = await tailorResume(baseResume, rawJd)
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('experience')
    expect(result).toHaveProperty('skills')
    expect(result).toHaveProperty('diff')
    expect(Array.isArray(result.experience)).toBe(true)
    expect(Array.isArray(result.skills)).toBe(true)
    expect(Array.isArray(result.diff)).toBe(true)
  })

  it('does not alter company names or role titles', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(JSON.stringify(mockTailored)))
    const result = await tailorResume(baseResume, rawJd)
    result.experience.forEach((exp, i) => {
      expect(exp.company).toBe(baseResume.experience[i].company)
      expect(exp.role).toBe(baseResume.experience[i].role)
    })
  })

  it('produces a non-empty diff array when changes are made', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(JSON.stringify(mockTailored)))
    const result = await tailorResume(baseResume, rawJd)
    expect(result.diff.length).toBeGreaterThan(0)
    result.diff.forEach((d) => {
      expect(d).toHaveProperty('field')
      expect(d).toHaveProperty('original')
      expect(d).toHaveProperty('tailored')
    })
  })

  it('strips ```json markdown fences before parsing', async () => {
    const fenced = '```json\n' + JSON.stringify(mockTailored) + '\n```'
    mockFetch.mockResolvedValueOnce(makeResponse(fenced))
    const result = await tailorResume(baseResume, rawJd)
    expect(result.summary).toBe(mockTailored.summary)
  })

  it('strips plain ``` fences before parsing', async () => {
    const fenced = '```\n' + JSON.stringify(mockTailored) + '\n```'
    mockFetch.mockResolvedValueOnce(makeResponse(fenced))
    const result = await tailorResume(baseResume, rawJd)
    expect(result.diff).toBeDefined()
  })
})
