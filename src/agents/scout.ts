import type { ScoutResult } from './types'

// ── Edge Function proxy (CORS-blocked sources) ─────────────────────────────────
// Fetches from Himalayas, WTTJ, TheHub, Workable, Personio via Supabase Edge Function.
// Deploy: supabase functions deploy job-scout-proxy

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-scout-proxy`
const PROXY_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function fetchViaProxy(): Promise<ScoutResult[]> {
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PROXY_ANON_KEY}`,
        'apikey': PROXY_ANON_KEY,
      },
    })
    if (!res.ok) {
      console.warn('[scout] proxy returned', res.status, '— skipping proxied sources')
      return []
    }
    const data = await res.json() as { jobs: ScoutResult[] }
    return data.jobs ?? []
  } catch (err) {
    console.warn('[scout] proxy fetch failed:', err)
    return []
  }
}

// ── Role matching ──────────────────────────────────────────────────────────────
// Expanded keyword set covering all three CV tracks (ux / pm / devrel)

const ROLE_KEYWORDS = [
  // UX / Design — both slash orderings are common in real postings
  'ux engineer', 'ux designer', 'ux/ui', 'ui/ux', 'ui designer',
  'product designer', 'interaction designer', 'experience designer',
  'design engineer', 'frontend designer', 'design systems',
  'visual designer', 'ux researcher', 'user researcher',
  'head of design', 'design lead', 'lead designer', 'ux lead',
  'vp of design', 'director of design', 'design manager', 'figma',
  // Broader UX — catches "User Experience Designer", "Head of User Experience"
  'user experience',
  // UX Writing / Content Design
  'ux writer', 'ux writing', 'content designer', 'content strategist',
  // Service / CX Design
  'service designer', 'customer experience designer',
  // Product
  'product manager', 'product owner', 'senior pm', 'lead pm',
  'head of product', 'director of product', 'product lead',
  'vp of product', 'chief product', 'group product manager',
  // DevRel / Community
  'developer relations', 'devrel', 'developer advocate', 'developer experience',
  'dx engineer', 'community manager', 'technical evangelist',
  'platform evangelist', 'solutions engineer', 'api evangelist',
  // AI / Tooling
  'ai product manager', 'ai ux', 'conversational designer',
  'prompt engineer', 'ai designer',
]

function matchesRole(text: string): boolean {
  const lower = text.toLowerCase()
  return ROLE_KEYWORDS.some(kw => lower.includes(kw))
}

function now(): string {
  return new Date().toISOString()
}

function safeDate(raw: string): string {
  try {
    return raw ? new Date(raw).toISOString() : now()
  } catch {
    return now()
  }
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
    link:
      item.querySelector('link')?.textContent?.trim() ||
      item.getElementsByTagName('link')[0]?.textContent?.trim() ||
      '',
    description: item.querySelector('description')?.textContent?.trim() ?? '',
    pubDate: item.querySelector('pubDate')?.textContent?.trim() ?? '',
  }))
}

// ── Arbeitnow REST API ─────────────────────────────────────────────────────────
// https://www.arbeitnow.com/api/job-board-api — free, no key, CORS-enabled
// FIX: removed early-exit on empty page — a page with no matches doesn't mean
// subsequent pages won't have any. Only stop on HTTP error or empty data array.

interface ArbeitnowJob {
  title: string
  company_name: string
  location: string
  url: string
  description: string
  tags: string[]
  remote: boolean
  created_at?: string
}

