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

import { getActiveParent } from '../ai/langfuseClient'

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

interface AICallResult {
  text: string
  model: string
  usage?: { input: number; output: number }
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
const RATE_LIMIT_RE = /rate.limit|too many requests|429/i

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Exponential backoff for 429s: 2s, 4s, 8s
async function withRateLimit<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [2000, 4000, 8000]
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const msg = String(err)
      const isRateLimit = RATE_LIMIT_RE.test(msg)
      if (isRateLimit && attempt < delays.length) {
        const wait = delays[attempt]
        console.warn(`[${label}] rate limited — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${delays.length})`)
        await sleep(wait)
        continue
      }
      throw err
    }
  }
  throw new Error(`${label}: exhausted retries`)
}

// Coder/math models — high context but terrible rate limits and wrong use case
const SKIP_MODEL_RE = /coder|math|code-/i

async function callViaOpenRouter(key: string, opts: AIOptions): Promise<AICallResult> {
  const cached = (getCachedFreeModels() ?? [opts.model]).filter(m => !SKIP_MODEL_RE.test(m))
  // Build retry list: requested model first (if not a coder model), then cached fallbacks
  const base = SKIP_MODEL_RE.test(opts.model) ? FALLBACK_FREE_MODEL : opts.model
  const candidates = [base, ...cached.filter(m => m !== base)].slice(0, 4)

  let lastError = ''
  for (const model of candidates) {
    try {
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
        const data = await res.json() as {
          choices: Array<{ message: { content: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }
        return {
          text: data.choices?.[0]?.message?.content ?? '',
          model,
          usage: data.usage
            ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 }
            : undefined,
        }
      }

      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = err?.error?.message ?? String(res.status)
      // Rate limited — skip this model immediately and try the next one
      if (res.status === 429 || RATE_LIMIT_RE.test(msg)) {
        console.warn(`[openrouter] ${model} rate limited — skipping to next model`)
        lastError = `rate limit: ${msg}`
        continue
      }
      if (MODEL_UNAVAILABLE_RE.test(msg)) {
        lastError = msg
        console.warn(`[openrouter] ${model} unavailable, trying next...`)
        continue
      }
      throw new Error(`OpenRouter error: ${msg}`)
    } catch (err) {
      const msg = String(err)
      if (RATE_LIMIT_RE.test(msg)) {
        lastError = msg
        continue
      }
      throw err
    }
  }

  throw new Error(`OpenRouter: all models rate limited or unavailable. Try again in a minute. (${lastError})`)
}

async function callViaGroq(key: string, opts: AIOptions): Promise<AICallResult> {
  const model = opts.groqModel ?? 'llama-3.3-70b-versatile'
  return withRateLimit(async () => {
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
      const msg = err?.error?.message ?? String(res.status)
      if (res.status === 429 || RATE_LIMIT_RE.test(msg)) throw new Error(`rate limit: ${msg}`)
      throw new Error(`Groq error: ${msg}`)
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      model,
      usage: data.usage
        ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 }
        : undefined,
    }
  }, 'groq')
}

async function callViaAnthropic(key: string, opts: AIOptions): Promise<AICallResult> {
  const systemMsg = opts.messages.find((m) => m.role === 'system')
  const userMessages = opts.messages.filter((m) => m.role !== 'system')
  const model = opts.anthropicModel ?? 'claude-haiku-4-5-20251001'

  const body: Record<string, unknown> = {
    model,
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

  const data = await res.json() as {
    content: Array<{ type: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  return {
    text: data.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
    model,
    usage: data.usage
      ? { input: data.usage.input_tokens ?? 0, output: data.usage.output_tokens ?? 0 }
      : undefined,
  }
}

export async function callAI(opts: AIOptions): Promise<string> {
  const { provider, key } = getKey()
  const parent = getActiveParent()
  const startTime = new Date()

  let result: AICallResult
  try {
    if (provider === 'openrouter') {
      try {
        result = await callViaOpenRouter(key, opts)
      } catch (err) {
        const groqKey = typeof localStorage !== 'undefined' ? localStorage.getItem('groq_api_key') : null
        if (groqKey) {
          console.warn('[callAI] OpenRouter failed, falling back to Groq:', err)
          result = await callViaGroq(groqKey, opts)
        } else {
          const anthropicKey = typeof localStorage !== 'undefined' ? localStorage.getItem('anthropic_api_key') : null
          if (anthropicKey) {
            console.warn('[callAI] OpenRouter failed, falling back to Anthropic:', err)
            result = await callViaAnthropic(anthropicKey, opts)
          } else {
            throw err
          }
        }
      }
    } else if (provider === 'groq') {
      result = await callViaGroq(key, opts)
    } else {
      result = await callViaAnthropic(key, opts)
    }
  } catch (err) {
    if (parent) {
      const gen = parent.generation({
        name: 'llm_call',
        model: opts.model,
        input: opts.messages,
        startTime,
        level: 'ERROR',
        statusMessage: String(err),
      })
      gen.end()
    }
    throw err
  }

  if (parent) {
    const gen = parent.generation({
      name: 'llm_call',
      model: result.model,
      input: opts.messages,
      startTime,
    })
    gen.end({
      output: result.text,
      usage: result.usage
        ? { input: result.usage.input, output: result.usage.output, unit: 'TOKENS' }
        : undefined,
    })
  }

  return result.text
}
