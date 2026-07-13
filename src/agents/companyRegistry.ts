// User-grown registry of ATS company boards, persisted in localStorage (same
// pattern as the API keys / search profile). Scout unions these with its
// built-in curated lists, so companies the user finds are scanned on the next
// run. Entries are only ever added after a live probe verifies the board — see
// findCompanyBoard in scout.ts. No guessed slugs are ever stored.

export interface CustomCompany {
  provider: 'ashby' | 'greenhouse' | 'smartrecruiters' | 'lever' | 'recruitee'
  slug: string
  name: string
  apiBase?: string
}

const STORAGE_KEY = 'custom_ats_companies'

export function getCustomCompanies(): CustomCompany[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is CustomCompany =>
        c && typeof c.slug === 'string' && typeof c.name === 'string' && typeof c.provider === 'string',
    )
  } catch {
    return []
  }
}

/** Add a verified company (idempotent on provider+slug). */
export function addCustomCompany(entry: CustomCompany): void {
  try {
    const existing = getCustomCompanies()
    if (existing.some(c => c.provider === entry.provider && c.slug === entry.slug)) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, entry]))
  } catch {
    /* storage unavailable — no-op */
  }
}

export function removeCustomCompany(provider: string, slug: string): void {
  try {
    const kept = getCustomCompanies().filter(c => !(c.provider === provider && c.slug === slug))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
  } catch {
    /* ignore */
  }
}
