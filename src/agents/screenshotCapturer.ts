import type { FormMapping, ScreenshotResult } from './types'

// Screenshots require a deployed Cloudflare Browser Worker (VITE_BROWSER_WORKER_URL).
// Until that worker is deployed, this returns a skipped stub so the pipeline
// completes without failing at this step.
export async function captureScreenshots(
  jobId: string,
  _url: string,
  _formMapping: FormMapping
): Promise<ScreenshotResult> {
  const workerUrl = import.meta.env.VITE_BROWSER_WORKER_URL as string | undefined

  if (!workerUrl) {
    return {
      job_id: jobId,
      before_url: '',
      filled_url: '',
      captured_at: new Date().toISOString(),
      skipped: true,
      skip_reason: 'Browser worker not deployed',
    } as ScreenshotResult & { skipped: boolean; skip_reason: string }
  }

  const workerSecret = import.meta.env.VITE_BROWSER_WORKER_SECRET as string | undefined

  const res = await fetch(`${workerUrl}/screenshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': workerSecret ?? '',
    },
    body: JSON.stringify({ jobId, url: _url, formMapping: _formMapping }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as Record<string, string>
    throw new Error(`Browser Worker /screenshot failed: ${err.error ?? res.status}`)
  }

  const { before_b64, filled_b64, captured_at } = await res.json() as {
    jobId: string
    before_b64: string
    filled_b64: string
    captured_at: string
  }

  const { supabase } = await import('../supabaseClient')

  async function upload(label: 'before' | 'filled', b64: string): Promise<string> {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const path = `screenshots/${jobId}/${label}.png`
    const { error } = await supabase.storage
      .from('screenshots')
      .upload(path, bytes, { contentType: 'image/png', upsert: true })
    if (error) throw new Error(`Screenshot upload failed (${label}): ${error.message}`)
    return supabase.storage.from('screenshots').getPublicUrl(path).data.publicUrl
  }

  const [before_url, filled_url] = await Promise.all([
    upload('before', before_b64),
    upload('filled', filled_b64),
  ])

  return { job_id: jobId, before_url, filled_url, captured_at }
}
