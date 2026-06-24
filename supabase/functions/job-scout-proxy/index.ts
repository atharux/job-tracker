// Supabase Edge Function: job-scout-proxy
// Fetches from CORS-blocked job boards server-side and returns ScoutResult[].

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface ScoutResult {
  title: string
  company: string
  location: string
  url: string
  source: string
  raw_jd: string
  scraped_at: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function now(): string { return new Date().toISOString() }
function safeDate(raw: string): string {
  try { return raw ? new Date(raw).toISOString() : now() } catch { return now() }
}

const ROLE_KEYWORDS = [
  // UX / Design
  'ux engineer', 'ux designer', 'ux/ui', 'ui/ux', 'ui designer',
  'product designer', 'interaction designer', 'experience designer',
  'design engineer', 'frontend designer', 'design systems',
  'visual designer', 'ux researcher', 'user researcher',
  'head of design', 'design lead', 'lead designer', 'ux lead',
  'vp of design', 'director of design', 'design manager',
  'user experience', 'ux writer', 'content designer', 'content strategist',
  'service designer',
  // Product
  'product manager', 'product owner', 'senior pm', 'lead pm',
  'head of product', 'director of product', 'product lead',
  'vp of product', 'group product manager',
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

// ── Workable ───────────────────────────────────────────────────────────────────
// Uses POST /api/v3 with JSON body — v2 GET requires a shortcode parameter

interface WorkableJob {
  id: string
  title: string
  shortcode: string
  url: string
  location: { city: string; country: string; remote?: boolean }
  created_at: string
}

interface WorkableResponse {
  results: WorkableJob[]
  next_page?: string
}

const WORKABLE_COMPANIES = [
  { slug: 'taktile',      name: 'Taktile' },
  { slug: 'sumup',        name: 'SumUp' },
  { slug: 'hellofresh',   name: 'HelloFresh' },
  { slug: 'contentful',   name: 'Contentful' },
  { slug: 'ecosia',       name: 'Ecosia' },
  { slug: 'blinkist',     name: 'Blinkist' },
  { slug: 'flixbus',      name: 'FlixBus' },
  { slug: 'gorillas',     name: 'Gorillas' },
  { slug: 'penta',        name: 'Penta' },
]

async function fetchWorkable(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  await Promise.allSettled(WORKABLE_COMPANIES.map(async ({ slug, name }) => {
    const url = `https://apply.workable.com/api/v3/accounts/${slug}/jobs`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '', location: [], department: [], worktype: [] }),
    })
    console.log('[workable]', slug, 'status:', res.status)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.log('[workable]', slug, 'error:', body.slice(0, 150))
      return
    }
    const data = await res.json() as WorkableResponse
    const all = data.results ?? []
    const matching = all.filter(j => matchesRole(j.title))
    console.log('[workable]', slug, '— total:', all.length, 'matching:', matching.length)
    matching.forEach(j => results.push({
      title: j.title,
      company: name,
      location: j.location?.remote ? 'Remote'
        : `${j.location?.city ?? ''}, ${j.location?.country ?? ''}`.replace(/^, |, $/, ''),
      url: j.url ?? `https://apply.workable.com/${slug}/j/${j.shortcode}`,
      source: 'workable',
      raw_jd: '',
      scraped_at: safeDate(j.created_at),
    }))
  }))

  console.log('[workable] total results:', results.length)
  return results
}

// ── Welcome to the Jungle ──────────────────────────────────────────────────────
// Uses their JSON search API instead of RSS (RSS feed format is non-standard)

interface WTTJJob {
  slug: string
  name: string
  company: { name: string; slug: string }
  office: { city: string; country: string }
  remote: string  // 'no' | 'partial' | 'full' | 'punctual'
  published_at: string
  description?: string
}

interface WTTJResponse {
  jobs: WTTJJob[]
  total: number
}

async function fetchWTTJ(): Promise<ScoutResult[]> {
  const queries = ['ux designer', 'product manager', 'developer relations', 'ux engineer', 'product designer']
  const results: ScoutResult[] = []
  const seen = new Set<string>()

  await Promise.allSettled(queries.map(async query => {
    const url = `https://www.welcometothejungle.com/api/v1/jobs?query=${encodeURIComponent(query)}&page=1&per_page=30`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; JobScout/1.0)',
      },
    })
    console.log('[wttj] query:', query, 'status:', res.status)
    if (!res.ok) return
    const data = await res.json() as WTTJResponse
    console.log('[wttj] query:', query, 'returned:', data.jobs?.length ?? 0, 'of', data.total)
    for (const job of data.jobs ?? []) {
      if (seen.has(job.slug) || !matchesRole(job.name)) continue
      seen.add(job.slug)
      const isRemote = job.remote === 'full'
      results.push({
        title: job.name,
        company: job.company?.name ?? '',
        location: isRemote ? 'Remote' : `${job.office?.city ?? ''}, ${job.office?.country ?? ''}`.replace(/^, |, $/, ''),
        url: `https://www.welcometothejungle.com/en/companies/${job.company?.slug}/jobs/${job.slug}`,
        source: 'wttj',
        raw_jd: job.description ?? '',
        scraped_at: safeDate(job.published_at),
      })
    }
  }))

  console.log('[wttj] total results:', results.length)
  return results
}

// ── Personio ───────────────────────────────────────────────────────────────────
// career.personio.de public API — no key required

interface PersonioJob {
  id: number
  name: string
  office: string
  created_at: string
}

// Almedia → Ashby, Malt → Lever, Yepoda → Ashby (handled directly in scout.ts)
const PERSONIO_COMPANIES = [
  { slug: 'truffls',       name: 'Truffls' },
  { slug: 'forto',         name: 'Forto' },
  { slug: 'scalable',      name: 'Scalable Capital' },
  { slug: 'unu',           name: 'unu Motors' },
  { slug: 'zenjob',        name: 'Zenjob' },
  { slug: 'aboutyou',      name: 'About You' },
  { slug: 'traderepu',     name: 'Trade Republic' },
  { slug: 'flink',         name: 'Flink' },
]