async function fetchArbeitnow(): Promise<ScoutResult[]> {
  // Fetch 20 pages in parallel — covers ~500 jobs vs the old sequential 6 pages (~150).
  // Pages beyond the last real page return empty data arrays, which we skip gracefully.
  const PAGE_COUNT = 20

  const pages = await Promise.allSettled(
    Array.from({ length: PAGE_COUNT }, (_, i) =>
      fetch(`https://www.arbeitnow.com/api/job-board-api?page=${i + 1}`)
        .then(r => r.ok ? (r.json() as Promise<{ data: ArbeitnowJob[] }>) : Promise.resolve({ data: [] as ArbeitnowJob[] }))
        .catch(() => ({ data: [] as ArbeitnowJob[] }))
    )
  )

  const results: ScoutResult[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    if (page.status !== 'fulfilled') continue
    for (const j of page.value.data ?? []) {
      if (!j.url || seen.has(j.url)) continue
      seen.add(j.url)
      if (matchesRole(j.title) || matchesRole((j.tags ?? []).join(' '))) {
        results.push({
          title: j.title,
          company: j.company_name,
          location: j.remote ? 'Remote' : (j.location || 'Germany'),
          url: j.url,
          source: 'arbeitnow' as const,
          raw_jd: j.description,
          scraped_at: safeDate(j.created_at ?? ''),
        })
      }
    }
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
  const categories = ['Design', 'Product', 'Marketing', 'Software Development']
  const results: ScoutResult[] = []

  await Promise.allSettled(
    categories.map(async category => {
      const res = await fetch(
        `https://remotive.com/api/remote-jobs?category=${encodeURIComponent(category)}&limit=100`
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

// ── GermanTechJobs RSS ─────────────────────────────────────────────────────────

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

// EURemoteJobs removed — CORS-blocked from browser

// ── Ashby ──────────────────────────────────────────────────────────────────────
// VC-backed EU/Berlin startups — public JSON API, CORS-enabled
// Verify slug at: https://api.ashbyhq.com/posting-api/job-board/<slug>

interface AshbyJob {
  id: string
  title: string
  team: string
  location: string
  isRemote: boolean
  jobUrl: string
  descriptionHtml: string
  publishedDate: string
}

const ASHBY_COMPANIES: Array<{ slug: string; name: string }> = [
  { slug: 'taktile',  name: 'Taktile' },
  { slug: 'yepoda',   name: 'Yepoda' },
  { slug: 'almedia',  name: 'Almedia' },
]

async function fetchAshby(): Promise<ScoutResult[]> {
  if (ASHBY_COMPANIES.length === 0) return []
  const results: ScoutResult[] = []

  await Promise.allSettled(
    ASHBY_COMPANIES.map(async ({ slug, name }) => {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)
      if (!res.ok) return
      const data = await res.json() as { jobs?: AshbyJob[] }
      const matching = (data.jobs ?? []).filter(j => matchesRole(j.title))
      results.push(
        ...matching.map(j => ({
          title: j.title,
          company: name,
          location: j.isRemote ? 'Remote' : (j.location ?? 'Unknown'),
          url: j.jobUrl ?? `https://jobs.ashbyhq.com/${slug}/${j.id}`,
          source: 'ashby' as const,
          raw_jd: j.descriptionHtml ?? '',
          scraped_at: safeDate(j.publishedDate),
        }))
      )
    })
  )

  return results
}

// ── Greenhouse ─────────────────────────────────────────────────────────────────

interface GreenhouseJob {
  id: number
  title: string
  location: { name: string }
  absolute_url: string
  content?: string
  updated_at: string
}

// Verified slugs only — test at: https://boards-api.greenhouse.io/v1/boards/<slug>/jobs
const GREENHOUSE_COMPANIES = [
  { slug: 'talonone',       name: 'Talon.one' },
  { slug: 'awin',           name: 'Awin Global' },
  { slug: 'getyourguide',   name: 'GetYourGuide' },
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
  { slug: 'Tier',         name: 'Tier Mobility' },
  { slug: 'Taxfix',       name: 'Taxfix' },
]

async function fetchSmartRecruiters(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  await Promise.allSettled(
    SMARTRECRUITERS_COMPANIES.map(async ({ slug, name }) => {
      // One query per track — broad enough to catch varied titles
      const SR_QUERIES = ['ux designer', 'product designer', 'product manager', 'developer relations']
      const searches = SR_QUERIES.map(kw =>
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

interface LeverPosting {
  id: string
  text: string
  categories: { location?: string; team?: string }
  hostedUrl: string
  descriptionPlain: string
  createdAt: number
}

// Verify slugs at: https://api.lever.co/v0/postings/<slug>
// EU-hosted companies use apiBase: 'https://api.eu.lever.co'
const LEVER_COMPANIES: Array<{ slug: string; name: string; apiBase?: string }> = [
  { slug: 'malt',           name: 'Malt' },
  { slug: 'lovehoneygroup', name: 'Lovehoney Group', apiBase: 'https://api.eu.lever.co' },
  { slug: 'weloglobal',     name: 'Welo Data' },
]

async function fetchLever(): Promise<ScoutResult[]> {
  if (LEVER_COMPANIES.length === 0) return []
  const results: ScoutResult[] = []

  await Promise.allSettled(
    LEVER_COMPANIES.map(async ({ slug, name, apiBase }) => {
      const base = apiBase ?? 'https://api.lever.co'
      const res = await fetch(`${base}/v0/postings/${slug}?mode=json`)
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

// ── WeWorkRemotely RSS ─────────────────────────────────────────────────────────
// Design and Product category feeds. May be CORS-blocked in some browsers —
// falls back gracefully if so (proxy covers it via edge function).

async function fetchWeWorkRemotely(): Promise<ScoutResult[]> {
  const feeds = [
    'https://weworkremotely.com/categories/remote-design-jobs.rss',
    'https://weworkremotely.com/categories/remote-product-jobs.rss',
  ]
  const results: ScoutResult[] = []
  const seen = new Set<string>()

  await Promise.allSettled(feeds.map(async feedUrl => {
    try {
      const res = await fetch(feedUrl)
      if (!res.ok) return
      const xml = await res.text()
      for (const item of parseRss(xml)) {
        if (!item.link || seen.has(item.link)) continue
        seen.add(item.link)
        // WWR title format: "Company: Job Title"
        const colonIdx = item.title.indexOf(': ')
        const company = colonIdx > -1 ? item.title.slice(0, colonIdx).trim() : ''
        const title = colonIdx > -1 ? item.title.slice(colonIdx + 2).trim() : item.title
        if (!matchesRole(title)) continue
        results.push({
          title,
          company,
          location: 'Remote',
          url: item.link,
          source: 'weworkremotely' as const,
          raw_jd: item.description,
          scraped_at: safeDate(item.pubDate),
        })
      }
    } catch { /* CORS-blocked — proxy handles it */ }
  }))

  return results
}

// ── Jobicy RSS ─────────────────────────────────────────────────────────────────
// Free remote jobs RSS — no key required.

async function fetchJobicy(): Promise<ScoutResult[]> {
  const feeds = [
    'https://jobicy.com/feed/job_feed?job_categories=design-multimedia',
    'https://jobicy.com/feed/job_feed?job_categories=management',
  ]
  const results: ScoutResult[] = []
  const seen = new Set<string>()

  await Promise.allSettled(feeds.map(async feedUrl => {
    try {
      const res = await fetch(feedUrl)
      if (!res.ok) return
      const xml = await res.text()
      for (const item of parseRss(xml)) {
        if (!item.link || seen.has(item.link)) continue
        seen.add(item.link)
        if (!matchesRole(item.title)) continue
        results.push({
          title: item.title,
          company: '',
          location: 'Remote',
          url: item.link,
          source: 'jobicy' as const,
          raw_jd: item.description,
          scraped_at: safeDate(item.pubDate),
        })
      }
    } catch { /* swallow network errors */ }
  }))

  return results
}

// ── Recruitee ──────────────────────────────────────────────────────────────────

interface RecruiteeOffer {
  id: number
  title: string
  city: string
  remote_option: string
  careers_url: string
  description: string
  created_at: string
}

// Verify slug at: https://<slug>.recruitee.com/api/offers/
const RECRUITEE_COMPANIES = [
  { slug: 'airapps',    name: 'Air Apps' },
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
    // Direct (CORS-enabled from browser)
    fetchArbeitnow(),
    fetchRemotive(),
    fetchGermanTechJobs(),
    fetchAshby(),
    fetchGreenhouse(),
    fetchSmartRecruiters(),
    fetchLever(),
    fetchRecruitee(),
    fetchWeWorkRemotely(),
    fetchJobicy(),
    // Proxied via Supabase Edge Function (CORS-blocked sources)
    fetchViaProxy(),
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
