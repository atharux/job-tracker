import type { ScoutResult } from './types'

const ROLE_KEYWORDS = [
  'ux engineer', 'ux designer', 'product designer', 'ui/ux',
  'product manager', 'developer relations', 'devrel', 'developer advocate',
  'interaction designer', 'experience designer', 'ui designer',
]

function matchesRole(text: string): boolean {
  const lower = text.toLowerCase()
  return ROLE_KEYWORDS.some(kw => lower.includes(kw))
}

function now(): string {
  return new Date().toISOString()
}

// ── Arbeitnow REST API ─────────────────────────────────────────────────────────
// https://www.arbeitnow.com/api/job-board-api — free, no key, CORS-enabled

interface ArbeitnowJob {
  title: string
  company_name: string
  location: string
  url: string
  description: string
  tags: string[]
  remote: boolean
}

async function fetchArbeitnow(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  for (let page = 1; page <= 4; page++) {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`)
    if (!res.ok) break
    const data = await res.json() as { data: ArbeitnowJob[] }
    const matching = data.data.filter(
      j => matchesRole(j.title) || matchesRole((j.tags ?? []).join(' '))
    )
    if (matching.length === 0) break
    results.push(
      ...matching.map(j => ({
        title: j.title,
        company: j.company_name,
        location: j.remote ? 'Remote' : (j.location || 'Germany'),
        url: j.url,
        source: 'arbeitnow' as const,
        raw_jd: j.description,
        scraped_at: now(),
      }))
    )
  }

  return results
}

// ── Remotive REST API ──────────────────────────────────────────────────────────
// https://remotive.com/api/remote-jobs — free, no key, CORS-enabled

interface RemotiveJob {
  url: string
  title: string
  company_name: string
  candidate_required_location: string
  description: string
  publication_date: string
}

async function fetchRemotive(): Promise<ScoutResult[]> {
  const categories = ['Design', 'Product', 'Marketing']
  const results: ScoutResult[] = []

  await Promise.allSettled(
    categories.map(async category => {
      const res = await fetch(
        `https://remotive.com/api/remote-jobs?category=${encodeURIComponent(category)}&limit=50`
      )
      if (!res.ok) return
      const data = await res.json() as { jobs: RemotiveJob[] }
      const matching = data.jobs.filter(j => matchesRole(j.title))
      results.push(
        ...matching.map(j => ({
          title: j.title,
          company: j.company_name,
          location: j.candidate_required_location || 'Remote',
          url: j.url,
          source: 'remotive' as const,
          raw_jd: j.description,
          scraped_at: j.publication_date || now(),
        }))
      )
    })
  )

  return results
}

// ── RSS helper ─────────────────────────────────────────────────────────────────

interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
}

function parseRss(xml: string): RssItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  return Array.from(doc.querySelectorAll('item')).map(item => ({
    title: item.querySelector('title')?.textContent?.trim() ?? '',
    // <link> in RSS is a text node sibling of the element, not a child
    link:
      item.querySelector('link')?.textContent?.trim() ||
      item.getElementsByTagName('link')[0]?.textContent?.trim() ||
      '',
    description: item.querySelector('description')?.textContent?.trim() ?? '',
    pubDate: item.querySelector('pubDate')?.textContent?.trim() ?? '',
  }))
}

function safeDate(raw: string): string {
  try {
    return raw ? new Date(raw).toISOString() : now()
  } catch {
    return now()
  }
}

// ── GermanTechJobs RSS ─────────────────────────────────────────────────────────
// Format: "Role @ Company [salary range]"

function parseGTJTitle(raw: string): { role: string; company: string } {
  const match = raw.match(/^(.+?)\s+@\s+(.+?)(?:\s+\[.+\])?$/)
  return match
    ? { role: match[1].trim(), company: match[2].trim() }
    : { role: raw, company: '' }
}

async function fetchGermanTechJobs(): Promise<ScoutResult[]> {
  const res = await fetch('https://germantechjobs.de/rss')
  if (!res.ok) return []
  const xml = await res.text()
  return parseRss(xml)
    .filter(item => matchesRole(item.title))
    .map(item => {
      const { role, company } = parseGTJTitle(item.title)
      return {
        title: role,
        company,
        location: 'Germany',
        url: item.link,
        source: 'germantechjobs' as const,
        raw_jd: item.description,
        scraped_at: safeDate(item.pubDate),
      }
    })
}

// ── EURemoteJobs RSS ───────────────────────────────────────────────────────────

async function fetchEURemoteJobs(): Promise<ScoutResult[]> {
  const res = await fetch('https://euremotejobs.com/feed/')
  if (!res.ok) return []
  const xml = await res.text()
  return parseRss(xml)
    .filter(item => matchesRole(item.title))
    .map(item => ({
      title: item.title,
      company: '',
      location: 'Remote Europe',
      url: item.link,
      source: 'euremotejobs' as const,
      raw_jd: item.description,
      scraped_at: safeDate(item.pubDate),
    }))
}

// ── Greenhouse ─────────────────────────────────────────────────────────────────
// Public board API — free, no key, CORS-enabled
// Add more companies by appending to GREENHOUSE_COMPANIES

interface GreenhouseJob {
  id: number
  title: string
  location: { name: string }
  absolute_url: string
  content?: string
  updated_at: string
}

const GREENHOUSE_COMPANIES = [
  { slug: 'talonone',     name: 'Talon.one' },
  { slug: 'awin',         name: 'Awin Global' },
  { slug: 'getyourguide', name: 'GetYourGuide' },
]

