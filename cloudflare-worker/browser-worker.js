// Cloudflare Browser Rendering Worker
// Exposes POST /form-map and POST /screenshot using @cloudflare/puppeteer.
// Replaces Playwright which cannot run in Vite/browser context.
//
// Required secrets (wrangler secret put <NAME>):
//   WORKER_SECRET       — shared secret checked in X-Worker-Secret header
//   ANTHROPIC_API_KEY   — for AI field mapping
//   SUPABASE_URL        — for screenshot uploads
//   SUPABASE_SERVICE_KEY— service-role key (bypasses RLS for storage)

import puppeteer from '@cloudflare/puppeteer'

const OWNER_DATA = {
  first_name: 'Athar',
  last_name: 'Hafiz',
  full_name: 'Athar Hafiz',
  email: 'athar.hafiz@gmail.com',
  phone: '',
  location: 'Berlin, Germany',
  city: 'Berlin',
  country: 'Germany',
  linkedin: 'https://linkedin.com/in/atharhafiz',
  website: 'https://atharhafiz.com',
  years_experience: '10+',
  current_title: 'UX Engineer / AI Product Consultant',
  summary: 'UX Engineer and AI Product Consultant with 10+ years experience, based in Berlin.',
  salary_expectation: '',
  notice_period: '1 month',
  work_authorization: 'EU citizen',
  languages: 'English (native), German (B2)',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function authError() {
  return json({ error: 'Unauthorized' }, 401)
}

function checkAuth(request, env) {
  const secret = request.headers.get('X-Worker-Secret')
  return secret && secret === env.WORKER_SECRET
}

// Extract form fields from a URL using Puppeteer
async function extractFields(browser, url) {
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'))

      return inputs.map((el) => {
        const labelEl =
          (el.id ? document.querySelector(`label[for="${el.id}"]`) : null) ||
          el.closest('label') ||
          el.previousElementSibling

        return {
          label: labelEl?.textContent?.trim() ?? el.placeholder ?? el.name ?? '',
          field_name: el.name || el.id || '',
          field_type:
            el.tagName.toLowerCase() === 'select' ? 'select' : el.type || 'text',
          required: el.required ?? false,
        }
      }).filter((f) => f.field_name !== '')
    })

    return fields
  } finally {
    await page.close()
  }
}

// Map fields to candidate data using Claude
async function mapFieldsWithAI(fields, anthropicKey) {
  const prompt = `Map these application form fields to the candidate's profile data.

CANDIDATE DATA:
${JSON.stringify(OWNER_DATA, null, 2)}

FORM FIELDS:
${JSON.stringify(fields, null, 2)}

For each field, determine the best value from the candidate data.
Set confidence 0.0–1.0 (how certain you are this is the right value).
Set requires_manual: true if confidence < 0.8 or you cannot determine a value.

Return ONLY a JSON array. No markdown:
[{"label":"","field_name":"","field_type":"","value":"","confidence":0.0,"requires_manual":false}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: 'You are a precise form-filling assistant. Return only valid JSON. No markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Anthropic error: ${err?.error?.message ?? res.status}`)
  }

  const data = await res.json()
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const mapped = JSON.parse(text)
  return mapped.map((f) => ({
    ...f,
    requires_manual: f.requires_manual || f.confidence < 0.8,
  }))
}

// Upload a PNG buffer to Supabase Storage and return its public URL
async function uploadToSupabase(supabaseUrl, serviceKey, path, pngBuffer) {
  const uploadUrl = `${supabaseUrl}/storage/v1/object/application-screenshots/${path}`

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: pngBuffer,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase upload failed: ${err}`)
  }

  return `${supabaseUrl}/storage/v1/object/public/application-screenshots/${path}`
}

// POST /form-map — extract fields and map them with AI
async function handleFormMap(request, env) {
  const { url } = await request.json()
  if (!url) return json({ error: 'url is required' }, 400)

  const browser = await puppeteer.launch(env.BROWSER)
  try {
    const rawFields = await extractFields(browser, url)
    const mappedFields = await mapFieldsWithAI(rawFields, env.ANTHROPIC_API_KEY)
    return json({ url, fields: mappedFields })
  } finally {
    await browser.close()
  }
}

// POST /screenshot — capture before/after screenshots and upload to Supabase
async function handleScreenshot(request, env) {
  const { jobId, url, formMapping } = await request.json()
  if (!jobId || !url || !formMapping) {
    return json({ error: 'jobId, url, and formMapping are required' }, 400)
  }

  const browser = await puppeteer.launch(env.BROWSER)
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    const beforeBuffer = await page.screenshot({ fullPage: true })
    const beforePath = `${jobId}/before-${Date.now()}.png`
    const beforeUrl = await uploadToSupabase(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      beforePath,
      beforeBuffer
    )

    for (const field of formMapping.fields) {
      if (!field.value || field.requires_manual) continue
      try {
        const selector = field.field_name
          ? `[name="${field.field_name}"]`
          : `[id="${field.field_name}"]`

        if (field.field_type === 'select') {
          await page.select(selector, field.value)
        } else if (field.field_type === 'checkbox' || field.field_type === 'radio') {
          if (field.value === 'true') {
            const el = await page.$(selector)
            if (el) await el.click()
          }
        } else {
          await page.type(selector, field.value, { delay: 0 })
        }
      } catch {
        // Skip fields that can't be filled
      }
    }

    const filledBuffer = await page.screenshot({ fullPage: true })
    const filledPath = `${jobId}/filled-${Date.now()}.png`
    const filledUrl = await uploadToSupabase(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      filledPath,
      filledBuffer
    )

    return json({
      job_id: jobId,
      before_url: beforeUrl,
      filled_url: filledUrl,
      captured_at: new Date().toISOString(),
    })
  } finally {
    await page.close()
    await browser.close()
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    if (!checkAuth(request, env)) return authError()

    const url = new URL(request.url)

    try {
      if (url.pathname === '/form-map') return await handleFormMap(request, env)
      if (url.pathname === '/screenshot') return await handleScreenshot(request, env)
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      return json({ error: err.message }, 500)
    }
  },
}
