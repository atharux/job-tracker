// Cognee knowledge graph client.
// All calls route through a Supabase Edge Function to avoid CORS.
// Supports Cognee Cloud (platform.cognee.ai) and self-hosted Docker.

const COGNEE_API_KEY_LS = 'cognee_api_key'
const COGNEE_BASE_URL_LS = 'cognee_base_url'
export const COGNEE_DEFAULT_BASE_URL = 'http://localhost:8000'

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cognee-proxy`
const PROXY_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const COGNEE_DATASET = 'job_tracker'

export function hasCogneeConfig(): boolean {
  return !!localStorage.getItem(COGNEE_API_KEY_LS)
}

export function getCogneeConfig(): { apiKey: string; baseUrl: string } {
  return {
    apiKey: localStorage.getItem(COGNEE_API_KEY_LS) ?? '',
    baseUrl: localStorage.getItem(COGNEE_BASE_URL_LS) ?? COGNEE_DEFAULT_BASE_URL,
  }
}

async function proxyCall(action: string, payload: unknown): Promise<Response> {
  const { apiKey, baseUrl } = getCogneeConfig()
  return fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROXY_ANON_KEY}`,
      'apikey': PROXY_ANON_KEY,
    },
    body: JSON.stringify({ action, payload, cogneeApiKey: apiKey, cogneeBaseUrl: baseUrl }),
  })
}

// Feed a text document into Cognee
async function cogneeAdd(text: string, dataset = COGNEE_DATASET): Promise<boolean> {
  const res = await proxyCall('add', { data: text, datasets: [dataset] })
  if (!res.ok) console.warn('[cognee] add failed:', res.status)
  return res.ok
}

// Build the knowledge graph from ingested data
async function cogneeCognify(dataset = COGNEE_DATASET): Promise<boolean> {
  const res = await proxyCall('cognify', { datasets: [dataset] })
  if (!res.ok) console.warn('[cognee] cognify failed:', res.status)
  return res.ok
}

// Ingest a document and build the graph in sequence
export async function cogneeRemember(text: string, dataset = COGNEE_DATASET): Promise<void> {
  if (!hasCogneeConfig()) return
  try {
    const added = await cogneeAdd(text, dataset)
    if (added) await cogneeCognify(dataset)
  } catch (err) {
    console.warn('[cognee] remember error:', err)
  }
}

// Query the knowledge graph with natural language
export async function cogneeSearch(query: string): Promise<string> {
  if (!hasCogneeConfig()) return ''
  try {
    const res = await proxyCall('search', { query, search_type: 'GRAPH_COMPLETION' })
    const raw = await res.text()
    if (!res.ok) {
      console.warn('[cognee] search HTTP error', res.status, raw)
      // If all path/method combos were tried, surface the diagnostic
      try {
        const diag = JSON.parse(raw) as { error?: string; attempts?: Array<{ path: string; method: string; status: number; allow: string }> }
        if (diag.attempts) {
          const summary = diag.attempts.map(a => `${a.method} ${a.path} → ${a.status}${a.allow ? ` (Allow: ${a.allow})` : ''}`).join(' | ')
          return `⚠ Cognee search unreachable. Tried: ${summary}. Check the base URL in Settings — it may need to be the API endpoint, not the UI tenant URL.`
        }
      } catch { /* not JSON */ }
      return `⚠ Cognee error ${res.status}: ${raw.slice(0, 200)}`
    }
    if (!raw.trim()) return ''

    let data: unknown
    try { data = JSON.parse(raw) } catch { return raw }

    // Cognee often returns an array of result nodes
    if (Array.isArray(data)) {
      if ((data as unknown[]).length === 0) return ''
      return (data as Array<Record<string, unknown>>)
        .map(item => (item.text as string) || (item.content as string) || (item.summary as string) || JSON.stringify(item))
        .filter(Boolean)
        .join('\n\n')
    }

    const obj = data as Record<string, unknown>
    return (
      (obj?.output as string) ??
      (obj?.result as string) ??
      ((obj?.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content) ??
      raw
    )
  } catch (err) {
    console.warn('[cognee] search error:', err)
    return `⚠ ${(err as Error).message}`
  }
}

// Seed the user's full profile into Cognee so queries can reference both sides
export async function cogneeRememberProfile(): Promise<void> {
  if (!hasCogneeConfig()) return
  // Dynamic import keeps USER_PROFILE out of every code path
  const { USER_PROFILE } = await import('../config/userProfile')
  const { name, background, location, locationPreferences, community, tracks, languages } = USER_PROFILE

  const trackLines = Object.entries(tracks)
    .map(([k, t]) => `  ${k.toUpperCase()}: ${t.label}\n  ${t.voice.slice(0, 300)}`)
    .join('\n\n')

  const langLine = languages.length
    ? `Languages: ${languages.map(l => `${l.language} (${l.level})`).join(', ')}`
    : ''

  const text = [
    `Candidate: ${name}`,
    `Location: ${location}`,
    `Location Preferences: ${locationPreferences}`,
    langLine,
    community ? `Community: ${community}` : '',
    `Background: ${background}`,
    `CV Tracks:\n${trackLines}`,
  ].filter(Boolean).join('\n')

  await cogneeRemember(text, 'user_profile')
}

// Build a structured memory entry for a classified job
export function buildJobMemory(job: {
  title: string
  company: string
  location: string | null
  raw_jd: string
}, classification: {
  score: number
  cv_track: string
  industry?: string
  key_matches?: string[]
  red_flags?: string[]
}): string {
  return [
    `Job: ${job.title} at ${job.company}`,
    `Location: ${job.location ?? 'Unknown'}`,
    `Industry: ${classification.industry ?? 'Unknown'}`,
    `CV Track: ${classification.cv_track}`,
    `Fit Score: ${classification.score}/10`,
    classification.key_matches?.length
      ? `Key Matches: ${classification.key_matches.join(', ')}`
      : '',
    classification.red_flags?.length
      ? `Red Flags: ${classification.red_flags.join(', ')}`
      : '',
    `Description: ${job.raw_jd?.slice(0, 600) ?? ''}`,
  ].filter(Boolean).join('\n')
}
