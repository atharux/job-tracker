// Unified AI client for the agent system.
// Priority: OpenRouter key (sessionStorage) → Anthropic BYOK (localStorage)
//
// Free OpenRouter models (June 2026):
//   meta-llama/llama-4-maverick:free       — strong instruction following (primary)
//   deepseek/deepseek-chat-v3-0324        — paid only now (was :free)
//   meta-llama/llama-4-scout:free          — 10M context, fast
//   google/gemma-4-26b-it:free             — MoE, only 3.8B active, very fast
//   google/gemma-3-12b-it:free             — lightweight, fast
//   deepseek/deepseek-r1:free              — best reasoning/chain-of-thought
// Groq (always free, LPU hardware ~320 tok/s):
//   llama-3.3-70b-versatile                — fastest 70B model available

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIOptions {
  // OpenRouter model name (e.g. 'perplexity/sonar', 'meta-llama/llama-4-maverick:free')
  model: string
  // Groq model to use when falling back to a Groq key (e.g. 'llama-3.3-70b-versatile')
  groqModel?: string
  // When falling back to direct Anthropic, override the model name
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

async function callViaOpenRouter(key: string, opts: AIOptions): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': (typeof window !== 'undefined' ? window.location.origin : '') || 'https://job-tracker.app',
      'X-Title': 'Job Tracker',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.max_tokens,
      temperature: opts.temperature,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`OpenRouter error: ${err?.error?.message ?? res.status}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
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
  // Extract system message if present as the first message
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
  if (provider === 'openrouter') return callViaOpenRouter(key, opts)
  if (provider === 'groq') return callViaGroq(key, opts)
  return callViaAnthropic(key, opts)
}
