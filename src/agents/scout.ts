import type { ScoutResult } from './types'

// ── Role matching ──────────────────────────────────────────────────────────────
// Expanded keyword set covering all three CV tracks (ux / pm / devrel)

const ROLE_KEYWORDS = [
  // UX / Design
  'ux engineer', 'ux designer', 'product designer', 'ui/ux', 'ui designer',
  'interaction designer', 'experience designer', 'design engineer',
  'frontend designer', 'design systems', 'figma',
  // Product
  'product manager', 'product owner', 'senior pm', 'lead pm',
  'head of product', 'director of product',
  // DevRel / Community
  'developer relations', 'devrel', 'developer advocate', 'developer experience',
  'dx engineer', 'community manager', 'technical evangelist',
  'platform evangelist', 'solutions engineer',
  // AI / Tooling (adjacent roles Athar is qualified for)
  'ai product manager', 'ai ux', 'conversational designer',
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
  const results: ScoutResult[] = []

  for (let page = 1; page <= 6; page++) {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`)
    if (!res.ok) break
    const data = await res.json() as { data: ArbeitnowJob[] }
    if (!data.data?.length) break  // genuinely empty page — stop
    const matching = data.data.filter(
      j => matchesRole(j.title) || matchesRole((j.tags ?? []).join(' '))
    )
    results.push(
      ...matching.map(j => ({
        title: j.title,
        company: j.company_name,
        location: j.remote ? 'Remote' : (j.location || 'Germany'),
        url: j.url,
        source: 'arbeitnow' as const,
        raw_jd: j.description,
        scraped_at: safeDate(j.created_at ?? ''),
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

// ── Himalayas RSS ──────────────────────────────────────────────────────────────
// https://himalayas.app — quality remote-first job board, CORS-enabled RSS

async function fetchHimalayas(): Promise<ScoutResult[]> {
  // Fetch per-category RSS feeds
  const feeds = [
    'https://himalayas.app/jobs/categories/design/feed',
    'https://himalayas.app/jobs/categories/product/feed',
    'https://himalayas.app/jobs/categories/developer-relations/feed',
  ]
  const results: ScoutResult[] = []

  await Promise.allSettled(
    feeds.map(async feedUrl => {
      const res = await fetch(feedUrl)
      if (!res.ok) return
      const xml = await res.text()
      const matching = parseRss(xml).filter(item => matchesRole(item.title))
      results.push(
        ...matching.map(item => ({
          title: item.title,
          company: '',
          location: 'Remote',
          url: item.link,
          source: 'himalayas' as const,
          raw_jd: item.description,
          scraped_at: safeDate(item.pubDate),
        }))
      )
    })
  )

  return results
}

// ── Welcome to the Jungle (Otta) RSS ──────────────────────────────────────────
// https://www.welcometothejungle.com — major EU job board with RSS per category

async function fetchWelcomeToTheJungle(): Promise<ScoutResult[]> {
  // WTTJ provides RSS per job category tag
  const feeds = [
    'https://www.welcometothejungle.com/en/jobs.rss?refinementList%5Bjob_category.en%5D%5B0%5D=Design',
    'https://www.welcometothejungle.com/en/jobs.rss?refinementList%5Bjob_category.en%5D%5B0%5D=Product',
  ]
  const results: ScoutResult[] = []

  await Promise.allSettled(
    feeds.map(async feedUrl => {
      const res = await fetch(feedUrl)
      if (!res.ok) return
      const xml = await res.text()
      const matching = parseRss(xml).filter(item => matchesRole(item.title))
      results.push(
        ...matching.map(item => ({
          title: item.title,
          company: '',
          location: 'Europe',
          url: item.link,
          source: 'wttj' as const,
          raw_jd: item.description,
          scraped_at: safeDate(item.pubDate),
        }))
      )
    })
  )

  return results
}

// ── The Hub (thehub.io) ────────────────────────────────────────────────────────
// Nordic + Berlin tech startup job board — free JSON API, CORS-enabled

interface HubJob {
  id: number
  title: string
  company: { name: string }
  locations: Array<{ city: string; country: string }>
  url: string
  description: string
  createdAt: string
}

async function fetchTheHub(): Promise<ScoutResult[]> {
  // The Hub public search API — returns JSON
  const keywords = ['ux designer', 'product manager', 'developer relations', 'ux engineer']
  const results: ScoutResult[] = []
  const seen = new Set<string>()

  await Promise.allSettled(
    keywords.map(async kw => {
      const res = await fetch(
        `https://thehub.io/api/v1/jobs?query=${encodeURIComponent(kw)}&limit=50`
      )
      if (!res.ok) return
      const data = await res.json() as { jobs?: HubJob[] }
      for (const job of data.jobs ?? []) {
        if (seen.has(String(job.id)) || !matchesRole(job.title)) continue
        seen.add(String(job.id))
        const loc = job.locations?.[0]
        results.push({
          title: job.title,
          company: job.company?.name ?? '',
          location: loc ? `${loc.city}, ${loc.country}` : 'Unknown',
          url: job.url ?? `https://thehub.io/jobs/${job.id}`,
          source: 'thehub' as const,
          raw_jd: job.description ?? '',
          scraped_at: safeDate(job.createdAt),
        })
      }
    })
  )

  return results
}

// ── Workable ───────────────────────────────────────────────────────────────────
// Many Berlin/EU startups use Workable. Public board shortlinks resolve to
// jobs.workable.com/<slug> — we list target companies with known slugs.
// To add a company: find their Workable URL and extract the slug.