async function fetchGreenhouse(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  await Promise.allSettled(
    GREENHOUSE_COMPANIES.map(async ({ slug, name }) => {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
      )
      if (!res.ok) return
      const data = await res.json() as { jobs: GreenhouseJob[] }
      const matching = data.jobs.filter(j => matchesRole(j.title))
      results.push(
        ...matching.map(j => ({
          title: j.title,
          company: name,
          location: j.location?.name || 'Unknown',
          url: j.absolute_url,
          source: 'greenhouse' as const,
          raw_jd: j.content ?? '',
          scraped_at: safeDate(j.updated_at),
        }))
      )
    })
  )

  return results
}

// ── SmartRecruiters ────────────────────────────────────────────────────────────
// Public postings API — free, no key
// Add more companies by appending to SMARTRECRUITERS_COMPANIES

interface SRPosting {
  id: string
  name: string
  location: { city?: string; remote?: boolean }
  department: { label?: string }
  ref: string
  releasedDate: string
}

interface SRJobDetail {
  jobAd?: { sections?: { jobDescription?: { text?: string } } }
}

const SMARTRECRUITERS_COMPANIES = [
  { slug: 'DeliveryHero', name: 'Delivery Hero' },
]

async function fetchSmartRecruiters(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  await Promise.allSettled(
    SMARTRECRUITERS_COMPANIES.map(async ({ slug, name }) => {
      // Search with role keywords to avoid fetching all 1000+ jobs
      const searches = ROLE_KEYWORDS.slice(0, 4).map(kw =>
        fetch(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&q=${encodeURIComponent(kw)}`)
          .then(r => r.ok ? r.json() as Promise<{ content: SRPosting[] }> : { content: [] })
      )
      const pages = await Promise.allSettled(searches)
      const seen = new Set<string>()
      const matching: SRPosting[] = []

      for (const page of pages) {
        if (page.status !== 'fulfilled') continue
        for (const job of page.value.content ?? []) {
          if (!seen.has(job.id) && matchesRole(job.name)) {
            seen.add(job.id)
            matching.push(job)
          }
        }
      }

      // Fetch full description for each matched job
      await Promise.allSettled(
        matching.map(async job => {
          let description = ''
          try {
            const detail = await fetch(
              `https://api.smartrecruiters.com/v1/companies/${slug}/postings/${job.id}`
            )
            if (detail.ok) {
              const d = await detail.json() as SRJobDetail
              description = d.jobAd?.sections?.jobDescription?.text ?? ''
            }
          } catch { /* use empty description */ }

          results.push({
            title: job.name,
            company: name,
            location: job.location?.remote ? 'Remote' : (job.location?.city ?? 'Unknown'),
            url: job.ref,
            source: 'smartrecruiters' as const,
            raw_jd: description,
            scraped_at: safeDate(job.releasedDate),
          })
        })
      )
    })
  )

  return results
}

// ── Lever ──────────────────────────────────────────────────────────────────────
// Public postings API — free, no key, full description inline
// Add companies here as discovered

interface LeverPosting {
  id: string
  text: string
  categories: { location?: string; team?: string }
  hostedUrl: string
  descriptionPlain: string
  createdAt: number
}

const LEVER_COMPANIES: Array<{ slug: string; name: string }> = [
  // Add companies here, e.g: { slug: 'somecompany', name: 'Some Company' }
]

async function fetchLever(): Promise<ScoutResult[]> {
  if (LEVER_COMPANIES.length === 0) return []
  const results: ScoutResult[] = []

  await Promise.allSettled(
    LEVER_COMPANIES.map(async ({ slug, name }) => {
      const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`)
      if (!res.ok) return
      const jobs = await res.json() as LeverPosting[]
      const matching = jobs.filter(j => matchesRole(j.text))
      results.push(
        ...matching.map(j => ({
          title: j.text,
          company: name,
          location: j.categories?.location ?? 'Unknown',
          url: j.hostedUrl,
          source: 'lever' as const,
          raw_jd: j.descriptionPlain ?? '',
          scraped_at: j.createdAt ? new Date(j.createdAt).toISOString() : now(),
        }))
      )
    })
  )

  return results
}

// ── Recruitee ──────────────────────────────────────────────────────────────────
// Subdomain API — free, no key, full description inline
// Add companies here as discovered

interface RecruiteeOffer {
  id: number
  title: string
  city: string
  remote_option: string
  careers_url: string
  description: string
  created_at: string
}

const RECRUITEE_COMPANIES = [
  { slug: 'airapps', name: 'Air Apps' },
]

async function fetchRecruitee(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  await Promise.allSettled(
    RECRUITEE_COMPANIES.map(async ({ slug, name }) => {
      const res = await fetch(`https://${slug}.recruitee.com/api/offers/`)
      if (!res.ok) return
      const data = await res.json() as { offers: RecruiteeOffer[] }
      const matching = (data.offers ?? []).filter(j => matchesRole(j.title))
      results.push(
        ...matching.map(j => ({
          title: j.title,
          company: name,
          location: j.remote_option === 'remote' ? 'Remote' : (j.city ?? 'Unknown'),
          url: j.careers_url,
          source: 'recruitee' as const,
          raw_jd: j.description ?? '',
          scraped_at: safeDate(j.created_at),
        }))
      )
    })
  )

  return results
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function runScout(): Promise<ScoutResult[]> {
  const settled = await Promise.allSettled([
    fetchArbeitnow(),
    fetchRemotive(),
    fetchGermanTechJobs(),
    fetchEURemoteJobs(),
    fetchGreenhouse(),
    fetchSmartRecruiters(),
    fetchLever(),
    fetchRecruitee(),
  ])

  const all: ScoutResult[] = settled.flatMap(r =>
    r.status === 'fulfilled' ? r.value : []
  )

  // Deduplicate by URL
  const seen = new Set<string>()
  return all.filter(item => {
    if (!item.url || seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}
