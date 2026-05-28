import type { FormMapping } from './types'

const WORKER_URL = import.meta.env.VITE_BROWSER_WORKER_URL as string
const WORKER_SECRET = import.meta.env.VITE_BROWSER_WORKER_SECRET as string

export async function mapForm(url: string): Promise<FormMapping> {
  if (!WORKER_URL) throw new Error('VITE_BROWSER_WORKER_URL is not configured')

  const res = await fetch(`${WORKER_URL}/form-map`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': WORKER_SECRET ?? '',
    },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Browser Worker /form-map failed: ${err.error ?? res.status}`)
  }

  return res.json() as Promise<FormMapping>
}
