// Supabase Edge Function: cognee-proxy
// Proxies requests to a Cognee server (cloud or self-hosted), bypassing CORS.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Each search attempt: { path, method }
// Try POST first (Cognee self-hosted), then GET (some cloud variants).
// Trailing-slash variants handle nginx/FastAPI strict routing.
const SEARCH_ATTEMPTS = [
  { path: '/api/v1/search', method: 'POST' },
  { path: '/v1/search',     method: 'POST' },
  { path: '/api/v1/search', method: 'GET'  },
  { path: '/v1/search',     method: 'GET'  },
]

const COGNEE_PATHS: Record<string, string> = {
  add:     '/api/v1/add',
  cognify: '/api/v1/cognify',
  delete:  '/api/v1/datasets',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { action, payload, cogneeApiKey, cogneeBaseUrl } = await req.json() as {
      action: string
      payload: unknown
      cogneeApiKey: string
      cogneeBaseUrl: string
    }

    if (!cogneeBaseUrl || !cogneeApiKey) {
      return new Response(JSON.stringify({ error: 'Missing cogneeBaseUrl or cogneeApiKey' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'search') {
      const p = payload as { query?: string; search_type?: string }
      const attempts: Array<{ path: string; method: string; status: number; body: string; allow: string }> = []

      for (const { path, method } of SEARCH_ATTEMPTS) {
        let url = `${cogneeBaseUrl}${path}`
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${cogneeApiKey}`,
        }
        let body: string | undefined

        if (method === 'GET') {
          const qs = new URLSearchParams()
          if (p.query) qs.set('query', p.query)
          if (p.search_type) qs.set('search_type', p.search_type)
          url = `${url}?${qs.toString()}`
        } else {
          headers['Content-Type'] = 'application/json'
          body = JSON.stringify(payload)
        }

        const res = await fetch(url, { method, headers, ...(body ? { body } : {}) })
        const text = await res.text()
        const allow = res.headers.get('allow') ?? ''

        if (res.status !== 405 && res.status !== 404) {
          return new Response(text, {
            status: res.status,
            headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }

        attempts.push({ path, method, status: res.status, body: text.slice(0, 100), allow })
      }

      // All attempts failed — return diagnostic JSON so the client can show it
      return new Response(JSON.stringify({
        error: 'Cognee search: all path/method combinations returned 405 or 404',
        attempts,
      }), {
        status: 405,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const path = COGNEE_PATHS[action]
    if (!path) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const upstream = await fetch(`${cogneeBaseUrl}${path}`, {
      method: action === 'delete' ? 'DELETE' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cogneeApiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const text = await upstream.text()

    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