async function fetchPersonio(): Promise<ScoutResult[]> {
  const results: ScoutResult[] = []

  await Promise.allSettled(PERSONIO_COMPANIES.map(async ({ slug, name }) => {
    const url = `https://api.personio.de/v1/recruiting/companies/${slug}/jobs`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })
    console.log('[personio]', slug, 'status:', res.status)
    if (!res.ok) return
    const data = await res.json() as { data?: PersonioJob[] }
    const all = data.data ?? []
    const matching = all.filter(j => matchesRole(j.name))
    console.log('[personio]', slug, '— total:', all.length, 'matching:', matching.length,
      '| all titles:', all.map(j => j.name).slice(0, 5).join(', '))
    matching.forEach(j => results.push({
      title: j.name,
      company: name,
      location: j.office ?? 'Germany',
      url: `https://career.personio.de/${slug}/job/${j.id}`,
      source: 'personio',
      raw_jd: '',
      scraped_at: safeDate(j.created_at),
    }))
  }))

  console.log('[personio] total results:', results.length)
  return results
}

// ── Himalayas ──────────────────────────────────────────────────────────────────
// Free public JSON API — no key required. Max 20 per request; paginate 3 pages
// per query to get up to 60 results per role type.

interface HimalayasJob {
  title: string
  company: { name: string }
  location: string
  applicationUrl: string
  description: string
  publishedAt: string
}

interface HimalayasResponse {
  jobs: HimalayasJob[]
}

async function fetchHimalayas(): Promise<ScoutResult[]> {
  const queries = ['ux designer', 'product manager', 'developer relations', 'product designer']
  const results: ScoutResult[] = []
  const seen = new Set<string>()

  await Promise.allSettled(queries.flatMap(q =>
    [1, 2, 3].map(async page => {
      const url = `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=20`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) return
      const data = await res.json() as HimalayasResponse
      for (const j of data.jobs ?? []) {
        if (!j.applicationUrl || seen.has(j.applicationUrl)) continue
        seen.add(j.applicationUrl)
        if (!matchesRole(j.title)) continue
        results.push({
          title: j.title,
          company: j.company?.name ?? '',
          location: j.location ?? 'Remote',
          url: j.applicationUrl,
          source: 'himalayas',
          raw_jd: j.description ?? '',
          scraped_at: safeDate(j.publishedAt ?? ''),
        })
      }
    })
  ))

  console.log('[himalayas] total results:', results.length)
  return results
}

// ── WeWorkRemotely RSS ─────────────────────────────────────────────────────────
// Design + Product RSS feeds. CORS-blocked in browsers; handled here.

function parseRss(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = []
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
      return m ? (m[1] ?? m[2] ?? '').trim() : ''
    }
    const linkMatch = block.match(/<link>\s*(https?:\/\/[^\s<]+)\s*<\/link>|<link\s*\/>[\s\S]*?<([^>]+)>|<link>(.*?)<\/link>/)
    items.push({
      title: get('title'),
      link: get('link') || '',
      description: get('description'),
      pubDate: get('pubDate'),
    })
  }
  return items
}

async function fetchWeWorkRemotelyProxy(): Promise<ScoutResult[]> {
  const feeds = [
    'https://weworkremotely.com/categories/remote-design-jobs.rss',
    'https://weworkremotely.com/categories/remote-product-jobs.rss',
  ]
  const results: ScoutResult[] = []
  const seen = new Set<string>()

  await Promise.allSettled(feeds.map(async feedUrl => {
    const res = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobScout/1.0)' } })
    if (!res.ok) return
    const xml = await res.text()
    for (const item of parseRss(xml)) {
      const link = item.link || item.title
      if (!link || seen.has(link)) continue
      seen.add(link)
      const colonIdx = item.title.indexOf(': ')
      const company = colonIdx > -1 ? item.title.slice(0, colonIdx).trim() : ''
      const title = colonIdx > -1 ? item.title.slice(colonIdx + 2).trim() : item.title
      if (!matchesRole(title)) continue
      results.push({
        title,
        company,
        location: 'Remote',
        url: link,
        source: 'weworkremotely',
        raw_jd: item.description,
        scraped_at: safeDate(item.pubDate),
      })
    }
  }))

  console.log('[weworkremotely] total results:', results.length)
  return results
}

// ── Handler ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  console.log('[job-scout-proxy] starting')

  try {
    const [workableR, wttjR, personioR, himalayasR, wwrR] = await Promise.allSettled([
      fetchWorkable(),
      fetchWTTJ(),
      fetchPersonio(),
      fetchHimalayas(),
      fetchWeWorkRemotelyProxy(),
    ])

    const sources = [
      { name: 'workable',        result: workableR },
      { name: 'wttj',            result: wttjR },
      { name: 'personio',        result: personioR },
      { name: 'himalayas',       result: himalayasR },
      { name: 'weworkremotely',  result: wwrR },
    ]

    sources.forEach(({ name, result }) => {
      if (result.status === 'rejected') {
        console.error(`[job-scout-proxy] ${name} threw:`, result.reason)
      } else {
        console.log(`[job-scout-proxy] ${name} => ${result.value.length} jobs`)
      }
    })

    const all: ScoutResult[] = sources.flatMap(({ result }) =>
      result.status === 'fulfilled' ? result.value : []
    )

    console.log('[job-scout-proxy] grand total:', all.length)

    return new Response(JSON.stringify({ jobs: all, count: all.length }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[job-scout-proxy] fatal:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
