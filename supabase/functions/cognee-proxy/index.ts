// Supabase Edge Function: cognee-proxy
// Proxies requests to a Cognee server (cloud or self-hosted), bypassing CORS.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const COGNEE_PATHS: Record<string, string> = {
  add: '/api/v1/add',
  cognify: '/api/v1/cognify',
  search: '/api/v1/search',
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

    const path = COGNEE_PATHS[action]
    if (!path) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (!cogneeBaseUrl || !cogneeApiKey) {
      return new Response(JSON.stringify({ error: 'Missing cogneeBaseUrl or cogneeApiKey' }), {
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
