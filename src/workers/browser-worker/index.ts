import puppeteer from '@cloudflare/puppeteer'

export interface Env {
  BROWSER: Fetcher
  WORKER_SECRET: string
}

interface ScreenshotRequest {
  jobId: string
  url: string
  formMapping?: {
    fields?: Array<{ selector: string; value: string; type?: string }>
  }
}

interface ScreenshotResponse {
  jobId: string
  before_b64: string
  filled_b64: string
  captured_at: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Auth
    const secret = request.headers.get('X-Worker-Secret')
    if (!env.WORKER_SECRET || secret !== env.WORKER_SECRET) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { pathname } = new URL(request.url)

    if (request.method === 'POST' && pathname === '/screenshot') {
      let body: ScreenshotRequest
      try {
        body = await request.json() as ScreenshotRequest
      } catch {
        return json({ error: 'Invalid JSON body' }, 400)
      }

      const { jobId, url: targetUrl, formMapping } = body
      if (!jobId || !targetUrl) return json({ error: 'jobId and url are required' }, 400)

      const browser = await puppeteer.launch(env.BROWSER)
      const page = await browser.newPage()

      try {
        await page.setViewport({ width: 1280, height: 900 })
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30_000 })

        const beforeBuffer = await page.screenshot({ type: 'png', fullPage: false })
        const beforeB64 = Buffer.from(beforeBuffer).toString('base64')

        // Attempt field fills if formMapping provided
        let filledB64 = beforeB64
        const fields = formMapping?.fields ?? []
        if (fields.length > 0) {
          for (const field of fields) {
            try {
              const el = await page.$(field.selector)
              if (!el) continue
              if (field.type === 'select') {
                await page.select(field.selector, field.value)
              } else {
                await el.click({ clickCount: 3 })
                await el.type(field.value, { delay: 20 })
              }
            } catch {
              // Skip fields that can't be filled — don't abort the screenshot
            }
          }
          const filledBuffer = await page.screenshot({ type: 'png', fullPage: false })
          filledB64 = Buffer.from(filledBuffer).toString('base64')
        }

        const result: ScreenshotResponse = {
          jobId,
          before_b64: beforeB64,
          filled_b64: filledB64,
          captured_at: new Date().toISOString(),
        }

        return json(result)
      } finally {
        await browser.close()
      }
    }

    if (request.method === 'GET' && pathname === '/health') {
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  },
}
