import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectCV } from '../cvSelector'

const mockUXVersion = {
  id: 'cv-ux-id',
  track: 'ux',
  label: 'UX Engineer',
  accent_color: '#06b6d4',
  content: {
    summary: 'Experienced UX Engineer with 10+ years.',
    experience: [
      { company: 'Apple', role: 'UX Lead', bullets: ['Led design system', 'Shipped iOS features'] },
    ],
    skills: ['Figma', 'React', 'TypeScript'],
  },
  updated_at: new Date().toISOString(),
}

vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  },
}))

let mockSingle: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../../supabaseClient')
  mockSingle = (mod.supabase.from('cv_versions').select('*').eq('track', 'ux') as unknown as { single: ReturnType<typeof vi.fn> }).single
})

describe('cvSelector', () => {
  it('returns the cv_version for the ux track', async () => {
    const { supabase } = await import('../../supabaseClient')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockUXVersion, error: null }),
    } as unknown as ReturnType<typeof supabase.from>)

    const result = await selectCV('ux', 'test-user-id')
    expect(result.track).toBe('ux')
    expect(result.label).toBe('UX Engineer')
    expect(result.accent_color).toBe('#06b6d4')
    expect(result.content).toBeDefined()
  })

  it('throws if track not found', async () => {
    const { supabase } = await import('../../supabaseClient')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    } as unknown as ReturnType<typeof supabase.from>)

    await expect(selectCV('pm', 'test-user-id')).rejects.toThrow('CV version not found for track')
  })

  it('returns content object with summary, experience, skills', async () => {
    const { supabase } = await import('../../supabaseClient')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockUXVersion, error: null }),
    } as unknown as ReturnType<typeof supabase.from>)

    const result = await selectCV('ux', 'test-user-id')
    expect(result.content).toHaveProperty('summary')
    expect(result.content).toHaveProperty('experience')
    expect(result.content).toHaveProperty('skills')
    expect(Array.isArray(result.content.experience)).toBe(true)
    expect(Array.isArray(result.content.skills)).toBe(true)
  })
})
