import { supabase } from '../supabaseClient'
import { callAI, getPreferredFreeModel } from './openRouterClient'
import { getGmailToken, isGmailConnected } from '../services/gmailAuth'
import type { EmailResponseType, Job } from './types'

async function fetchSubmittedJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'submitted')

  if (error) throw new Error(`Failed to fetch submitted jobs: ${error.message}`)
  return (data ?? []) as Job[]
}

async function searchGmailForJob(job: Job): Promise<{ found: boolean; emailContent: string }> {
  const token = await getGmailToken()
  if (!token) return { found: false, emailContent: '' }

  const company = job.company.replace(/[^\w\s]/g, '').trim()
  const q = encodeURIComponent(`"${company}" subject:(application OR interview OR thank you OR decision OR update)`)

  try {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!listRes.ok) return { found: false, emailContent: '' }

    const list = await listRes.json() as { messages?: Array<{ id: string }> }
    if (!list.messages?.length) return { found: false, emailContent: '' }

    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${list.messages[0].id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!msgRes.ok) return { found: false, emailContent: '' }

    const msg = await msgRes.json() as {
      snippet?: string
      payload?: { headers?: Array<{ name: string; value: string }> }
    }
    const headers = msg.payload?.headers ?? []
    const subject = headers.find(h => h.name === 'Subject')?.value ?? ''
    const from = headers.find(h => h.name === 'From')?.value ?? ''

    return {
      found: true,
      emailContent: `From: ${from}\nSubject: ${subject}\n\n${msg.snippet ?? ''}`,
    }
  } catch {
    return { found: false, emailContent: '' }
  }
}

async function classifyEmailResponse(
  emailContent: string,
  jobTitle: string,
  company: string
): Promise<EmailResponseType> {
  const result = await callAI({
    model: getPreferredFreeModel(),
    groqModel: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You classify job application email responses. Return exactly one word — nothing else.',
      },
      {
        role: 'user',
        content: `Classify this email about a job application for "${jobTitle}" at "${company}".\n\nEMAIL:\n${emailContent}\n\nReturn ONLY one of: rejection | screening | interview | no_reply`,
      },
    ],
    max_tokens: 10,
  })

  const text = result.trim().toLowerCase() as EmailResponseType
  const valid: EmailResponseType[] = ['no_reply', 'rejection', 'screening', 'interview']
  return valid.includes(text) ? text : 'no_reply'
}

async function updateJobStatus(jobId: string, newStatus: EmailResponseType): Promise<void> {
  await supabase
    .from('jobs')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

export function isStatusTrackerReady(): boolean {
  return isGmailConnected()
}

export async function syncStatus(): Promise<Array<{ job_id: string; status: EmailResponseType }>> {
  const jobs = await fetchSubmittedJobs()
  const updates: Array<{ job_id: string; status: EmailResponseType }> = []

  for (const job of jobs) {
    const { found, emailContent } = await searchGmailForJob(job)
    const status: EmailResponseType = found
      ? await classifyEmailResponse(emailContent, job.title, job.company)
      : 'no_reply'

    if (status !== 'no_reply') {
      await updateJobStatus(job.id, status)
      updates.push({ job_id: job.id, status })
    }
  }

  return updates
}

export async function watchJob(jobId: string): Promise<EmailResponseType> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !job) throw new Error(`Job not found: ${jobId}`)

  const { found, emailContent } = await searchGmailForJob(job as Job)
  if (!found) return 'no_reply'

  const status = await classifyEmailResponse(emailContent, job.title, job.company)
  await updateJobStatus(jobId, status)
  return status
}
