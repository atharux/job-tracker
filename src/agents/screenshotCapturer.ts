import { supabase } from '../supabaseClient'
import type { FormMapping, ScreenshotResult } from './types'

const WORKER_URL = import.meta.env.VITE_BROWSER_WORKER_URL as string
const WORKER_SECRET = import.meta.env.VITE_BROWSER_WORKER_SECRET as string

interface WorkerResponse {
  jobId: string
  before_b64: string
  filled_b64: string
  captured_at: string
}

async function uploadScreenshot(jobId: string, label: 'before' | 'filled', b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const path = `screenshots/${jobId}/${label}.png`

  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, bytes, { contentType: 'image/png', upsert: true })

  if (error) throw new Error(`Screenshot upload failed (${label}): ${error.message}`)

  const { data } = supabase.storage.from('screenshots').getPublicUrl(path)
  return data.publicUrl
}

export async function captureScreenshots(
  jobId: string,
  url: string,
  formMapping: FormMapping
): Promise<ScreenshotResult> {
  if (!WORKER_URL) throw new Error('VITE_BROWSER_WORKER_URL is not configured — deploy the browser worker first')

  const res = await fetch(`${WORKER_URL}/screenshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': WORKER_SECRET ?? '',
    },
    body: JSON.stringify({ jobId, url, formMapping }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as Record<string, string>
    throw new Error(`Browser Worker /screenshot failed: ${err.error ?? res.status}`)
  }

  const { before_b64, filled_b64, captured_at } = await res.json() as WorkerResponse

  const [before_url, filled_url] = await Promise.all([
    uploadScreenshot(jobId, 'before', before_b64),
    uploadScreenshot(jobId, 'filled', filled_b64),
  ])

  return { job_id: jobId, before_url, filled_url, captured_at }
}