interface WorkableJob {
  id: string
  title: string
  full_title: string
  shortcode: string
  url: string
  location: { city: string; country: string; remote?: boolean }
  department: string
  description: string
  created_at: string
}

const WORKABLE_COMPANIES = [
  { slug: 'taktile',      name: 'Taktile' },
  { slug: 'gorillas',     name: 'Gorillas' },
  { slug: 'sumup',        name: 'SumUp' },
  { slug: 'n26',          name: 'N26' },
  { slug: 'hellofresh',   name: 'HelloFresh' },
  { slug: 'personio',     name: 'Personio' },
  { slug: 'contentful',   name: 'Contentful' },
  { slug: 'ecosia',       name: 'Ecosia' },
  { slug: 'eyeo',         name: 'eyeo (Adblock Plus)' },
]

async function fetchWorkable(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  await Promise.allSettled(
    WORKABLE_COMPANIES.map(async ({ slug, name }) => {
      const res = await fetch(`https://apply.workable.com/api/v2/accounts/${slug}/jobs`)
      if (!res.ok) return
      const data = await res.json() as { results?: WorkableJob[] }
      const matching = (data.results ?? []).filter(j => matchesRole(j.title))
      results.push(
        ...matching.map(j => ({
          title: j.title,
          company: name,
          location: j.location?.remote
            ? 'Remote'
            : `${j.location?.city ?? ''}, ${j.location?.country ?? ''}`.replace(/^, |, $/, ''),
          url: j.url ?? `https://apply.workable.com/${slug}/j/${j.shortcode}`,
          source: 'workable' as const,
          raw_jd: j.description ?? '',
          scraped_at: safeDate(j.created_at),
        }))
      )
    })
  )

  return results
}

// ── Personio Career Pages ──────────────────────────────────────────────────────
// Many DACH startups host careers on career.personio.de/<slug>
// Public JSON API — free, no key

interface PersonioJob {
  id: number
  name: string
  office: string
  department: string
  employment_type: string
  seniority: string
  schedule: string
  created_at: string
  occupation: string
  occupation_category: string
}

const PERSONIO_COMPANIES = [
  { slug: 'almedia',    name: 'Almedia' },
  { slug: 'truffls',   name: 'Truffls' },
  { slug: 'malt',      name: 'Malt' },
  { slug: 'yepoda',    name: 'Yepoda' },
  { slug: 'forto',     name: 'Forto' },
  { slug: 'scalable',  name: 'Scalable Capital' },
  { slug: 'phoronix',  name: 'Phoronix' },
  { slug: 'unu',       name: 'unu Motors' },
]

async function fetchPersonio(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  await Promise.allSettled(
    PERSONIO_COMPANIES.map(async ({ slug, name }) => {
      const res = await fetch(`https://api.personio.de/v1/recruiting/companies/${slug}/jobs`)
      if (!res.ok) return
      const data = await res.json() as { data?: PersonioJob[] }
      const matching = (data.data ?? []).filter(j => matchesRole(j.name))
      results.push(
        ...matching.map(j => ({
          title: j.name,
          company: name,
          location: j.office ?? 'Germany',
          url: `https://career.personio.de/${slug}/job/${j.id}`,
          source: 'personio' as const,
          raw_jd: '',  // description requires a detail fetch; classifier can work with title+company
          scraped_at: safeDate(j.created_at),
        }))
      )
    })
  )

  return results
}

// ── Ashby ──────────────────────────────────────────────────────────────────────
// Many VC-backed Berlin/EU startups use Ashby (jobs.ashbyhq.com/<slug>)
// Public JSON API — free, no key

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

const ASHBY_COMPANIES = [
  { slug: 'wefox',         name: 'wefox' },
  { slug: 'lemon.markets', name: 'Lemon Markets' },
  { slug: 'stacked',       name: 'Stacked' },
  { slug: 'proxify',       name: 'Proxify' },
  { slug: 'pitch',         name: 'Pitch' },
]

async function fetchAshby(): Promise<ScoutResult[]> {
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

const GREENHOUSE_COMPANIES = [
  { slug: 'talonone',       name: 'Talon.one' },
  { slug: 'awin',           name: 'Awin Global' },
  { slug: 'getyourguide',   name: 'GetYourGuide' },
  { slug: 'zalando',        name: 'Zalando' },
  { slug: 'klarna',         name: 'Klarna' },
  { slug: 'soundcloud',     name: 'SoundCloud' },
  { slug: 'adjust',         name: 'Adjust' },
  { slug: 'babbel',         name: 'Babbel' },
  { slug: 'omio',           name: 'Omio' },
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
      const searches = ROLE_KEYWORDS.slice(0, 5).map(kw =>
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

const LEVER_COMPANIES: Array<{ slug: string; name: string }> = [
  { slug: 'unu',           name: 'unu Motors' },
  { slug: 'thermondo',     name: 'Thermondo' },
  { slug: 'sennder',       name: 'sennder' },
  { slug: 'moonfare',      name: 'Moonfare' },
  // Add companies here as discovered
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
  { slug: 'airapps',    name: 'Air Apps' },
  { slug: 'billbee',   name: 'Billbee' },
  { slug: 'raisin',    name: 'Raisin' },
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
    fetchHimalayas(),
    fetchWelcomeToTheJungle(),
    fetchTheHub(),
    fetchWorkable(),
    fetchPersonio(),
    fetchAshby(),
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
