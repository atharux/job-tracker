// Unified AI client for the agent system.
// Priority: OpenRouter key (sessionStorage) → Groq key → Anthropic BYOK (localStorage)
//
// Free model list is fetched from the OpenRouter API and cached in localStorage
// (key: openrouter_free_models, TTL: 24h). Agents call getPreferredFreeModel()
// instead of hardcoding a model string — callViaOpenRouter retries up to 3 models
// on unavailability errors so a single gone-paid model never breaks the pipeline.
//
// Groq (always free, LPU hardware ~320 tok/s):
//   llama-3.3-70b-versatile  — fastest 70B, used as groqModel fallback

const FREE_MODELS_CACHE_KEY = 'openrouter_free_models'
const FREE_MODELS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h
const FALLBACK_FREE_MODEL = 'meta-llama/llama-3.3-70b-instruct:free'

interface FreeModelsCache {
  models: string[]
  cachedAt: number
}

export function getCachedFreeModels(): string[] | null {
  try {
    const raw = localStorage.getItem(FREE_MODELS_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as FreeModelsCache
    if (Date.now() - cache.cachedAt > FREE_MODELS_CACHE_TTL) return null
    return cache.models.length > 0 ? cache.models : null
  } catch {
    return null
  }
}

export async function fetchAndCacheFreeModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return getCachedFreeModels() ?? [FALLBACK_FREE_MODEL]

    const data = await res.json() as { data: Array<{ id: string; context_length?: number; pricing?: { prompt?: string; completion?: string } }> }
    const free = data.data
      .filter(m => m.id.endsWith(':free') && m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
      .map(m => m.id)

    if (free.length > 0) {
      const cache: FreeModelsCache = { models: free, cachedAt: Date.now() }
      localStorage.setItem(FREE_MODELS_CACHE_KEY, JSON.stringify(cache))
    }
    return free.length > 0 ? free : [FALLBACK_FREE_MODEL]
  } catch {
    return getCachedFreeModels() ?? [FALLBACK_FREE_MODEL]
  }
}

// Sync — returns first cached model or hardcoded fallback. Never blocks.
export function getPreferredFreeModel(): string {
  return getCachedFreeModels()?.[0] ?? FALLBACK_FREE_MODEL
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIOptions {
  model: string
  groqModel?: string
  anthropicModel?: string
  messages: AIMessage[]
  max_tokens?: number
  temperature?: number
}

function getKey(): { provider: 'openrouter' | 'groq' | 'anthropic'; key: string } {
  if (typeof sessionStorage !== 'undefined') {
    const orKey = sessionStorage.getItem('openrouter_api_key')
    if (orKey) return { provider: 'openrouter', key: orKey }
  }
  if (typeof localStorage !== 'undefined') {
    const orKey = localStorage.getItem('openrouter_api_key')
    if (orKey) return { provider: 'openrouter', key: orKey }
    const groqKey = localStorage.getItem('groq_api_key')
    if (groqKey) return { provider: 'groq', key: groqKey }
    const anthropicKey = localStorage.getItem('anthropic_api_key')
    if (anthropicKey) return { provider: 'anthropic', key: anthropicKey }
  }
  throw new Error('No API key found. Add an OpenRouter or Groq key in Settings.')
}

const MODEL_UNAVAILABLE_RE = /unavailable|not found|does not exist|quota|no endpoints/i

async function callViaOpenRouter(key: string, opts: AIOptions): Promise<string> {
  const cached = getCachedFreeModels() ?? [opts.model]
  // Build retry list: requested model first, then remaining cached models
  const candidates = [opts.model, ...cached.filter(m => m !== opts.model)].slice(0, 3)

  let lastError = ''
  for (const model of candidates) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': (typeof window !== 'undefined' ? window.location.origin : '') || 'https://job-tracker.app',
        'X-Title': 'Job Tracker',
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: opts.max_tokens,
        temperature: opts.temperature,
      }),
    })

    if (res.ok) {
      if (model !== opts.model) console.warn(`[openrouter] fell back to ${model} (${opts.model} unavailable)`)
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      return data.choices?.[0]?.message?.content ?? ''
    }

    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    const msg = err?.error?.message ?? String(res.status)
    if (MODEL_UNAVAILABLE_RE.test(msg)) {
      console.warn(`[openrouter] ${model} unavailable, trying next...`)
      lastError = msg
      continue
    }
    throw new Error(`OpenRouter error: ${msg}`)
  }

  throw new Error(`OpenRouter error: ${lastError} (all ${candidates.length} models tried)`)
}

async function callViaGroq(key: string, opts: AIOptions): Promise<string> {
  const model = opts.groqModel ?? 'llama-3.3-70b-versatile'
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.max_tokens,
      temperature: opts.temperature,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`Groq error: ${err?.error?.message ?? res.status}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callViaAnthropic(key: string, opts: AIOptions): Promise<string> {
  const systemMsg = opts.messages.find((m) => m.role === 'system')
  const userMessages = opts.messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model: opts.anthropicModel ?? 'claude-haiku-4-5-20251001',
    max_tokens: opts.max_tokens ?? 4096,
    messages: userMessages,
  }
  if (systemMsg) body.system = systemMsg.content
  if (opts.temperature !== undefined) body.temperature = opts.temperature

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`Anthropic error: ${err?.error?.message ?? res.status}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text?: string }> }
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
}

export async function callAI(opts: AIOptions): Promise<string> {
  const { provider, key } = getKey()

  if (provider === 'openrouter') {
    try {
      return await callViaOpenRouter(key, opts)
    } catch (err) {
      // OR failed entirely — fall through to Groq or Anthropic if keys exist
      const groqKey = typeof localStorage !== 'undefined' ? localStorage.getItem('groq_api_key') : null
      if (groqKey) {
        console.warn('[callAI] OpenRouter failed, falling back to Groq:', err)
        return callViaGroq(groqKey, opts)
      }
      const anthropicKey = typeof localStorage !== 'undefined' ? localStorage.getItem('anthropic_api_key') : null
      if (anthropicKey) {
        console.warn('[callAI] OpenRouter failed, falling back to Anthropic:', err)
        return callViaAnthropic(anthropicKey, opts)
      }
      throw err
    }
  }

  if (provider === 'groq') return callViaGroq(key, opts)
  return callViaAnthropic(key, opts)
}
