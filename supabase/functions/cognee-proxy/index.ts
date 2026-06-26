// Supabase Edge Function: cognee-proxy
// Proxies requests to a Cognee server (cloud or self-hosted), bypassing CORS.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Paths to try for search, in order. Cognee Cloud moved search between versions.
const SEARCH_PATHS = ['/api/v1/search', '/v1/search']

const COGNEE_PATHS: Record<string, string> = {
  add: '/api/v1/add',
  cognify: '/api/v1/cognify',
  delete: '/api/v1/datasets',
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

    // Search: try multiple paths until one returns non-405
    if (action === 'search') {
      let lastStatus = 405
      let lastText = ''
      for (const path of SEARCH_PATHS) {
        const res = await fetch(`${cogneeBaseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cogneeApiKey}`,
          },
          body: JSON.stringify(payload),
        })
        const text = await res.text()
        if (res.status !== 405) {
          return new Response(text, {
            status: res.status,
            headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
        lastStatus = res.status
        lastText = text
      }
      return new Response(lastText || JSON.stringify({ error: 'Cognee search endpoint returned 405 on all known paths' }), {
        status: lastStatus,
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
