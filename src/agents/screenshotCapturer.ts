import type { FormMapping, ScreenshotResult } from './types'

const WORKER_URL = import.meta.env.VITE_BROWSER_WORKER_URL as string
const WORKER_SECRET = import.meta.env.VITE_BROWSER_WORKER_SECRET as string

export async function captureScreenshots(
  jobId: string,
  url: string,
  formMapping: FormMapping
): Promise<ScreenshotResult> {
  if (!WORKER_URL) throw new Error('VITE_BROWSER_WORKER_URL is not configured')

  const res = await fetch(`${WORKER_URL}/screenshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': WORKER_SECRET ?? '',
    },
    body: JSON.stringify({ jobId, url, formMapping }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Browser Worker /screenshot failed: ${err.error ?? res.status}`)
  }

  return res.json() as Promise<ScreenshotResult>
}
